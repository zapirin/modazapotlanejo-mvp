"use server";

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { randomBytes, createHash } from 'crypto';
import { Role } from '@/generated/client';
import { sendWelcomeToBuyer, sendPasswordResetEmail } from '@/lib/email/templates';
import { getBrandConfig } from '@/lib/brand';

function hashPassword(password: string) {
    return createHash('sha256').update(password).digest('hex');
}

function hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(email: string) {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await prisma.user.findFirst({
            where: { email: normalizedEmail },
            select: { id: true, registeredDomain: true }
        });

        if (!user) {
            return { success: true };
        }

        const token = randomBytes(32).toString('hex');
        const hashedToken = hashToken(token);
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: hashedToken,
                resetTokenExpiry: expiry
            }
        });

        // Resolve brand from the domain where the user registered
        const domain = (user as any).registeredDomain || 'modazapotlanejo.com';
        const brand = getBrandConfig(domain);
        const BRAND_COLORS: Record<string, string> = {
            blue: '#2563eb', violet: '#7c3aed', kalexa: '#8124E3',
        };
        const brandColor = BRAND_COLORS[brand.primaryColor] || '#2563eb';

        const resetLink = `https://${domain}/reset-password?token=${token}`;

        await sendPasswordResetEmail({
            email: normalizedEmail,
            resetLink,
            brandName: brand.name,
            brandColor,
            domain,
        });

        return { success: true };
    } catch (error: any) {
        console.error("Request Password Reset Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Error: ${errorMessage.substring(0, 500)}` };
    }
}

export async function resetPassword(token: string, newPassword: string) {
    try {
        const hashedToken = hashToken(token);
        
        const user = await prisma.user.findFirst({
            where: {
                resetToken: hashedToken,
                resetTokenExpiry: {
                    gt: new Date()
                }
            }
        });

        if (!user) {
            return { success: false, error: 'El enlace es inválido o ha expirado' };
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashPassword(newPassword),
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Reset Password Error:", error);
        return { success: false, error: 'Error al restablecer la contraseña' };
    }
}

export async function login(email: string, password?: string, registeredDomain?: string) {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        // Domain-aware user lookup:
        // If registeredDomain is provided (e.g. from kalexafashion.com), look for users on that domain
        // Otherwise, look for users with null domain (marketplace/seller-center users)
        let user;
        if (registeredDomain) {
            user = await prisma.user.findFirst({
                where: { email: normalizedEmail, registeredDomain },
                include: { location: true }
            });
        }

        // Fallback or Admin check:
        if (!user) {
            user = await prisma.user.findFirst({
                where: { email: normalizedEmail },
                include: { location: true }
            });
        }

        if (!user) {
            return { success: false, error: 'Usuario no encontrado' };
        }

        // Domain restriction bypass for ADMINs
        if (user.role !== 'ADMIN' && registeredDomain && user.registeredDomain !== registeredDomain) {
            // If it's a buyer/seller, they MUST match the domain they are logging into
            return { success: false, error: 'Este usuario no pertenece a esta tienda' };
        }

        // If user has a password set, we MUST check it
        if (user.passwordHash) {
            if (!password) {
                return { success: false, error: 'La contraseña es obligatoria' };
            }
            const hashed = hashPassword(password);
            if (hashed !== user.passwordHash) {
                return { success: false, error: 'Contraseña incorrecta' };
            }
        }

        // Set cookie with user ID
        const cookieStore = await cookies();
        cookieStore.set('session_user_id', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 1 week
        });

        return { success: true, role: user.role };
    } catch (error) {
        console.error("Login Error:", error);
        return { success: false, error: 'Error al iniciar sesión' };
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('session_user_id');
    return { success: true };
}

export async function getSessionUser() {
    const cookieStore = await cookies();
    const userId = cookieStore.get('session_user_id')?.value;

    if (!userId) return null;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { location: true }
        });
        return user;
    } catch (error) {
        return null;
    }
}

export async function updateProfile(data: { name: string, password?: string }) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: 'No autorizado' };

        const updateData: any = { name: data.name };
        
        if (data.password && data.password.trim().length > 0) {
            updateData.passwordHash = hashPassword(data.password);
        }

        await prisma.user.update({
            where: { id: user.id },
            data: updateData
        });

        return { success: true };
    } catch (error) {
        console.error("Update Profile Error:", error);
        return { success: false, error: 'Error al actualizar perfil' };
    }
}

export async function registerBuyer(data: {
    email: string;
    name: string;
    password?: string;
    isWholesale: boolean;
    businessName?: string;
    taxId?: string;
    registeredDomain?: string;
    shippingAddress?: {
        name: string;
        phone: string;
        street: string;
        colonia: string;
        city: string;
        state: string;
        zip: string;
    };
}) {
    try {
        const normalizedEmail = data.email.toLowerCase().trim();
        const domain = data.registeredDomain || null;
        
        // Check for existing user on this specific domain
        const existing = await prisma.user.findFirst({
            where: { email: normalizedEmail, registeredDomain: domain }
        });

        if (existing) {
            return { success: false, error: 'Este correo ya está registrado' };
        }

        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                name: data.name,
                passwordHash: data.password ? hashPassword(data.password) : null,
                role: Role.BUYER,
                isWholesale: data.isWholesale,
                businessName: data.businessName,
                taxId: data.taxId,
                registeredDomain: domain,
            }
        });

        // Guardar dirección de envío si se proporcionó
        if (data.shippingAddress?.street && data.shippingAddress?.city) {
            await prisma.shippingAddress.create({
                data: {
                    userId: user.id,
                    label: 'Principal',
                    name: data.shippingAddress.name || data.name,
                    phone: data.shippingAddress.phone || '',
                    street: data.shippingAddress.street,
                    colonia: data.shippingAddress.colonia || '',
                    city: data.shippingAddress.city,
                    state: data.shippingAddress.state,
                    zip: data.shippingAddress.zip || '',
                    referencias: (data.shippingAddress as any).referencias || '',
                    isDefault: true,
                }
            });
        }

        // Email de bienvenida (async, no bloquea el registro)
        sendWelcomeToBuyer({
            email: normalizedEmail,
            name: data.name,
            isWholesale: data.isWholesale,
        }).catch(console.error);

        // Auto login after registration
        const cookieStore = await cookies();
        cookieStore.set('session_user_id', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 1 week
        });

        return { success: true, role: 'BUYER' as const };
    } catch (error) {
        console.error("Register Buyer Error:", error);
        return { success: false, error: 'Error al registrar usuario' };
    }
}

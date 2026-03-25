"use server";

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { randomBytes, createHash } from 'crypto';
import { Role } from '@/generated/client';
import { sendEmail } from '@/lib/email/resend';
import { sendWelcomeToBuyer } from '@/lib/email/templates';

function hashPassword(password: string) {
    return createHash('sha256').update(password).digest('hex');
}

function hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(email: string) {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (!user) {
            // We don't want to leak if a user exists or not, but for MVP it's often okay.
            // However, a better UX/Security practice is "If an account exists, you will receive an email".
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

        const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

        await sendEmail({
            to: normalizedEmail,
            subject: 'Restablecer contraseña - Moda Zapotlanejo',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Moda Zapotlanejo</h2>
                    <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para continuar:</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Restablecer Contraseña</a>
                    <p style="margin-top: 20px; font-size: 14px; color: #666;">Este enlace expirará en 1 hora.</p>
                    <p style="font-size: 14px; color: #666;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
                </div>
            `
        });

        return { success: true };
    } catch (error: any) {
        console.error("Request Password Reset Error:", error);
        // Include partial error message to help debug if it's a DB issue
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

export async function login(email: string, password?: string) {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: { location: true }
        });

        if (!user) {
            return { success: false, error: 'Usuario no encontrado' };
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
        
        const existing = await prisma.user.findUnique({
            where: { email: normalizedEmail }
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
                taxId: data.taxId
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

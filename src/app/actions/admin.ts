"use server";

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { Role } from '@/generated/client';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email/resend';

// --- SELLER APPLICATIONS ---

export async function applyAsSeller(data: {
    storeName: string;
    contactName: string;
    email: string;
    phone: string;
    category: string[];
    storeAddress?: string;
    shippingZip?: string;
    planName?: string;
    registeredDomain?: string;
}) {
    try {
                const existing = await prisma.sellerApplication.findUnique({
            where: { email: data.email }
        });

        if (existing) {
            return { success: false, error: 'Ya existe una solicitud pendiente con este correo.' };
        }

                await prisma.sellerApplication.create({
            data: {
                storeName: data.storeName,
                contactName: data.contactName,
                email: data.email,
                phone: data.phone,
                category: data.category.join(', '),
                storeAddress: data.storeAddress || '',
                shippingZip: data.shippingZip || '',
                planName: data.planName || '',
                registeredDomain: data.registeredDomain || 'modazapotlanejo.com',
            }
        });

        // Notify Admin (using the user's implicit request/email)
        await sendEmail({
            to: 'vendedores@modazapotlanejo.com',
            subject: `🚀 Nueva Solicitud de Fabricante: ${data.storeName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #2563eb; text-transform: uppercase;">Nueva Solicitud de Fabricante</h2>
                    <p>Se ha recibido una nueva solicitud para vender en <strong>Moda Zapotlanejo</strong>.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p><strong>Tienda:</strong> ${data.storeName}</p>
                    <p><strong>Contacto:</strong> ${data.contactName}</p>
                    <p><strong>Email:</strong> ${data.email}</p>
                    <p><strong>Teléfono:</strong> ${data.phone}</p>
                    <p><strong>Categorías:</strong> ${data.category.join(', ')}</p>
                    <p><strong>Domicilio:</strong> ${data.storeAddress || 'No especificado'}</p>
                    <p><strong>Plan solicitado:</strong> ${data.planName || 'No especificado'}</p>
                    <div style="margin-top: 30px;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/applications" 
                           style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                            Gestionar Solicitud
                        </a>
                    </div>
                </div>
            `
        });

        return { success: true };
    } catch (error) {
        console.error("Apply as Seller Error:", error);
        return { success: false, error: 'Error al enviar la solicitud.' };
    }
}

export async function getSellerApplications() {
    try {
                return await prisma.sellerApplication.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        console.error("Get Seller Applications Error:", error);
        return [];
    }
}

// --- SELLER MANAGEMENT & COSTS ---

export async function getSellers() {
    try {
        return await prisma.user.findMany({
                        where: { role: Role.SELLER },
            select: {
                id: true,
                name: true,
                email: true,
                                commission: true,
                                fixedFee: true,
                isActive: true,
                adminNotes: true,
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        console.error("Get Sellers Error:", error);
        return [];
    }
}

export async function updateSellerCosts(id: string, costs: { commission: number, fixedFee: number }) {
    try {
        await prisma.user.update({
            where: { id },
            data: {
                                commission: costs.commission,
                                fixedFee: costs.fixedFee
            }
        });
        revalidatePath('/admin/costs');
        return { success: true };
    } catch (error) {
        console.error("Update Seller Costs Error:", error);
        return { success: false, error: 'Error al actualizar los costos del vendedor.' };
    }
}

export async function toggleUserStatus(userId: string) {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { success: false, error: 'Usuario no encontrado' };

        await prisma.user.update({
            where: { id: userId },
            data: { isActive: !user.isActive }
        });
        revalidatePath('/admin/costs');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Error al cambiar estado' };
    }
}

export async function updateUserAdminNotes(userId: string, notes: string) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { adminNotes: notes }
        });
        revalidatePath('/admin/costs');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Error al guardar notas' };
    }
}

export async function resendSellerCredentials(userId: string, customPassword?: string) {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { success: false, error: 'Usuario no encontrado' };

        const tempPassword = customPassword || Math.random().toString(36).slice(-8);
        const { createHash } = await import('crypto');
        const passwordHash = createHash('sha256').update(tempPassword).digest('hex');

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash }
        });

        await sendEmail({
            to: user.email,
            subject: '📦 Actualización de Seguridad: Credenciales de Moda Zapotlanejo',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #2563eb;">Actualización de Credenciales</h2>
                    <p>Hola <strong>${user.name}</strong>,</p>
                    <p>Se han actualizado tus credenciales de acceso al <strong>Seller Center</strong>.</p>
                    
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Nuevos accesos:</strong></p>
                        <p style="margin: 10px 0 5px 0;"><strong>Email:</strong> ${user.email}</p>
                        <p style="margin: 0;"><strong>Nueva Contraseña:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 5px; border-radius: 3px;">${tempPassword}</span></p>
                    </div>

                    <p style="font-size: 14px; color: #64748b;">Ingresa con estos datos y recuerda cambiarlos en tu perfil si lo deseas.</p>

                    <div style="margin-top: 30px; text-align: center;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" 
                           style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                            Ir al Login
                        </a>
                    </div>
                </div>
            `
        });

        return { success: true, tempPassword };
    } catch (error) {
        console.error("Resend Credentials Error:", error);
        return { success: false, error: 'Error al enviar credenciales' };
    }
}

export async function syncApprovedSellers() {
    try {
        const approvedApps = await prisma.sellerApplication.findMany({
            where: { status: 'APPROVED' }
        });

        const results = { created: 0, existing: 0, errors: 0 };

        for (const app of approvedApps) {
            const existingUser = await prisma.user.findFirst({
                where: { email: app.email }
            });

            if (existingUser) {
                results.existing++;
                continue;
            }

            try {
                // Same logic as in updateApplicationStatus (Manual trigger for gaps)
                const tempPassword = Math.random().toString(36).slice(-8);
                const { createHash } = await import('crypto');
                const passwordHash = createHash('sha256').update(tempPassword).digest('hex');

                const newUser = await prisma.user.create({
                    data: {
                        email: app.email,
                        name: app.contactName,
                        passwordHash,
                        role: Role.SELLER,
                        isActive: true
                    }
                });

                await prisma.supplier.create({
                    data: {
                        name: app.storeName,
                        email: app.email,
                        phone: app.phone,
                        sellerId: newUser.id,
                        isActive: true,
                        contactName: app.contactName
                    }
                });

                // We don't MANDATORY send emails here to avoid spamming if user is doing a mass sync,
                // But for a single test case it's fine.
                results.created++;
            } catch (err) {
                console.error(`Sync error for ${app.email}:`, err);
                results.errors++;
            }
        }

        revalidatePath('/admin/costs');
        return { success: true, ...results };
    } catch (error) {
        return { success: false, error: 'Error durante la sincronización' };
    }
}

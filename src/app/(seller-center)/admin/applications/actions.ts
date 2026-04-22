"use server";

function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // quitar acentos
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
}

async function uniqueSlug(base: string, prisma: any): Promise<string> {
    let slug = generateSlug(base);
    let attempt = slug;
    let counter = 1;
    while (true) {
        const existing = await prisma.user.findFirst({ where: { sellerSlug: attempt } });
        if (!existing) return attempt;
        attempt = `${slug}-${counter++}`;
    }
}


import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Role } from '@/generated/client';
import { sendWelcomeToSeller } from '@/lib/email/templates';
import { createHash } from 'crypto';

function hashPassword(password: string) {
    return createHash('sha256').update(password).digest('hex');
}

export async function updateApplicationStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
        const application = await prisma.sellerApplication.findUnique({
            where: { id }
        });

        if (!application) {
            return { success: false, error: 'Solicitud no encontrada.' };
        }

        if (status === 'APPROVED') {
            // Generate a temporary password
            const tempPassword = Math.random().toString(36).slice(-8);
            const passwordHash = hashPassword(tempPassword);

            await prisma.$transaction(async (tx) => {
                // 1. Create User
                const slug = await uniqueSlug(application.storeName || application.contactName, tx);
                const user = await tx.user.create({
                    data: {
                        email: application.email,
                        name: application.contactName,
                        passwordHash,
                        role: Role.SELLER,
                        businessName: application.storeName,
                        sellerSlug: slug,
                        phone: application.phone || null,
                        whatsapp: application.phone || null,
                    }
                });

                // 2. Create StoreSettings pre-filled from application
                await (tx.storeSettings as any).create({
                    data: {
                        sellerId: user.id,
                        storeName: application.storeName,
                        phone: application.phone || null,
                        address: application.storeAddress || null,
                        shippingZip: (application as any).shippingZip || null,
                    }
                });

                // 3. Update application status
                await tx.sellerApplication.update({
                    where: { id },
                    data: { status }
                });
            });

            // 4. Enviar email de bienvenida con branding del dominio donde se registró el vendedor
            const sellerDomain = (application as any).registeredDomain || 'modazapotlanejo.com';
            const BRAND_COLORS: Record<string, string> = {
                'modazapotlanejo.com': '#2563eb',
                'zonadelvestir.com':   '#7c3aed',
                'kalexafashion.com':   '#8124E3',
            };
            const BRAND_NAMES: Record<string, string> = {
                'modazapotlanejo.com': 'Moda Zapotlanejo',
                'zonadelvestir.com':   'Zona del Vestir',
                'kalexafashion.com':   'Kalexa Fashion',
            };
            await sendWelcomeToSeller({
                email: application.email,
                name: application.contactName,
                storeName: application.storeName,
                tempPassword,
                brandName:  BRAND_NAMES[sellerDomain]  || 'Moda Zapotlanejo',
                brandColor: BRAND_COLORS[sellerDomain] || '#2563eb',
                domain: sellerDomain,
            });

        } else {
            // Just update to REJECTED
            await prisma.sellerApplication.update({
                where: { id },
                data: { status }
            });
        }

        revalidatePath('/admin/applications');
        return { success: true };
    } catch (error) {
        console.error("Update Application Status Error:", error);
        return { success: false, error: 'Error al procesar la solicitud.' };
    }
}

export async function createSellerManually(data: {
    storeName: string;
    contactName: string;
    email: string;
    phone?: string;
    planName: string;
    registeredDomain?: string;
}) {
    try {
        const normalizedEmail = data.email.toLowerCase().trim();

        // 1. Validar que el correo no exista
        const existingUser = await prisma.user.findFirst({
            where: { email: normalizedEmail }
        });

        if (existingUser) {
            return { success: false, error: 'El correo ya está registrado.' };
        }

        // 2. Generar contraseña temporal
        const tempPassword = Math.random().toString(36).slice(-8);
        const passwordHash = hashPassword(tempPassword);

        // Map plans to permissions (based on the frontend list)
        const planMapping: Record<string, { maxLocations: number, maxCashiers: number, maxProducts: number | null }> = {
            'Básico': { maxLocations: 1, maxCashiers: 1, maxProducts: 50 },
            'Estándar': { maxLocations: 2, maxCashiers: 3, maxProducts: 200 },
            'Pro': { maxLocations: 5, maxCashiers: 10, maxProducts: null },
            'Empresarial': { maxLocations: 20, maxCashiers: 50, maxProducts: null }
        };
        const permissions = planMapping[data.planName] || planMapping['Básico'];

        const newUser = await prisma.$transaction(async (tx) => {
            // 3. Crear usuario
            const slug = await uniqueSlug(data.storeName || data.contactName, tx);
            const user = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    name: data.contactName,
                    passwordHash,
                    role: Role.SELLER,
                    businessName: data.storeName,
                    sellerSlug: slug,
                    phone: data.phone || null,
                    whatsapp: data.phone || null,
                    posEnabled: true,
                    planName: data.planName,
                    maxLocations: permissions.maxLocations,
                    maxCashiers: permissions.maxCashiers,
                    maxProducts: permissions.maxProducts,
                }
            });

            // 4. Crear StoreSettings
            await (tx.storeSettings as any).create({
                data: {
                    sellerId: user.id,
                    storeName: data.storeName,
                    phone: data.phone || null,
                }
            });

            return user;
        });

        // 6. Enviar correo de bienvenida
        const sellerDomain = data.registeredDomain || 'modazapotlanejo.com';
        const BRAND_COLORS: Record<string, string> = {
            'modazapotlanejo.com': '#2563eb',
            'zonadelvestir.com': '#7c3aed',
            'kalexafashion.com': '#8124E3',
        };
        const BRAND_NAMES: Record<string, string> = {
            'modazapotlanejo.com': 'Moda Zapotlanejo',
            'zonadelvestir.com': 'Zona del Vestir',
            'kalexafashion.com': 'Kalexa Fashion',
        };

        await sendWelcomeToSeller({
            email: normalizedEmail,
            name: data.contactName,
            storeName: data.storeName,
            tempPassword,
            brandName: BRAND_NAMES[sellerDomain] || 'Moda Zapotlanejo',
            brandColor: BRAND_COLORS[sellerDomain] || '#2563eb',
            domain: sellerDomain,
        });

        revalidatePath('/admin/marketplace');
        return { success: true, user: newUser };
    } catch (error) {
        console.error("Create Seller Manually Error:", error);
        return { success: false, error: 'Error al crear el vendedor.' };
    }
}

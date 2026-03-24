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
                    }
                });

                // 2. Update application status (no se auto-crea proveedor)
                await tx.sellerApplication.update({
                    where: { id },
                    data: { status }
                });
            });

            // 4. Enviar email de bienvenida con la nueva plantilla profesional
            await sendWelcomeToSeller({
                email: application.email,
                name: application.contactName,
                storeName: application.storeName,
                tempPassword,
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

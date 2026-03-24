import { getSessionUser } from '@/app/actions/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import React from 'react';

export default async function NewProductLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (!user) redirect('/login');

    if (user.role === 'ADMIN') return <>{children}</>;

    if (user.role !== 'SELLER') redirect('/dashboard');

    // Verificar límite de productos del plan
    const seller = await (prisma.user as any).findUnique({
        where: { id: user.id },
        select: { maxProducts: true }
    });

    if (seller?.maxProducts !== null && seller?.maxProducts !== undefined && seller.maxProducts !== '') {
        const max = parseInt(seller.maxProducts);
        if (!isNaN(max) && max === 0) {
            // maxProducts = 0 significa bloqueado
            redirect('/products?error=limit_reached');
        }
        if (!isNaN(max) && max > 0) {
            const count = await prisma.product.count({
                where: { sellerId: user.id, isActive: true }
            });
            if (count >= max) {
                redirect(`/products?error=limit_reached&limit=${max}`);
            }
        }
    }

    return <>{children}</>;
}

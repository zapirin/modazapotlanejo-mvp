import { getSessionUser } from '@/app/actions/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import React from 'react';

async function getEffectiveSeller(user: any) {
    if (!user) return null;
    if (user.role === 'ADMIN') return { posEnabled: true };
    if (user.role === 'SELLER') {
        const seller = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { posEnabled: true }
        });
        return seller;
    }
    if (user.role === 'CASHIER') {
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true }
        });
        if (!cashier?.managedBySellerId) return { posEnabled: false };
        const seller = await (prisma.user as any).findUnique({
            where: { id: cashier.managedBySellerId },
            select: { posEnabled: true }
        });
        return seller;
    }
    return { posEnabled: false };
}

export default async function POSLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (!user) redirect('/login');

    const seller = await getEffectiveSeller(user);
    if (!seller?.posEnabled) {
        redirect('/dashboard?error=pos_disabled');
    }

    return <>{children}</>;
}

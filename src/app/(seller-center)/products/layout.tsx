import { getSessionUser } from '@/app/actions/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import React from 'react';

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (!user) redirect('/login');

    // Solo SELLER y ADMIN acceden a productos
    if (user.role !== 'SELLER' && user.role !== 'ADMIN') {
        redirect('/dashboard');
    }

    return <>{children}</>;
}

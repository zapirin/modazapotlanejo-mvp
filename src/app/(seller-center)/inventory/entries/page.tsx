import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/actions/auth';
import EntriesClient from './EntriesClient';

export const dynamic = 'force-dynamic';

export default async function StockEntriesPage() {
    const user: any = await getSessionUser();
    if (!user) redirect('/login');

    const isSeller = user.role === 'SELLER';
    const isAllowedCashier = user.role === 'CASHIER' && user.canRegisterStockEntry;

    if (!isSeller && !isAllowedCashier) {
        return (
            <div className="p-8">
                <div className="bg-card border border-border rounded-2xl p-10 text-center">
                    <h1 className="text-xl font-black mb-2">Acceso restringido</h1>
                    <p className="text-gray-500">No tienes permiso para ver las entradas de mercancía.</p>
                </div>
            </div>
        );
    }

    return <EntriesClient canCancel={isSeller} />;
}

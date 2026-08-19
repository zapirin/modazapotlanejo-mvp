import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/actions/auth';
import PayablesClient from './PayablesClient';

export const dynamic = 'force-dynamic';

export default async function PayablesPage() {
    const user: any = await getSessionUser();
    if (!user) redirect('/login');

    // Cuentas por Pagar es dinero que sale: solo el dueño. El permiso del
    // cajero deja crear la deuda al capturar una compra, no pagarla.
    if (user.role !== 'SELLER') {
        return (
            <div className="p-8">
                <div className="bg-card border border-border rounded-2xl p-10 text-center">
                    <h1 className="text-xl font-black mb-2">Acceso restringido</h1>
                    <p className="text-gray-500">Solo el dueño de la tienda puede ver las cuentas por pagar.</p>
                </div>
            </div>
        );
    }

    return <PayablesClient />;
}

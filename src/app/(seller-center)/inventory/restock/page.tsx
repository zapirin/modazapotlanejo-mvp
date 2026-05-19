import React from 'react';
import { getSellerLocations } from './actions';
import RestockClient from './RestockClient';
import { getSessionUser } from '@/app/actions/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RestockPage() {
    const user = await getSessionUser();
    if (!user) redirect('/login');
    if (user.role !== 'SELLER' && user.role !== 'CASHIER') {
        return (
            <div className="p-8">
                <div className="bg-card border border-border rounded-2xl p-10 text-center">
                    <h1 className="text-xl font-black mb-2">Acceso restringido</h1>
                    <p className="text-gray-500">Solo el vendedor o cajero puede usar el resurtido.</p>
                </div>
            </div>
        );
    }

    const locations = await getSellerLocations();

    if (locations.length < 2) {
        return (
            <div className="p-8 max-w-3xl mx-auto">
                <h1 className="text-2xl font-black mb-2">Resurtido desde Bodega</h1>
                <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center mt-4">
                    <div className="text-4xl mb-3">🏬</div>
                    <h2 className="text-lg font-bold mb-1">Necesitas al menos 2 sucursales</h2>
                    <p className="text-gray-500 text-sm">
                        Esta pantalla compara stock entre tus sucursales y sugiere qué surtir.
                        Crea otra sucursal en <a href="/settings/locations" className="text-blue-600 underline">Configuración → Sucursales</a> para empezar.
                    </p>
                </div>
            </div>
        );
    }

    return <RestockClient locations={locations} />;
}

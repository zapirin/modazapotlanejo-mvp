import React from 'react';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';

export default async function TermsPage() {
    const headersList = await headers();
    const host = headersList.get('host');
    const brand = getBrandConfig(host);

    return (
        <div className="max-w-4xl mx-auto px-6 py-24 space-y-12">
            <div className="space-y-4 text-center">
                <h1 className="text-6xl font-black tracking-tighter uppercase italic">Términos y Condiciones</h1>
                <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs">Reglas claras para una comunidad confiable</p>
            </div>

            <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400 font-medium">
                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">1. Aceptación</h2>
                    <p>
                        Al utilizar los servicios de {brand.name}, aceptas cumplir con los términos aquí establecidos. {brand.isSingleVendor ? 'Esta tienda en línea' : 'Este marketplace'} facilita la conexión entre fabricantes y compradores para profesionalizar el comercio regional.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">2. Conducta del Usuario</h2>
                    <p>
                        Queda prohibido el uso de la plataforma para fines ilícitos o que atenten contra la integridad de otros miembros. {brand.isSingleVendor ? 'La administración' : 'Los vendedores'} son responsables de la veracidad de la información de sus productos.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">3. Transacciones Mayoristas</h2>
                    <p>
                        Las ventas por mayoreo están sujetas a las condiciones de cada fabricante. Nos reservamos el derecho de verificar la identidad de los compradores mayoristas para garantizar la exclusividad del servicio profesional.
                    </p>
                </section>

                <section className="bg-blue-50 dark:bg-blue-900/10 p-8 rounded-[32px] border border-blue-100 dark:border-blue-900/30">
                    <p className="text-sm font-bold text-blue-600">
                        {brand.name} actúa como habilitador de negocio. Cualquier disputa comercial será tratada directamente con la administración siguiendo nuestras guías de resolución.
                    </p>
                </section>
            </div>
        </div>
    );
}

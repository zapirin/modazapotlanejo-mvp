import React from 'react';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';

export default async function PrivacyPage() {
    const headersList = await headers();
    const host = headersList.get('host');
    const brand = getBrandConfig(host);

    return (
        <div className="max-w-4xl mx-auto px-6 py-24 space-y-12">
            <div className="space-y-4 text-center">
                <h1 className="text-6xl font-black tracking-tighter uppercase italic">Aviso de Privacidad</h1>
                <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs">Tu seguridad es nuestra prioridad</p>
            </div>

            <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400 font-medium">
                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">1. Recolección de Datos</h2>
                    <p>
                        En {brand.name}, nos comprometemos a proteger tu información personal. Recopilamos datos como nombre, correo electrónico y detalles de facturación únicamente para procesar tus pedidos y mejorar tu experiencia.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">2. Uso de la Información</h2>
                    <p>
                        Tu información se utiliza para la gestión de cuentas, procesamiento de transacciones y, si así lo autorizas, para enviarte promociones exclusivas de nuestros fabricantes asociados.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">3. Protección de Datos</h2>
                    <p>
                        Implementamos medidas de seguridad técnicas y administrativas para garantizar que tus datos no sean accesibles por terceros no autorizados. No vendemos ni compartimos tu base de datos con empresas ajenas al marketplace.
                    </p>
                </section>
                
                <section className="bg-gray-50 dark:bg-gray-900/50 p-8 rounded-[32px] border border-border italic">
                    <p className="text-sm">
                        Última actualización: 30 de Marzo de 2026. Para cualquier duda sobre tus datos, contacta a privacidad@{brand.domain}
                    </p>
                </section>
            </div>
        </div>
    );
}

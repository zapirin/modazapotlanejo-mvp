import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';

export default async function TermsPage() {
    const headersList = await headers();
    const host = headersList.get('host');
    const brand = getBrandConfig(host);
    const isKalexa = host?.includes('kalexa');

    if (isKalexa) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-24 space-y-12">
                <div className="space-y-4 text-center">
                    <h1 className="text-6xl font-black tracking-tighter uppercase italic">Términos y Condiciones</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs">Kalexa Fashion — Tienda en Línea</p>
                </div>

                <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400 font-medium">
                    <section className="space-y-4">
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">1. Aceptación</h2>
                        <p>
                            Al utilizar los servicios de Kalexa Fashion, aceptas cumplir con los términos aquí establecidos. Esta tienda en línea facilita la compra directa de productos de moda fabricados y distribuidos por Kalexa Fashion con sede en Zapotlanejo, Jalisco, México.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">2. Pedidos y Pagos</h2>
                        <p>
                            Los pedidos realizados en kalexafashion.com son procesados por el equipo de Kalexa Fashion. Una vez confirmado tu pedido, nos pondremos en contacto contigo por WhatsApp para coordinar el pago mediante transferencia bancaria o tarjeta de débito/crédito a través de nuestros canales autorizados.
                        </p>
                        <p>
                            El pago debe completarse antes de que el pedido sea preparado y enviado. Kalexa Fashion se reserva el derecho de cancelar pedidos en caso de falta de pago dentro del plazo acordado.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">3. Envíos</h2>
                        <p>
                            Realizamos envíos a toda la República Mexicana a través de paqueterías certificadas. El tiempo de entrega estimado es de 3 a 7 días hábiles dependiendo de la zona. Los costos de envío se calculan al momento de confirmar el pedido y dependen del destino y peso del paquete.
                        </p>
                        <p>
                            Para clientes en Zapotlanejo, Jalisco y zonas cercanas existe la opción de recolección directa en nuestras instalaciones.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">4. Devoluciones y Cambios</h2>
                        <p>
                            Aceptamos devoluciones dentro de los 7 días naturales posteriores a la recepción del producto, siempre que la prenda se encuentre en su estado original, sin uso, sin lavado y con etiquetas intactas. Los gastos de envío por devolución corren a cargo del cliente, salvo que el error sea atribuible a Kalexa Fashion.
                        </p>
                        <p>
                            Para iniciar una devolución o cambio, comunícate con nosotros por WhatsApp indicando tu número de pedido y el motivo de la solicitud.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">5. Privacidad</h2>
                        <p>
                            Los datos personales que compartes con Kalexa Fashion (nombre, dirección, teléfono) serán utilizados exclusivamente para procesar y entregar tu pedido. No compartimos tu información con terceros ajenos a la operación logística del pedido.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">6. Conducta del Usuario</h2>
                        <p>
                            Queda prohibido el uso de esta plataforma para fines ilícitos o fraudulentos. La administración de Kalexa Fashion se reserva el derecho de cancelar pedidos o bloquear usuarios que incurran en conductas irregulares o intentos de fraude.
                        </p>
                    </section>

                    <section className="bg-violet-50 dark:bg-violet-900/10 p-8 rounded-[32px] border border-violet-100 dark:border-violet-900/30">
                        <p className="text-sm font-bold text-violet-600">
                            Para cualquier duda, aclaración o soporte con tu pedido, contáctanos directamente por WhatsApp. Kalexa Fashion está comprometida a brindarte la mejor experiencia de compra en moda mayorista.
                        </p>
                    </section>
                </div>
            </div>
        );
    }

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

import { getSessionUser } from '@/app/actions/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import OrdersClient from './OrdersClient';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';

export default async function OrdersPage() {
    const user = await getSessionUser();

    if (!user) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center p-8 bg-card rounded-3xl border border-border shadow-2xl">
                    <h2 className="text-2xl font-black mb-4">No autorizado</h2>
                    <Link href="/login" className="px-8 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition">Ir al Login</Link>
                </div>
            </div>
        );
    }

    const headersList = await headers();
    const host = headersList.get('host');
    const brand = getBrandConfig(host);

    const isBuyer = (user.role as string) === 'BUYER';
    const isAdmin = (user.role as string) === 'ADMIN';
    const isSeller = (user.role as string) === 'SELLER' || isAdmin;

    // Kalexa Fashion recibe info extra: origen del pedido y datos de contacto del comprador
    const isKalexa = !isBuyer && !isAdmin && (user as any).email === 'kalexa.fashion@gmail.com';

    const orders = await prisma.order.findMany({
        where: isBuyer ? { buyerId: user.id } : (user.role === 'ADMIN' ? {} : { sellerId: user.id }),
        include: {
            items: true,
            buyer: { select: { name: true, email: true, businessName: true, phone: true, registeredDomain: true } },
            seller: { select: { name: true, businessName: true } },
            shippingAddress: true,
            shipment: true,
        },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="max-w-6xl mx-auto py-10 px-4">
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight">
                        {isBuyer ? 'Mis Pedidos' : 'Pedidos Recibidos'}
                    </h1>
                    <p className="text-gray-500 font-medium mt-2">
                        {isBuyer
                            ? `Historial de pedidos realizados en ${brand.name}.`
                            : `Pedidos que compradores han realizado de tus productos en ${brand.name}.`}
                    </p>
                </div>
                {isBuyer && (
                    <Link href="/" className="px-6 py-3 bg-white border border-border text-foreground font-black rounded-xl hover:bg-gray-50 transition flex items-center gap-2 shadow-sm text-sm">
                        ← Regresar al Marketplace
                    </Link>
                )}
            </div>

            <OrdersClient orders={orders as any} isBuyer={isBuyer} isSeller={isSeller} isAdmin={isAdmin} isKalexa={isKalexa} />
        </div>
    );
}

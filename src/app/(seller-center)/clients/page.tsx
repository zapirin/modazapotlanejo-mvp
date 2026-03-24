import { prisma } from '@/lib/prisma';
import ClientsClient from './ClientsClient';
import { getSessionUser } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
    const user = await getSessionUser();

    // Build seller isolation filter
    let sellerFilter: any = {};
    if (user?.role !== 'ADMIN') {
        if (user?.role === 'SELLER') {
            sellerFilter = { sellerId: user.id };
        } else if (user?.locationId) {
            const loc = await prisma.storeLocation.findUnique({
                where: { id: user.locationId },
                select: { sellerId: true }
            });
            if ((loc as any)?.sellerId) sellerFilter = { sellerId: (loc as any).sellerId };
        }
    }

    const clients = await prisma.client.findMany({
        where: sellerFilter,
        orderBy: [
            { name: 'asc' }
        ],
        include: {
            _count: {
                select: { sales: true }
            }
        }
    });

    const paymentMethods = await prisma.paymentMethod.findMany({
        where: { isActive: true, ...sellerFilter },
        orderBy: { name: 'asc' }
    });

    // We'll map them so it's easier to consume on the client side
    const mappedClients = clients.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email || '',
        phone: c.phone || '',
        storeCredit: c.storeCredit || 0,
        salesCount: c._count?.sales || 0,
        createdAt: c.createdAt.toISOString()
    }));

    return (
        <ClientsClient 
            initialClients={mappedClients} 
            paymentMethods={paymentMethods.map(p => p.name)} 
        />
    );
}

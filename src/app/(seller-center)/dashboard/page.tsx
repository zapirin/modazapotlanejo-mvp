import { getSessionUser } from '@/app/actions/auth';
import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';
export default async function SellerDashboardPage({ searchParams = {} }: { searchParams?: any }) {
    const user = await getSessionUser();
    
    // REDIRECT BUYERS TO ORDERS
    if ((user?.role as string) === 'BUYER') {
        const { redirect } = await import('next/navigation');
        redirect('/orders');
    }
    // Cajeros solo pueden ver el POS
    if ((user?.role as string) === 'CASHIER') {
        const { redirect } = await import('next/navigation');
        redirect('/pos');
    }

    // Fetch metrics
    const isSeller = (user?.role as string) === 'SELLER';
    const isAdmin = (user?.role as string) === 'ADMIN';
    const posDisabled = (searchParams as any)?.error === 'pos_disabled';

    // Timezone helpers — all date ranges use America/Mexico_City midnight
    // toLocaleString trick: parse UTC timestamp as MX wall-clock time
    const toMXTime = (d: Date) =>
        new Date(d.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    // Returns a UTC Date representing midnight of (today - daysAgo) in Mexico City
    const startOfDayInMX = (daysAgo = 0): Date => {
        const nowMX = toMXTime(new Date());
        nowMX.setHours(0, 0, 0, 0);
        nowMX.setDate(nowMX.getDate() - daysAgo);
        const offset = new Date().getTime() - toMXTime(new Date()).getTime();
        return new Date(nowMX.getTime() + offset);
    };
    // "Today" in Mexico City for label/trend generation
    const nowMX = toMXTime(new Date());

    const startOfToday  = startOfDayInMX(0);
    const sevenDaysAgo  = startOfDayInMX(6);
    const thirtyDaysAgo = startOfDayInMX(29);

    // Dynamic filters based on role
    const _locationFilter = (isAdmin || isSeller) ? {} : (user?.locationId ? { locationId: user.locationId } : {});
    
    // If not admin, we must isolate by seller
    let _sellerFilter = {};
    if (!isAdmin) {
        if (isSeller) {
            _sellerFilter = { sellerId: user?.id };
        } else if (user?.locationId) {
            // For Cashiers/Managers, get the seller from their location
            const loc = await prisma.storeLocation.findUnique({
                where: { id: user.locationId },
                select: { 
                    // @ts-ignore
                    sellerId: true 
                }
            });
            if ((loc as any)?.sellerId) {
                _sellerFilter = { sellerId: (loc as any).sellerId };
            }
        }
    }

    const results = await Promise.all([
        prisma.sale.aggregate({
            _sum: { total: true },
            where: {
                ..._locationFilter,
                ..._sellerFilter,
                createdAt: { gte: startOfToday },
                status: 'COMPLETED'
            }
        }),
        prisma.variant.aggregate({
            _sum: { stock: true },
            where: {
                product: {
                    ..._sellerFilter,
                    isActive: true,
                }
            }
        }),
        prisma.client.count({
            where: (user?.id ? { sellerId: user.id } : {}) as any
        }),
        prisma.sale.findMany({
            where: {
               ..._locationFilter,
               ..._sellerFilter,
               createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
            },
            orderBy: { createdAt: 'desc' },
            take: 300,
            include: {
                paymentMethod: true,
                items: {
                    include: { variant: { include: { product: true } } }
                },
                location: true,
                seller: true,
                salesperson: { select: { id: true, name: true } },
                cashSession: {
                    include: {
                        openedBy: { select: { id: true, name: true } }
                    }
                } as any
            }
        }),
        prisma.sale.findMany({
            where: {
                ..._locationFilter,
                ..._sellerFilter,
                createdAt: { gte: thirtyDaysAgo },
                status: 'COMPLETED'
            },
            select: {
                total: true,
                createdAt: true,
                items: {
                    include: {
                        variant: {
                            include: {
                                product: {
                                    include: { brand: true, category: true }
                                }
                            }
                        }
                    }
                }
            }
        }),
        prisma.saleItem.groupBy({
            by: ['variantId'],
            _sum: { quantity: true },
            where: {
                sale: {
                    ..._locationFilter,
                    ..._sellerFilter,
                    status: 'COMPLETED',
                    createdAt: { gte: sevenDaysAgo }
                }
            },
            orderBy: {
                _sum: { quantity: 'desc' },
            },
            take: 20
        }),
        prisma.variant.findMany({
            where: {
                product: { ..._sellerFilter, isActive: true },
                stock: { lt: 5, gt: 0 }
            },
            take: 10,
            include: { product: true },
            orderBy: { stock: 'asc' }
        }),
        prisma.order.aggregate({
            _count: { id: true },
            _sum: { 
                total: true,
                commissionAmount: true,
                sellerEarnings: true
            },
            where: {
                ..._sellerFilter,
                status: { in: ['ACCEPTED', 'COMPLETED', 'PENDING'] }
            }
        }),
        prisma.order.findMany({
            where: _sellerFilter,
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                items: true,
                buyer: { select: { name: true, businessName: true } }
            }
        })
    ]);

    const todaysSales = results[0] as any;
    const inventoryCount = results[1] as any;
    const clientsCount = results[2] as any;
    const recentSales = results[3] as any;
    const thirtyDaySalesRaw = results[4] as any;
    const topVariantsRaw = results[5] as any;
    const lowStockVariants = results[6] as any;
    const marketplaceMetrics = results[7] as any;
    const recentOrders = results[8] as any;

    // Calculate Category Distribution and 30-day Trend
    const categoryMap: Record<string, number> = {};
    const thirtyDayTrend = Array.from({length: 30}, (_, i) => {
        const d = new Date(nowMX);
        d.setDate(nowMX.getDate() - (29 - i));
        return {
            dateStr: d.toLocaleDateString('en-CA'), // YYYY-MM-DD in MX local
            dayName: d.toLocaleDateString('es-MX', { weekday: 'short' }),
            day: d.getDate(),
            total: 0
        };
    });

    (thirtyDaySalesRaw as any[]).forEach(sale => {
        // Trend — bucket by Mexico City date, not UTC
        const dStr = sale.createdAt.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        const bucket = thirtyDayTrend.find(b => b.dateStr === dStr);
        if (bucket) bucket.total += sale.total;

        // Categories
        sale.items.forEach((item: any) => {
            const catName = item.variant?.product?.category?.name || 'Otros';
            categoryMap[catName] = (categoryMap[catName] || 0) + (item.quantity * item.price);
        });
    });

    const categoryDistribution = Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    // Calculate Inventory Value and Top Brands from local data to save DB hits
    // Calcular valor de inventario desde Variant.stock (fuente de verdad)
    const variantsWithStock = await prisma.variant.findMany({
        where: {
            product: { ..._sellerFilter, isActive: true },
            stock: { gt: 0 }
        },
        select: {
            stock: true,
            product: { select: { price: true, cost: true } }
        }
    });
    const inventoryValue = variantsWithStock.reduce((acc, v) => {
        // Usar costo si existe, si no precio de venta
        const price = (v.product as any)?.cost || (v.product as any)?.price || 0;
        return acc + (v.stock * price);
    }, 0);

    // Top Brands (from raw sales)
    const brandSalesMap: Record<string, { name: string; totalRevenue: number }> = {};
    (thirtyDaySalesRaw as any[]).forEach(sale => {
        sale.items.forEach((item: any) => {
            const brand = item.variant?.product?.brand;
            if (brand) {
                if (!brandSalesMap[brand.id]) {
                    brandSalesMap[brand.id] = { name: brand.name, totalRevenue: 0 };
                }
                brandSalesMap[brand.id].totalRevenue += (item.quantity * item.price);
            }
        });
    });

    const topBrands = Object.values(brandSalesMap)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5);

    // Aggregate Top Products by Model
    const variantIds = (topVariantsRaw as any[]).map(v => v.variantId);
    const variantDetails = await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true }
    });

    const productSalesMap: Record<string, { name: string; totalSold: number; image: string | null }> = {};
    (topVariantsRaw as any[]).forEach(v => {
        const detail = variantDetails.find(d => d.id === v.variantId);
        if (detail && detail.product) {
            const pid = detail.product.id;
            if (!productSalesMap[pid]) {
                productSalesMap[pid] = {
                    name: detail.product.name,
                    totalSold: 0,
                    image: detail.product.images[0] || null
                };
            }
            productSalesMap[pid].totalSold += v._sum.quantity || 0;
        }
    });

    const topProducts = Object.values(productSalesMap)
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, 5);

    // Format data for the client component
    const formattedSales = recentSales.map((sale: any) => ({
        id: sale.id,
        receiptNumber: sale.receiptNumber,
        date: sale.createdAt,
        total: sale.total,
        subtotal: sale.subtotal,
        discount: sale.discount,
        paymentMethodName: sale.paymentMethod?.name || 'Desconocido',
        tierName: 'Aplicado', 
        clientName: 'Cliente General', 
        isReturn: sale.status === 'REFUNDED',
        isLayaway: sale.status === 'LAYAWAY',
        status: sale.status,
        amountPaid: sale.amountPaid,
        balance: sale.balance,
        dueDate: sale.dueDate,
        sellerName: sale.seller?.name || 'Sistema',
        locationName: sale.location?.name || 'General',
        cashierName: (sale as any).cashSession?.openedBy?.name || null,
        salespersonName: (sale as any).salesperson?.name || null,
        cart: sale.items.map((i: any) => ({
            name: `${i.variant.product.name} (${i.variant.color ?? ''} ${i.variant.size ?? ''})`.replace('()', '').trim(),
            quantity: i.quantity,
            price: i.price
        }))
    }));

    return (
        <DashboardClient 
            userName={user?.name || "Usuario"} 
            salesTotal={todaysSales._sum.total || 0}
            inventoryTotal={inventoryCount._sum.stock || 0}
            clientsTotal={clientsCount}
            weeklyChartData={thirtyDayTrend.slice(-7)} // Keep compatibility for now
            thirtyDayTrend={thirtyDayTrend}
            categoryDistribution={categoryDistribution}
            recentSales={formattedSales}
            userLocationName={user?.location?.name || "Todas las sucursales"}
            topProducts={topProducts}
            inventoryValue={inventoryValue}
            topBrands={topBrands}
            lowStock={lowStockVariants.map((ls: any) => ({
                name: ls.product?.name ?? ls.variant?.product?.name ?? '',
                color: ls.color ?? ls.variant?.color ?? "",
                size: ls.size ?? ls.variant?.size ?? "",
                stock: ls.stock
            }))}
            marketplaceOrdersCount={marketplaceMetrics?._count?.id || 0}
            marketplaceRevenue={marketplaceMetrics?._sum?.total || 0}
            marketplaceCommission={marketplaceMetrics?._sum?.commissionAmount || 0}
            marketplaceNet={marketplaceMetrics?._sum?.sellerEarnings || 0}
            recentOrders={recentOrders}
        />
    );
}

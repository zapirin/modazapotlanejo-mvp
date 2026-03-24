"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";

export interface ReportDateRange {
    startDate: Date;
    endDate: Date;
}

export async function getSalesReports({ startDate, endDate }: ReportDateRange) {
    try {
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
                if (loc?.sellerId) sellerFilter = { sellerId: loc.sellerId };
            }
        }

        // 1. Fetch all SALES in the date range that are completed
        const sales = await prisma.sale.findMany({
            where: {
                ...sellerFilter,
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
                status: "COMPLETED"
            },
            include: {
                items: {
                    include: {
                        variant: {
                            include: {
                                product: {
                                    include: {
                                        supplier: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // 2. Compute Global KPIs
        let totalRevenue = 0;
        let totalUnits = 0;
        const totalTickets = sales.length;

        // Maps to aggregate data
        const productMap = new Map<string, { id: string, name: string, quantity: number, revenue: number, image: string }>();
        const supplierMap = new Map<string, { id: string, name: string, quantity: number, revenue: number }>();

        // 3. Process each sale and its items
        sales.forEach((sale: any) => {
            totalRevenue += sale.total;

            sale.items.forEach((item: any) => {
                totalUnits += item.quantity;
                const lineRevenue = item.quantity * item.price;
                const product = item.variant?.product;
                
                if (product) {
                    // Aggregate by Product
                    if (productMap.has(product.id)) {
                        const existing = productMap.get(product.id)!;
                        existing.quantity += item.quantity;
                        existing.revenue += lineRevenue;
                    } else {
                        productMap.set(product.id, {
                            id: product.id,
                            name: product.name,
                            quantity: item.quantity,
                            revenue: lineRevenue,
                            image: product.images?.[0] || ''
                        });
                    }

                    // Aggregate by Supplier
                    const supplier = product.supplier;
                    const supplierId = supplier?.id || 'unknown';
                    const supplierName = supplier?.name || 'Sin Proveedor';

                    if (supplierMap.has(supplierId)) {
                        const existing = supplierMap.get(supplierId)!;
                        existing.quantity += item.quantity;
                        existing.revenue += lineRevenue;
                    } else {
                        supplierMap.set(supplierId, {
                            id: supplierId,
                            name: supplierName,
                            quantity: item.quantity,
                            revenue: lineRevenue
                        });
                    }
                }
            });
        });

        const averageTicket = totalTickets > 0 ? (totalRevenue / totalTickets) : 0;

        // 4. Sort Rankings (Descending order by Revenue)
        const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
        const topSuppliers = Array.from(supplierMap.values()).sort((a, b) => b.revenue - a.revenue);

        return {
            success: true,
            kpis: {
                totalRevenue,
                totalTickets,
                averageTicket,
                totalUnits
            },
            topProducts,
            topSuppliers
        };

    } catch (error: any) {
        console.error("Error generating report:", error);
        return { success: false, error: "No se pudo generar el reporte." };
    }
}

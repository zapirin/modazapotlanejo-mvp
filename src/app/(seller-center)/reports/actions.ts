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
        
        // Build seller/location isolation filter
        let sellerFilter: any = {};
        if (user?.role !== 'ADMIN') {
            if (user?.role === 'SELLER') {
                sellerFilter = { sellerId: user.id };
            } else if (user?.role === 'CASHIER') {
                const cashier = await (prisma.user as any).findUnique({
                    where: { id: user.id },
                    select: { allowedLocationIds: true }
                });
                const locIds: string[] = cashier?.allowedLocationIds || [];
                if (locIds.length > 0) sellerFilter = { locationId: { in: locIds } };
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

// ─── Cortes Z ──────────────────────────────────────────────────────────────
export async function getZCutsReport({ startDate, endDate }: ReportDateRange) {
    try {
        const user = await getSessionUser();

        let locationFilter: any = {};
        if (user?.role === 'SELLER') {
            locationFilter = { location: { sellerId: user.id } };
        } else if (user?.role === 'CASHIER') {
            const cashier = await (prisma.user as any).findUnique({
                where: { id: user.id },
                select: { allowedLocationIds: true }
            });
            const locIds: string[] = cashier?.allowedLocationIds || [];
            if (locIds.length > 0) locationFilter = { locationId: { in: locIds } };
        }
        // ADMIN: no filter

        const sessions = await prisma.cashRegisterSession.findMany({
            where: {
                ...locationFilter,
                status: 'CLOSED',
                closedAt: { gte: startDate, lte: endDate },
            },
            include: {
                location: { select: { id: true, name: true } },
                openedBy: { select: { id: true, name: true } },
                sales: {
                    where: { status: 'COMPLETED' },
                    include: { paymentMethod: { select: { id: true, name: true } } }
                },
                movements: true,
            },
            orderBy: { closedAt: 'desc' },
        });

        const rows = sessions.map(session => {
            const totalSales = session.sales.reduce((sum, s) => sum + s.total, 0);
            const totalTickets = session.sales.length;

            const byPayment: Record<string, { name: string; amount: number; count: number }> = {};
            session.sales.forEach(sale => {
                const pmName = sale.paymentMethod?.name || 'Sin método';
                if (!byPayment[pmName]) byPayment[pmName] = { name: pmName, amount: 0, count: 0 };
                byPayment[pmName].amount += sale.total;
                byPayment[pmName].count++;
            });

            const totalIn  = session.movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.amount, 0);
            const totalOut = session.movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.amount, 0);

            const cashSales = session.sales
                .filter(s => (s.paymentMethod?.name || '').toLowerCase().includes('efectivo'))
                .reduce((sum, s) => sum + s.total, 0);

            const expectedBalance = session.openingBalance + cashSales + totalIn - totalOut;
            const difference = (session.closingBalance ?? 0) - expectedBalance;

            return {
                id: session.id,
                openedAt: session.openedAt,
                closedAt: session.closedAt!,
                locationName: session.location?.name || 'Sin sucursal',
                cashierName: session.openedBy?.name || 'Desconocido',
                openingBalance: session.openingBalance,
                closingBalance: session.closingBalance ?? 0,
                totalSales,
                totalTickets,
                cashSales,
                totalIn,
                totalOut,
                expectedBalance,
                difference,
                salesByPayment: Object.values(byPayment),
            };
        });

        const totalSalesAll   = rows.reduce((s, r) => s + r.totalSales, 0);
        const totalTicketsAll = rows.reduce((s, r) => s + r.totalTickets, 0);

        return { success: true, rows, totalSalesAll, totalTicketsAll };
    } catch (error: any) {
        console.error('Error generating Z-cuts report:', error);
        return { success: false, error: 'No se pudo generar el reporte de cortes Z.' };
    }
}

// ─── Commission Report ──────────────────────────────────────────────────────
export async function getCommissionReport({ startDate, endDate, locationId }: {
    startDate: Date;
    endDate: Date;
    locationId?: string;
}) {
    try {
        const user = await getSessionUser();

        let sellerId: string | null = null;
        let cashierLocationIds: string[] | null = null;
        if (user?.role === 'SELLER') {
            sellerId = user.id;
        } else if (user?.role === 'CASHIER') {
            const cashier = await (prisma.user as any).findUnique({
                where: { id: user.id },
                select: { managedBySellerId: true, allowedLocationIds: true }
            });
            sellerId = cashier?.managedBySellerId || null;
            cashierLocationIds = cashier?.allowedLocationIds?.length > 0 ? cashier.allowedLocationIds : null;
        } else if (user?.role === 'ADMIN') {
            sellerId = null; // Admin ve todo
        }

        // Obtener vendedores de piso del seller
        const whereSpersons: any = { isActive: true };
        if (sellerId) whereSpersons.sellerId = sellerId;
        const allSalespeople = await (prisma as any).salesperson.findMany({
            where: whereSpersons,
            orderBy: { name: 'asc' },
        });

        // Obtener ventas del periodo con vendedor de piso asignado
        // Incluir items para contar piezas (necesario para comisión FIXED_PER_PIECE)
        const whereSales: any = {
            status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate },
            soldBySalespersonId: { not: null },
        };
        if (sellerId) whereSales.sellerId = sellerId;
        // Cajeros: solo ven su(s) sucursal(es); de lo contrario, aplicar filtro de UI
        if (cashierLocationIds) {
            whereSales.locationId = { in: cashierLocationIds };
        } else if (locationId) {
            whereSales.locationId = locationId;
        }

        const sales = await (prisma as any).sale.findMany({
            where: whereSales,
            select: {
                id: true,
                total: true,
                createdAt: true,
                soldBySalespersonId: true,
                items: { select: { quantity: true } },
                location: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Agrupar por vendedor de piso
        const spMap = new Map<string, {
            id: string; name: string; phone: string | null;
            commissionType: string; commissionValue: number;
            salesCount: number; totalSales: number; totalPieces: number; commissionAmount: number;
        }>();

        for (const sp of allSalespeople) {
            spMap.set(sp.id, {
                id: sp.id,
                name: sp.name,
                phone: sp.phone || null,
                commissionType: sp.commissionType || 'PERCENT',
                commissionValue: sp.commissionValue ?? 0,
                salesCount: 0,
                totalSales: 0,
                totalPieces: 0,
                commissionAmount: 0,
            });
        }

        for (const sale of sales) {
            const spId = sale.soldBySalespersonId;
            if (!spId) continue;
            if (!spMap.has(spId)) {
                // Vendedor desactivado: recuperar datos
                const sp = await (prisma as any).salesperson.findUnique({
                    where: { id: spId },
                    select: { id: true, name: true, phone: true, commissionType: true, commissionValue: true }
                });
                if (sp) spMap.set(spId, {
                    ...sp,
                    commissionType: sp.commissionType || 'PERCENT',
                    commissionValue: sp.commissionValue ?? 0,
                    salesCount: 0, totalSales: 0, totalPieces: 0, commissionAmount: 0
                });
            }
            const entry = spMap.get(spId);
            if (!entry) continue;
            const pieces = (sale.items as any[]).reduce((s: number, i: any) => s + i.quantity, 0);
            entry.salesCount++;
            entry.totalSales += sale.total;
            entry.totalPieces += pieces;
            if (entry.commissionType === 'FIXED_PER_PIECE') {
                entry.commissionAmount += pieces * entry.commissionValue;
            } else {
                entry.commissionAmount += (sale.total * entry.commissionValue) / 100;
            }
        }

        const rows = Array.from(spMap.values())
            .filter(r => r.salesCount > 0 || allSalespeople.some((s: any) => s.id === r.id))
            .sort((a, b) => b.commissionAmount - a.commissionAmount);

        const totalSales = rows.reduce((s, r) => s + r.totalSales, 0);
        const totalCommission = rows.reduce((s, r) => s + r.commissionAmount, 0);

        return { success: true, rows, totalSales, totalCommission };
    } catch (error: any) {
        console.error("Error generating commission report:", error);
        return { success: false, error: "No se pudo generar el reporte de comisiones." };
    }
}

// ─── Permisos del usuario para reportes ────────────────────────────────────
export async function getReportPermissions() {
    try {
        const user = await getSessionUser();
        if (!user) return { role: null, canViewReports: false, canViewCommissions: false, canViewZCuts: false };

        if (user.role === 'SELLER' || user.role === 'ADMIN') {
            return { role: user.role, canViewReports: true, canViewCommissions: true, canViewZCuts: true };
        }

        if (user.role === 'CASHIER') {
            const cashier = await (prisma.user as any).findUnique({
                where: { id: user.id },
                select: { canViewReports: true, canViewCommissions: true, canViewZCuts: true }
            });
            return {
                role: 'CASHIER',
                canViewReports: cashier?.canViewReports ?? false,
                canViewCommissions: cashier?.canViewCommissions ?? false,
                canViewZCuts: cashier?.canViewZCuts ?? false,
            };
        }

        return { role: user.role, canViewReports: false, canViewCommissions: false, canViewZCuts: false };
    } catch {
        return { role: null, canViewReports: false, canViewCommissions: false, canViewZCuts: false };
    }
}

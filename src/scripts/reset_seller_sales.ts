/**
 * Reset all sales data for Kalexa Fashion seller.
 * Deletes: SaleItems, LayawayPayments, Sales, CashMovements, 
 *          StoreAccountPayments, CashRegisterSessions, InventoryMovements
 * Does NOT delete: Products, Variants, Categories, Brands, etc.
 * 
 * Usage: npx ts-node --compiler-options '{"module":"commonjs"}' src/scripts/reset_seller_sales.ts
 */

import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

async function main() {
    // Find the Kalexa Fashion seller
    const seller = await prisma.user.findFirst({
        where: {
            role: 'SELLER',
            OR: [
                { businessName: { contains: 'Kalexa', mode: 'insensitive' } },
                { name: { contains: 'Kalexa', mode: 'insensitive' } },
            ]
        },
        select: { id: true, name: true, businessName: true }
    });

    if (!seller) {
        console.error('❌ No se encontró al vendedor Kalexa Fashion');
        process.exit(1);
    }

    console.log(`\n🔍 Vendedor encontrado: ${seller.businessName || seller.name} (ID: ${seller.id})\n`);

    // Count current data
    const salesCount = await prisma.sale.count({ where: { sellerId: seller.id } });
    const sessionsCount = await prisma.cashRegisterSession.count({
        where: { openedBy: { id: seller.id } }
    });

    console.log(`📊 Datos actuales:`);
    console.log(`   - Ventas: ${salesCount}`);
    console.log(`   - Sesiones de caja: ${sessionsCount}`);
    console.log('');

    if (salesCount === 0 && sessionsCount === 0) {
        console.log('✅ Ya está en 0. No hay nada que borrar.');
        process.exit(0);
    }

    // Get all sale IDs for this seller
    const saleIds = (await prisma.sale.findMany({
        where: { sellerId: seller.id },
        select: { id: true }
    })).map(s => s.id);

    // Get all session IDs opened by this seller or their cashiers
    const cashierIds = (await prisma.user.findMany({
        where: { managedBySellerId: seller.id },
        select: { id: true }
    })).map(c => c.id);

    const allUserIds = [seller.id, ...cashierIds];

    const sessionIds = (await prisma.cashRegisterSession.findMany({
        where: { openedById: { in: allUserIds } },
        select: { id: true }
    })).map(s => s.id);

    console.log(`🗑️  Eliminando datos de ventas...`);

    // 1. Delete LayawayPayments (child of Sale)
    const delLayaway = await prisma.layawayPayment.deleteMany({
        where: { saleId: { in: saleIds } }
    });
    console.log(`   ✓ LayawayPayments eliminados: ${delLayaway.count}`);

    // 2. Delete SaleItems (child of Sale, onDelete: Cascade should handle but being explicit)
    const delItems = await prisma.saleItem.deleteMany({
        where: { saleId: { in: saleIds } }
    });
    console.log(`   ✓ SaleItems eliminados: ${delItems.count}`);

    // 3. Delete Sales
    const delSales = await prisma.sale.deleteMany({
        where: { sellerId: seller.id }
    });
    console.log(`   ✓ Ventas eliminadas: ${delSales.count}`);

    // 4. Delete StoreAccountPayments linked to sessions
    if (sessionIds.length > 0) {
        const delStorePayments = await prisma.storeAccountPayment.deleteMany({
            where: { cashSessionId: { in: sessionIds } }
        });
        console.log(`   ✓ StoreAccountPayments eliminados: ${delStorePayments.count}`);
    }

    // 5. Delete CashMovements (child of CashRegisterSession)
    if (sessionIds.length > 0) {
        const delMovements = await prisma.cashMovement.deleteMany({
            where: { sessionId: { in: sessionIds } }
        });
        console.log(`   ✓ CashMovements eliminados: ${delMovements.count}`);
    }

    // 6. Delete CashRegisterSessions
    if (sessionIds.length > 0) {
        const delSessions = await prisma.cashRegisterSession.deleteMany({
            where: { id: { in: sessionIds } }
        });
        console.log(`   ✓ Sesiones de caja eliminadas: ${delSessions.count}`);
    }

    // 7. Delete InventoryMovements for this seller's variants
    const variantIds = (await prisma.variant.findMany({
        where: { product: { sellerId: seller.id } },
        select: { id: true }
    })).map(v => v.id);

    if (variantIds.length > 0) {
        const delInvMov = await prisma.inventoryMovement.deleteMany({
            where: { variantId: { in: variantIds } }
        });
        console.log(`   ✓ InventoryMovements eliminados: ${delInvMov.count}`);
    }

    console.log(`\n✅ ¡Listo! Todas las ventas de ${seller.businessName || seller.name} han sido eliminadas.`);
    console.log(`   Los productos NO fueron tocados.\n`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());

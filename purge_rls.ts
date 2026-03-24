import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting RLS activation...");

    const tables = [
        "StoreSettings",
        "StoreLocation",
        "User",
        "Category",
        "Subcategory",
        "Brand",
        "Product",
        "Variant",
        "Supplier",
        "Tag",
        "InventoryLevel",
        "InventoryMovement",
        "Client",
        "PriceTier",
        "PaymentMethod",
        "CashRegisterSession",
        "CashMovement",
        "Sale",
        "LayawayPayment",
        "SaleItem",
        "StoreAccountPayment",
        "PhotographyRequest"
    ];

    for (const table of tables) {
        try {
            console.log(`🔒 Enabling RLS for table: ${table}...`);
            // We use double quotes for table names in case they are case-sensitive in Postgres
            await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
            console.log(`✅ RLS enabled for ${table}`);
        } catch (error: any) {
            console.error(`❌ Error enabling RLS for ${table}:`, error.message);
        }
    }

    console.log("🏁 RLS activation finished.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

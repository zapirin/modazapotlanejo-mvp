import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

async function getEffectiveUser() {
    const cookieStore = await cookies();
    const userId = cookieStore.get('session_user_id')?.value;
    if (!userId) return null;
    return await prisma.user.findUnique({
        where: { id: userId },
        include: { location: true }
    });
}

export async function GET(request: NextRequest) {
    try {
        const user = await getEffectiveUser();
        if (!user) return NextResponse.json([], { status: 401 });

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        const categoryId = searchParams.get('categoryId') || '';
        const brandId = searchParams.get('brandId') || '';
        const supplierId = searchParams.get('supplierId') || '';
        const all = searchParams.get('all') === 'true';

        const sellerFilter = user.role === 'ADMIN' ? {} : { sellerId: user.id };

        const where: any = { isActive: true, ...sellerFilter };
        if (search) {
            const normalized = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            // Use PostgreSQL translate() for true accent-insensitive search
            const matchingIds: { id: string }[] = await prisma.$queryRawUnsafe(
                `SELECT id FROM "Product" WHERE "isActive" = true AND (
                    translate(lower(name), 'áéíóúñàèìòùâêîôûäëïöü', 'aeiounaeiouaeiouaeiou') LIKE $1
                    OR lower(sku) LIKE $1
                )`,
                `%${normalized}%`
            );
            where.id = { in: matchingIds.map(r => r.id) };
        }
        if (categoryId) where.categoryId = categoryId;
        if (brandId) where.brandId = brandId;
        if (supplierId) where.supplierId = supplierId;

        if (all) {
            const products = await (prisma.product as any).findMany({
                where,
                include: {
                    variants: {
                        include: {
                            inventoryLevels: { include: { location: { select: { id: true, name: true } } } }
                        }
                    },
                    category: true,
                    subcategory: true,
                    brand: true,
                    supplier: true,
                },
                orderBy: { createdAt: 'desc' }
            });
            return NextResponse.json(products);
        }

        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            (prisma.product as any).findMany({
                where,
                include: {
                    variants: {
                        include: {
                            inventoryLevels: { include: { location: { select: { id: true, name: true } } } }
                        }
                    },
                    category: true,
                    subcategory: true,
                    brand: true,
                    supplier: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            (prisma.product as any).count({ where }),
        ]);

        return NextResponse.json({
            products,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('Inventory error:', error);
        return NextResponse.json([], { status: 500 });
    }
}

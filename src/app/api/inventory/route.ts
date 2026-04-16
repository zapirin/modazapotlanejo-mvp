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
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (categoryId) where.categoryId = categoryId;
        if (brandId) where.brandId = brandId;
        if (supplierId) where.supplierId = supplierId;

        if (all) {
            const products = await (prisma.product as any).findMany({
                where,
                include: {
                    variants: { include: { inventoryLevels: true } },
                    category: true,
                    subcategory: true,
                    brand: true,
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
                    variants: { include: { inventoryLevels: true } },
                    category: true,
                    subcategory: true,
                    brand: true,
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

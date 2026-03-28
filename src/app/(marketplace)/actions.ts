"use server";

import { prisma } from '@/lib/prisma';

export async function getProducts(filters: { 
    category?: string;
    subcategory?: string;
    brand?: string;
    seller?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    limit?: number;
    offset?: number;
    onlyWithStock?: boolean;
    priceType?: 'all' | 'wholesale' | 'retail';
}) {
    try {
        const where: any = { isOnline: true, isActive: true };

        if (filters.category) {
            where.category = { slug: filters.category };
        }

        if (filters.subcategory) {
            where.subcategory = { slug: filters.subcategory };
        }

        if (filters.brand) {
            where.brandId = filters.brand;
        }

        if (filters.seller) {
            where.sellerId = filters.seller;
        }

        // Búsqueda mejorada: busca en nombre, descripción, marca y categoría
        if (filters.search) {
            const term = filters.search.trim();
            where.OR = [
                { name: { contains: term, mode: 'insensitive' } },
                { description: { contains: term, mode: 'insensitive' } },
                { brand: { name: { contains: term, mode: 'insensitive' } } },
                { category: { name: { contains: term, mode: 'insensitive' } } },
                { subcategory: { name: { contains: term, mode: 'insensitive' } } },
                { tags: { some: { name: { contains: term, mode: 'insensitive' } } } },
            ];
        }

        if (filters.minPrice || filters.maxPrice) {
            where.price = {};
            if (filters.minPrice) where.price.gte = filters.minPrice;
            if (filters.maxPrice) where.price.lte = filters.maxPrice;
        }

        // Filtro por tipo de precio
        // Mayoreo = productos con composición de corridas/paquetes/cajas (wholesaleComposition)
        if (filters.priceType === 'wholesale') {
            where.sellByPackage = true;
        } else if (filters.priceType === 'retail') {
            where.sellByPackage = false;
        }

        // Filtro: solo productos con stock disponible
        if (filters.onlyWithStock) {
            where.variants = {
                some: { stock: { gt: 0 } }
            };
        }

        let orderBy: any = { createdAt: 'desc' };
        if (filters.sort === 'price_asc') orderBy = { price: 'asc' };
        if (filters.sort === 'price_desc') orderBy = { price: 'desc' };
        if (filters.sort === 'name_asc') orderBy = { name: 'asc' };
        if (filters.sort === 'name_desc') orderBy = { name: 'desc' };
        if (filters.sort === 'oldest') orderBy = { createdAt: 'asc' };
        if (filters.sort === 'newest') orderBy = { createdAt: 'desc' };
        // Más vendido: ordenar por cantidad de sales items
        if (filters.sort === 'best_selling') orderBy = { sales: { _count: 'desc' } };

        const PAGE_SIZE = filters.limit || 24;

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                take: PAGE_SIZE,
                skip: filters.offset || 0,
                include: {
                    brand: true,
                    category: true,
                    subcategory: true,
                    tags: true,
                    variants: { select: { id: true, stock: true } },
                    // @ts-ignore
                    seller: { select: { id: true, name: true, businessName: true, logoUrl: true } },
                }
            }),
            prisma.product.count({ where }),
        ]);

        return { products, total, pageSize: PAGE_SIZE };
    } catch (error) {
        console.error("Error fetching products:", error);
        return { products: [], total: 0, pageSize: 24 };
    }
}

export async function getBrandsWithCounts() {
    try {
        return await prisma.brand.findMany({
            include: {
                _count: {
                    select: { products: true }
                }
            },
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        return [];
    }
}

export async function getBrands() {
    try {
        return await prisma.brand.findMany({
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        return [];
    }
}

export async function getLatestProducts(limit = 8) {
    const result = await getProducts({ limit });
    return result.products;
}

export async function getNewArrivals(limit = 4) {
    const result = await getProducts({ limit, sort: 'createdAt_desc' });
    return result.products;
}

export async function getBestSellers(limit = 4) {
    try {
        // Simple popularity based on wishlist count or just latest for now if order data is low
        const products = await prisma.product.findMany({
            where: { isOnline: true, isActive: true },
            orderBy: {
                // @ts-ignore
                wishlists: { _count: 'desc' }
            },
            take: limit,
            include: {
                brand: true,
                category: true,
                subcategory: true,
                // @ts-ignore
                seller: { select: { id: true, name: true, businessName: true, logoUrl: true } },
            }
        });
        return products;
    } catch (error) {
        return getLatestProducts(limit);
    }
}

export async function getFeaturedCategories() {
    return getCategories();
}

export async function getCategories() {
    try {
        const CATEGORY_ORDER = ['Damas', 'Caballeros', 'Niños', 'Accesorios', 'Calzado'];
        const cats = await prisma.category.findMany({
            include: {
                subcategories: { orderBy: { name: 'asc' } },
                _count: { select: { products: true } }
            },
        });
        // Ordenar según el orden definido
        return cats.sort((a: any, b: any) => {
            const ia = CATEGORY_ORDER.indexOf(a.name);
            const ib = CATEGORY_ORDER.indexOf(b.name);
            if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
    } catch (error) {
        return [];
    }
}

export async function getProductDetail(id: string) {
    try {
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                brand: true,
                category: true,
                subcategory: true,
                variants: { orderBy: { createdAt: 'asc' } },
                // @ts-ignore
                seller: { select: { id: true, name: true, businessName: true, logoUrl: true } },
            }
        });
        return product;
    } catch (error) {
        console.error("Error fetching product detail:", error);
        return null;
    }
}

export async function searchProducts(query: string) {
    if (!query || query.length < 2) return { products: [], categories: [], vendors: [] };
    try {
        const [products, categories, vendors] = await Promise.all([
            prisma.product.findMany({
                where: {
                    isOnline: true, isActive: true,
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { description: { contains: query, mode: 'insensitive' } },
                    ]
                },
                take: 5,
                select: { id: true, name: true, price: true, wholesalePrice: true, images: true, category: { select: { name: true } } }
            }),
            prisma.category.findMany({
                where: { name: { contains: query, mode: 'insensitive' } },
                take: 3,
                select: { id: true, name: true, slug: true }
            }),
            prisma.user.findMany({
                where: {
                    // @ts-ignore
                    role: 'SELLER' as any, isActive: true,
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        // @ts-ignore
                        { businessName: { contains: query, mode: 'insensitive' } },
                    ]
                },
                take: 3,
                // @ts-ignore
                select: { id: true, name: true, businessName: true }
            })
        ]);
        return { products, categories, vendors };
    } catch (error) {
        console.error("Error searching:", error);
        return { products: [], categories: [], vendors: [] };
    }
}

// ---------------------------------------------------------------------------
// NIVELES DE PRECIO PARA MARKETPLACE
// ---------------------------------------------------------------------------

export async function getMarketplacePriceTiers(sellerId: string) {
    try {
        const tiers = await (prisma.priceTier as any).findMany({
            where: {
                sellerId,
                autoApplyMarketplace: true,
            },
            orderBy: { order: 'asc' }
        });
        return tiers;
    } catch (error) {
        console.error("Error fetching marketplace price tiers:", error);
        return [];
    }
}

// ---------------------------------------------------------------------------
// PRODUCTOS ANTERIOR / SIGUIENTE (para navegación en detalle)
// ---------------------------------------------------------------------------

export async function getAdjacentProducts(productId: string) {
    try {
        const current = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, createdAt: true, categoryId: true }
        });
        if (!current) return { prev: null, next: null };

        const baseWhere: any = { isOnline: true, isActive: true };
        // If the product has a category, navigate within that category
        if (current.categoryId) {
            baseWhere.categoryId = current.categoryId;
        }

        const [prevProduct, nextProduct] = await Promise.all([
            prisma.product.findFirst({
                where: {
                    ...baseWhere,
                    createdAt: { lt: current.createdAt },
                },
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, images: true }
            }),
            prisma.product.findFirst({
                where: {
                    ...baseWhere,
                    createdAt: { gt: current.createdAt },
                },
                orderBy: { createdAt: 'asc' },
                select: { id: true, name: true, images: true }
            })
        ]);

        return {
            prev: prevProduct ? { id: prevProduct.id, name: prevProduct.name, image: (prevProduct.images as string[])?.[0] || null } : null,
            next: nextProduct ? { id: nextProduct.id, name: nextProduct.name, image: (nextProduct.images as string[])?.[0] || null } : null,
        };
    } catch (error) {
        console.error("Error fetching adjacent products:", error);
        return { prev: null, next: null };
    }
}

export async function getLandingStats() {
    try {
        const [totalSellers, totalProducts, newThisWeek, totalOrders] = await Promise.all([
            prisma.user.count({ where: { role: 'SELLER', isActive: true } }),
            prisma.product.count({ where: { isOnline: true, isActive: true } }),
            prisma.product.count({
                where: {
                    isOnline: true, isActive: true,
                    createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            }),
            prisma.order.count({ where: { status: { in: ['COMPLETED', 'SHIPPED', 'ACCEPTED'] } } }),
        ]);
        return { totalSellers, totalProducts, newThisWeek, totalOrders };
    } catch {
        return { totalSellers: 0, totalProducts: 0, newThisWeek: 0, totalOrders: 0 };
    }
}

export async function getProductImages(productIds: string[]): Promise<Record<string, string>> {
    if (!productIds.length) return {};
    try {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, images: true },
        });
        const map: Record<string, string> = {};
        for (const p of products) {
            const imgs = p.images as string[];
            if (imgs?.[0]) {
                // Si la imagen es base64 (empieza con data:), devolver un placeholder
                // para no saturar. Si es URL normal, devolver tal cual.
                map[p.id] = imgs[0].startsWith('data:') ? imgs[0] : imgs[0];
            }
        }
        return map;
    } catch { return {}; }
}

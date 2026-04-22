"use server";

import { prisma } from '@/lib/prisma';
import { getBrandConfig, mergeBrandWithDB } from '@/lib/brand';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMap = any;

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
    sellerId?: string;
    color?: string;
    size?: string;
}) {
    try {
        const where: AnyMap = { isOnline: true, isActive: true };

        // Filter by seller for single-vendor stores
        if (filters.sellerId) {
            where.sellerId = filters.sellerId;
        }

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

        // Búsqueda mejorada: nombre, descripción, marca, categoría, SKU y variantes
        if (filters.search) {
            const term = filters.search.trim();
            where.OR = [
                { name: { contains: term, mode: 'insensitive' } },
                { description: { contains: term, mode: 'insensitive' } },
                { sku: { contains: term, mode: 'insensitive' } },
                { brand: { name: { contains: term, mode: 'insensitive' } } },
                { category: { name: { contains: term, mode: 'insensitive' } } },
                { subcategory: { name: { contains: term, mode: 'insensitive' } } },
                { tags: { some: { name: { contains: term, mode: 'insensitive' } } } },
                { variants: { some: { color: { contains: term, mode: 'insensitive' } } } },
                { variants: { some: { size: { contains: term, mode: 'insensitive' } } } },
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

        // Filtro por variante: stock, color, talla (unificados para no conflicto)
        const variantFilter: AnyMap = {};
        if (filters.onlyWithStock) variantFilter.stock = { gt: 0 };
        if (filters.color) variantFilter.color = { contains: filters.color, mode: 'insensitive' };
        if (filters.size)  variantFilter.size  = { contains: filters.size,  mode: 'insensitive' };
        if (Object.keys(variantFilter).length > 0) {
            where.variants = { some: variantFilter };
        }

        let orderBy: AnyMap = { createdAt: 'desc' };
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
                    seller: { select: { id: true, name: true, businessName: true, logoUrl: true, sellerSlug: true } },
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

export async function getBrands(sellerId?: string) {
    try {
        const where: AnyMap = {
            products: {
                some: sellerId
                    ? { sellerId, isOnline: true, isActive: true }
                    : { isOnline: true, isActive: true }
            }
        };
        return await prisma.brand.findMany({
            where,
            include: {
                _count: {
                    select: { 
                        products: { 
                            where: sellerId ? { sellerId, isOnline: true, isActive: true } : { isOnline: true, isActive: true } 
                        } 
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        return [];
    }
}

export async function getLatestProducts(limit = 8, sellerId?: string) {
    const result = await getProducts({ limit, sellerId });
    return result.products;
}

export async function getNewArrivals(limit = 4, sellerId?: string) {
    const result = await getProducts({ limit, sort: 'createdAt_desc', sellerId });
    return result.products;
}

export async function getBestSellers(limit = 4, sellerId?: string) {
    try {
        const where: AnyMap = { isOnline: true, isActive: true };
        if (sellerId) where.sellerId = sellerId;
        const products = await prisma.product.findMany({
            where,
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
                seller: { select: { id: true, name: true, businessName: true, logoUrl: true, sellerSlug: true } },
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

export async function getCategories(sellerId?: string) {
    try {
        const CATEGORY_ORDER = ['DAMAS', 'CABALLEROS', 'NIÑOS', 'ACCESORIOS', 'CALZADO'];
        const productFilter = sellerId
            ? { sellerId, isOnline: true, isActive: true }
            : { isOnline: true, isActive: true };

        const cats = await prisma.category.findMany({
            where: { products: { some: productFilter } },
            include: {
                subcategories: {
                    where: { products: { some: productFilter } },
                    orderBy: { name: 'asc' }
                },
                _count: {
                    select: { products: { where: productFilter } }
                }
            },
        });
        // Ordenar según el orden definido
        return cats.sort((a: AnyMap, b: AnyMap) => {
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

export async function getProductDetail(slugOrId: string) {
    try {
        const include = {
            brand: true,
            category: true,
            subcategory: true,
            variants: { orderBy: { createdAt: 'asc' } },
            // @ts-ignore
            seller: { select: { id: true, name: true, businessName: true, logoUrl: true, sellerSlug: true } },
        };
        // Try slug first, then fall back to ID for backwards compatibility
        let product = await (prisma.product as any).findUnique({ where: { slug: slugOrId }, include });
        if (!product) {
            product = await (prisma.product as any).findUnique({ where: { id: slugOrId }, include });
        }
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
        // Accept slug or id
        let current = await (prisma.product as any).findUnique({ where: { slug: productId }, select: { id: true, createdAt: true, categoryId: true } });
        if (!current) current = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, createdAt: true, categoryId: true } });
        if (!current) return { prev: null, next: null };

        const baseWhere: AnyMap = { isOnline: true, isActive: true };
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
                select: { id: true, slug: true, name: true, images: true } as any
            }),
            prisma.product.findFirst({
                where: {
                    ...baseWhere,
                    createdAt: { gt: current.createdAt },
                },
                orderBy: { createdAt: 'asc' },
                select: { id: true, slug: true, name: true, images: true } as any
            })
        ]);

        return {
            prev: prevProduct ? { id: (prevProduct as any).slug || (prevProduct as any).id, name: (prevProduct as any).name, image: ((prevProduct as any).images as string[])?.[0] || null } : null,
            next: nextProduct ? { id: (nextProduct as any).slug || (nextProduct as any).id, name: (nextProduct as any).name, image: ((nextProduct as any).images as string[])?.[0] || null } : null,
        };
    } catch (error) {
        console.error("Error fetching adjacent products:", error);
        return { prev: null, next: null };
    }
}

export async function getLandingStats(sellerId?: string) {
    try {
        const productWhere: AnyMap = { isOnline: true, isActive: true };
        const newProductWhere: AnyMap = {
            isOnline: true, isActive: true,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        };
        if (sellerId) {
            productWhere.sellerId = sellerId;
            newProductWhere.sellerId = sellerId;
        }
        const [totalSellers, totalProducts, newThisWeek, totalOrders] = await Promise.all([
            sellerId ? 1 : prisma.user.count({ where: { role: 'SELLER', isActive: true } }),
            prisma.product.count({ where: productWhere }),
            prisma.product.count({ where: newProductWhere }),
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

export async function getActiveBrandConfig(host: string | null) {
    const baseConfig = getBrandConfig(host);
    
    try {
        if (!host) return baseConfig;
        
        const cleanHost = host.split(':')[0].toLowerCase().replace(/^www\./, '');
        // Si es el subdominio de preview de Kalexa, buscar por kalexafashion.com en la BD
        const lookupHost = cleanHost.includes('kalexa.modazapotlanejo') ? 'kalexafashion.com' : cleanHost;
        
        const dbBrand = await prisma.brandConfig.findFirst({
            where: { 
                domain: { contains: lookupHost, mode: 'insensitive' },
                isActive: true
            }
        });
        
        if (dbBrand) {
            // Para dominios dinámicos (no en config estática), construir base desde cero
            const isKnownStaticDomain = ['modazapotlanejo.com','zonadelvestir.com','kalexafashion.com'].some(d => cleanHost.includes(d.split('.')[0]));
            const effectiveBase = isKnownStaticDomain ? baseConfig : {
                ...baseConfig,
                domain: dbBrand.domain,
                name: dbBrand.name,
                tagline: dbBrand.tagline || '',
                description: dbBrand.description || '',
                footerDescription: dbBrand.description || '',
                primaryColor: dbBrand.primaryColor || 'blue',
                isSingleVendor: dbBrand.isSingleVendor ?? false,
                sellerId: dbBrand.sellerId || undefined,
                logo: { text: dbBrand.name.toUpperCase(), initial: dbBrand.name.charAt(0).toUpperCase(), url: dbBrand.logoUrl || '/logo_modazapo.png' },
            };
            return mergeBrandWithDB(effectiveBase, dbBrand);
        }

        return baseConfig;
    } catch (error) {
        console.error('Error fetching brand config from DB:', error);
        return baseConfig;
    }
}

// ---------------------------------------------------------------------------
// DATOS DE TRANSFERENCIA DEL VENDEDOR (para el carrito)
// ---------------------------------------------------------------------------

export async function getRelatedProducts(categoryId: string, excludeId: string, limit = 4, sellerId?: string) {
    try {
        const where: AnyMap = { isOnline: true, isActive: true, categoryId, id: { not: excludeId } };
        if (sellerId) where.sellerId = sellerId;
        return await prisma.product.findMany({
            where,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                brand: true,
                category: true,
                variants: { select: { id: true, stock: true } },
                // @ts-ignore
                seller: { select: { id: true, name: true, businessName: true, sellerSlug: true } },
            },
        });
    } catch { return []; }
}

export async function getAvailableVariantOptions(sellerId?: string) {
    try {
        const productWhere: AnyMap = { isOnline: true, isActive: true };
        if (sellerId) productWhere.sellerId = sellerId;
        const [colors, sizes] = await Promise.all([
            prisma.variant.findMany({
                where: { color: { not: null }, product: productWhere },
                select: { color: true },
                distinct: ['color'],
                orderBy: { color: 'asc' },
            }),
            prisma.variant.findMany({
                where: { size: { not: null }, product: productWhere },
                select: { size: true },
                distinct: ['size'],
                orderBy: { size: 'asc' },
            }),
        ]);
        return {
            colors: colors.map((v: AnyMap) => v.color!).filter(Boolean),
            sizes:  sizes.map((v: AnyMap) => v.size!).filter(Boolean),
        };
    } catch { return { colors: [], sizes: [] }; }
}

export async function getSellerTransferSettings(sellerId: string): Promise<{
    acceptsTransfer: boolean;
    transferBank?: string;
    transferAccountHolder?: string;
    transferCLABE?: string;
    transferAccountNumber?: string;
    transferInstructions?: string;
}> {
    try {
        const settings = await (prisma.storeSettings as any).findUnique({
            where: { sellerId },
            select: {
                acceptsTransfer:       true,
                transferBank:          true,
                transferAccountHolder: true,
                transferCLABE:         true,
                transferAccountNumber: true,
                transferInstructions:  true,
            },
        });
        return {
            acceptsTransfer:       settings?.acceptsTransfer       ?? false,
            transferBank:          settings?.transferBank          ?? undefined,
            transferAccountHolder: settings?.transferAccountHolder ?? undefined,
            transferCLABE:         settings?.transferCLABE         ?? undefined,
            transferAccountNumber: settings?.transferAccountNumber ?? undefined,
            transferInstructions:  settings?.transferInstructions  ?? undefined,
        };
    } catch {
        return { acceptsTransfer: false };
    }
}

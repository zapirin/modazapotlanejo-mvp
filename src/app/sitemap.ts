import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getBrandConfig } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const headersList = await headers();
    const host = (headersList.get('host') || 'modazapotlanejo.com').split(',')[0].trim().replace(/^https?:\/\//, '');
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const brand = getBrandConfig(host);
    const now = new Date();

    // Filtro por vendedor para tiendas single-vendor (Kalexa)
    const sellerFilter = brand.isSingleVendor && brand.sellerId
        ? { sellerId: brand.sellerId }
        : {};

    // Páginas estáticas
    const staticPages: MetadataRoute.Sitemap = [
        { url: baseUrl,                    lastModified: now, changeFrequency: 'daily',  priority: 1.0 },
        { url: `${baseUrl}/catalog`,       lastModified: now, changeFrequency: 'daily',  priority: 0.9 },
        { url: `${baseUrl}/categories`,    lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${baseUrl}/brands`,        lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        ...(!brand.isSingleVendor ? [
            { url: `${baseUrl}/vendors`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 } as const,
        ] : []),
    ];

    try {
        // Productos activos
        const products = await prisma.product.findMany({
            where: { isOnline: true, isActive: true, ...sellerFilter },
            select: { slug: true, id: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
        });

        const productPages: MetadataRoute.Sitemap = products.map(p => ({
            url: `${baseUrl}/catalog/${(p as any).slug || p.id}`,
            lastModified: p.updatedAt,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        }));

        // Categorías
        const categories = await prisma.category.findMany({
            where: brand.isSingleVendor && brand.sellerId
                ? { products: { some: { sellerId: brand.sellerId, isOnline: true, isActive: true } } }
                : {},
            select: { slug: true, updatedAt: true },
        });

        const categoryPages: MetadataRoute.Sitemap = categories.map(c => ({
            url: `${baseUrl}/catalog?category=${c.slug}`,
            lastModified: c.updatedAt,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        }));

        // Vendedores (solo para marketplaces multi-vendor)
        const vendorPages: MetadataRoute.Sitemap = [];
        if (!brand.isSingleVendor) {
            const vendors = await (prisma.user as any).findMany({
                where: { role: 'SELLER', isActive: true, sellerSlug: { not: null } },
                select: { sellerSlug: true, updatedAt: true },
            });
            vendorPages.push(...vendors.map((v: any) => ({
                url: `${baseUrl}/vendor/${v.sellerSlug}`,
                lastModified: v.updatedAt,
                changeFrequency: 'weekly' as const,
                priority: 0.7,
            })));
        }

        return [...staticPages, ...productPages, ...categoryPages, ...vendorPages];
    } catch {
        return staticPages;
    }
}

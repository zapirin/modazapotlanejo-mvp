import React from 'react';
import { notFound } from 'next/navigation';
import { getProductDetail, getAdjacentProducts, getRelatedProducts } from '../../actions';
import ProductDetailClient from './ProductDetailClient';
import { getSessionUser } from '@/app/actions/auth';
import { headers } from 'next/headers';
import { getBrandConfig, getCanonicalBase } from '@/lib/brand';
import { getMarketplaceSettings } from '@/app/actions/marketplace';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const product = await getProductDetail(slug);
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = getBrandConfig(host);
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    if (!product) return { title: 'Producto no encontrado' };

    const hasStock = (product.variants as any[])?.some((v: any) =>
        (v.inventoryLevels as any[])?.some((il: any) => (il.stock ?? 0) > 0)
    );

    const image = (product.images as string[])?.[0] || null;
    // La descripcion de la BD puede traer HTML del editor, saltos de linea o ser
    // demasiado corta para servir como meta description: se limpia y, si no queda
    // texto util, se arma una a partir de los datos del producto.
    const cleanDescription = (product.description || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    const description = cleanDescription.length < 50
        ? `${product.name} — ${product.category?.name || 'Ropa'}. Disponible en ${brand.name}. Zapotlanejo, Jalisco.`
        : cleanDescription.length <= 155
            ? cleanDescription
            : cleanDescription.slice(0, 155).replace(/\s+\S*$/, '') + '…';

    return {
        title: product.name,
        description,
        keywords: [
            product.name,
            product.brand?.name,
            product.category?.name,
            product.subcategory?.name,
            brand.name,
            'Zapotlanejo',
            'ropa moda',
        ].filter(Boolean) as string[],
        openGraph: {
            title: `${product.name} | ${brand.name}`,
            description,
            url: `${baseUrl}/catalog/${slug}`,
            type: 'website',
            siteName: brand.name,
            locale: 'es_MX',
            images: image ? [{ url: image, width: 800, height: 800, alt: product.name }] : [],
        },
        twitter: {
            card: 'summary_large_image',
            title: `${product.name} | ${brand.name}`,
            description,
            images: image ? [image] : [],
        },
        alternates: { canonical: `${getCanonicalBase(host, brand)}/catalog/${slug}` },
        ...(!hasStock ? { robots: { index: false, follow: true } } : {}),
    };
}

export default async function ProductPage({
    params,
}: {
    params: { slug: string };
}) {
    // Resolve params if they are promises (Next.js 15 behavior)
    const resolvedParams = await params;

    const [product, user, adjacentProducts, mktSettings] = await Promise.all([
        getProductDetail(resolvedParams.slug),
        getSessionUser(),
        getAdjacentProducts(resolvedParams.slug),
        getMarketplaceSettings(),
    ]);

    if (!product) notFound();

    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = getBrandConfig(host);
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const sellerId = brand.sellerId || undefined;
    const relatedProducts = (product as any).categoryId
        ? await getRelatedProducts((product as any).categoryId, product.id, 4, sellerId)
        : [];

    const hasStock = (product.variants as any[])?.some((v: any) => v.stock > 0);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description || `${product.name} disponible en ${brand.name}`,
        image: (product.images as string[]) || [],
        sku: (product as any).sku || undefined,
        brand: {
            '@type': 'Brand',
            name: (product as any).brand?.name || brand.name,
        },
        offers: {
            '@type': 'Offer',
            priceCurrency: 'MXN',
            price: (product as any).price,
            availability: hasStock
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            url: `${baseUrl}/catalog/${resolvedParams.slug}`,
            seller: {
                '@type': 'Organization',
                name: brand.name,
                url: baseUrl,
            },
        },
        category: (product as any).category?.name,
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ProductDetailClient
                product={product}
                user={user}
                // @ts-ignore
                isWholesale={!!user?.isWholesale}
                isSingleVendor={brand.isSingleVendor}
                whatsapp={brand.whatsapp}
                prevProduct={adjacentProducts.prev}
                nextProduct={adjacentProducts.next}
                relatedProducts={relatedProducts}
                showPricesWithoutLogin={(() => {
                    const brandEntry = (mktSettings?.data as any)?.brandsConfig?.find((b: any) => host.includes(b.domain.split('.')[0]));
                    return brandEntry ? brandEntry.showPricesPublicly !== false : (mktSettings?.data as any)?.showPricesPublicly !== false;
                })()}
            />
        </>
    );
}

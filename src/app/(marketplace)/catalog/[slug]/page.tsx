import React from 'react';
import { notFound } from 'next/navigation';
import { getProductDetail, getAdjacentProducts } from '../../actions';
import ProductDetailClient from './ProductDetailClient';
import { getSessionUser } from '@/app/actions/auth';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
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

    const image = (product.images as string[])?.[0] || null;
    const description = (product.description?.slice(0, 155) ||
        `${product.name} — ${product.category?.name || 'Ropa'}. Disponible en ${brand.name}. Zapotlanejo, Jalisco.`);

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
        alternates: { canonical: `${baseUrl}/catalog/${slug}` },
    };
}

export default async function ProductPage({
    params,
}: {
    params: { slug: string };
}) {
    // Resolve params if they are promises (Next.js 15 behavior)
    const resolvedParams = await params;

    const [product, user, adjacentProducts] = await Promise.all([
        getProductDetail(resolvedParams.slug),
        getSessionUser(),
        getAdjacentProducts(resolvedParams.slug)
    ]);

    if (!product) notFound();

    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = getBrandConfig(host);
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

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
            />
        </>
    );
}

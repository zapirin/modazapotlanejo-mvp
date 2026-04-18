import React from 'react';
import { getProducts, getCategories, getBrands, getAvailableVariantOptions } from '../actions';
import CatalogClient from './CatalogClient';
import { getSessionUser } from '@/app/actions/auth';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import type { Metadata } from 'next';

// Mapas de títulos y descripciones por categoría optimizados para cada dominio
const CATEGORY_META: Record<string, Record<string, { title: string; description: string; keywords: string[] }>> = {
    kalexa: {
        damas:      { title: 'Ropa Dama Mayoreo | Blusas, Pantalones y Vestidos — Kalexa Fashion', description: 'Ropa de dama al mayoreo: blusas, pantalones, vestidos y más. Directo de fábrica desde Zapotlanejo, Jalisco. Envío a todo México.', keywords: ['ropa dama mayoreo', 'blusas mayoreo', 'pantalones dama', 'vestidos mayoreo', 'Kalexa Fashion'] },
        caballeros: { title: 'Ropa Caballero Mayoreo | Jeans y Camisas — Kalexa Fashion', description: 'Pantalones, jeans y camisas para caballero al mayoreo. Moda masculina directo de fábrica en Zapotlanejo. Envío a todo México.', keywords: ['ropa caballero mayoreo', 'jeans hombre mayoreo', 'pantalones caballero', 'Kalexa Fashion'] },
        ninos:      { title: 'Ropa Niños Mayoreo | Kalexa Fashion Zapotlanejo', description: 'Ropa para niños al mayoreo: pants, playeras, pantalones y más. Calidad y precio directo de fábrica. Envíos a todo México.', keywords: ['ropa niños mayoreo', 'ropa infantil mayoreo', 'Zapotlanejo', 'Kalexa Fashion'] },
    },
    moda: {
        damas:      { title: 'Ropa Dama Mayoreo Zapotlanejo — Blusas y Pantalones', description: 'Catálogo de ropa dama al mayoreo. Blusas, pantalones, vestidos y más de fabricantes de Zapotlanejo, Jalisco.', keywords: ['ropa dama mayoreo', 'blusas mayoreo Zapotlanejo', 'pantalones dama mayoreo'] },
        caballeros: { title: 'Ropa Caballero Mayoreo Zapotlanejo — Jeans y Camisas', description: 'Ropa de caballero al mayoreo directa de fabricantes de Zapotlanejo: jeans, pantalones, camisas y más.', keywords: ['ropa caballero mayoreo', 'jeans Zapotlanejo', 'pantalones hombre mayoreo'] },
        ninos:      { title: 'Ropa Niños Mayoreo Zapotlanejo — Moda Infantil', description: 'Ropa infantil al mayoreo de fabricantes de Zapotlanejo, Jalisco. Calidad y precio para toda la familia.', keywords: ['ropa niños mayoreo', 'ropa infantil Zapotlanejo', 'moda infantil mayoreo'] },
        accesorios: { title: 'Accesorios Moda Mayoreo — Zapotlanejo', description: 'Accesorios de moda al mayoreo. Cinturones, bolsas, joyería y más de los mejores fabricantes de Zapotlanejo.', keywords: ['accesorios moda mayoreo', 'accesorios Zapotlanejo', 'mayoreo accesorios'] },
        calzado:    { title: 'Calzado Mayoreo Zapotlanejo — Zapatos y Botas', description: 'Calzado al mayoreo: zapatos, botas, sandalias y tenis de fabricantes de Zapotlanejo, Jalisco.', keywords: ['calzado mayoreo', 'zapatos mayoreo Zapotlanejo', 'botas mayoreo México'] },
    },
};

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; subcategory?: string }>;
}): Promise<Metadata> {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = getBrandConfig(host);
    const isModa = host.includes('modazapotlanejo');
    const isZona = host.includes('zonadelvestir');
    const isKalexa = host.includes('kalexafashion');
    const params = await searchParams;
    const categorySlug = params.category?.toLowerCase() || '';

    // Buscar metadata específica de categoría
    const domainKey = isKalexa ? 'kalexa' : isModa ? 'moda' : null;
    const catMeta = domainKey ? CATEGORY_META[domainKey]?.[categorySlug] : null;

    const title = catMeta?.title || (
        isModa  ? 'Catálogo de Ropa Mayoreo — Zapotlanejo' :
        isZona  ? 'Catálogo Mayorista de Moda — Zona del Vestir' :
        isKalexa? 'Catálogo | Jeans y Ropa de Mayoreo — Kalexa Fashion Zapotlanejo' :
        `Catálogo — ${brand.name}`
    );

    const description = catMeta?.description || (
        isModa  ? 'Explora miles de prendas al mayoreo: jeans, blusas, vestidos, pantalones y más de los mejores fabricantes de Zapotlanejo, Jalisco.' :
        isZona  ? 'Catálogo completo de ropa mayoreo. Encuentra jeans, blusas, vestidos y más de los mejores fabricantes textiles de México.' :
        isKalexa? 'Más de 2,000 modelos de jeans, blusas, pantalones y vestidos. Compra al mayoreo directo de fábrica en Zapotlanejo. Envío a todo México.' :
        `Catálogo completo de ${brand.name}. Jeans, blusas, vestidos y más con envíos a todo México.`
    );

    const keywords = catMeta?.keywords || ['ropa mayoreo', 'catálogo ropa', 'jeans mayoreo', 'blusas mayoreo', 'Zapotlanejo', brand.name, 'moda México'];

    return {
        title,
        description,
        keywords,
        openGraph: { title: `${title} | ${brand.name}`, description, type: 'website', locale: 'es_MX' },
        twitter: { card: 'summary_large_image', title: `${title} | ${brand.name}`, description },
    };
}

export default async function CatalogPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const params = await searchParams;
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brandConfig = getBrandConfig(host);
    
    const category = typeof params.category === 'string' ? params.category : undefined;
    const subcategory = typeof params.subcategory === 'string' ? params.subcategory : undefined;
    const brand = typeof params.brand === 'string' ? params.brand : undefined;
    const search = typeof params.search === 'string' ? params.search : undefined;
    const sort = typeof params.sort === 'string' ? params.sort : undefined;
    const minPrice = typeof params.minPrice === 'string' ? parseFloat(params.minPrice) : undefined;
    const maxPrice = typeof params.maxPrice === 'string' ? parseFloat(params.maxPrice) : undefined;
    const onlyWithStock = params.onlyWithStock === 'true';
    const priceType = (params.priceType as 'all' | 'wholesale' | 'retail') || 'all';
    const color = typeof params.color === 'string' ? params.color : undefined;
    const size  = typeof params.size  === 'string' ? params.size  : undefined;
    const page = typeof params.page === 'string' ? parseInt(params.page) : 1;
    const pageSize = 24;
    const offset = (page - 1) * pageSize;

    const sellerId = brandConfig.sellerId || undefined;

    const [result, categories, brands, user, variantOptions] = await Promise.all([
        getProducts({ category, subcategory, brand, search, sort, minPrice, maxPrice, onlyWithStock, priceType, color, size, offset, limit: pageSize, sellerId }),
        getCategories(sellerId),
        getBrands(sellerId),
        getSessionUser(),
        getAvailableVariantOptions(sellerId),
    ]);

    return (
        <CatalogClient
            initialProducts={result.products}
            totalProducts={result.total}
            currentPage={page}
            pageSize={pageSize}
            categories={categories}
            brands={brands}
            availableColors={variantOptions.colors}
            availableSizes={variantOptions.sizes}
            sellerId={sellerId}
            // @ts-ignore
            isWholesale={!!user?.isWholesale}
            isLoggedIn={!!user}
            showPricesWithoutLogin={host.includes('kalexafashion')}
        />
    );
}

import React from 'react';
import { getProducts, getCategories, getBrands } from '../actions';
import CatalogClient from './CatalogClient';
import { getSessionUser } from '@/app/actions/auth';

export default async function CatalogPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const params = await searchParams;
    
    const category = typeof params.category === 'string' ? params.category : undefined;
    const subcategory = typeof params.subcategory === 'string' ? params.subcategory : undefined;
    const brand = typeof params.brand === 'string' ? params.brand : undefined;
    const search = typeof params.search === 'string' ? params.search : undefined;
    const sort = typeof params.sort === 'string' ? params.sort : undefined;
    const minPrice = typeof params.minPrice === 'string' ? parseFloat(params.minPrice) : undefined;
    const maxPrice = typeof params.maxPrice === 'string' ? parseFloat(params.maxPrice) : undefined;
    const onlyWithStock = params.onlyWithStock === 'true';
    const priceType = (params.priceType as 'all' | 'wholesale' | 'retail') || 'all';
    const page = typeof params.page === 'string' ? parseInt(params.page) : 1;
    const pageSize = 24;
    const offset = (page - 1) * pageSize;

    const [result, categories, brands, user] = await Promise.all([
        getProducts({ category, subcategory, brand, search, sort, minPrice, maxPrice, onlyWithStock, priceType, offset, limit: pageSize }),
        getCategories(),
        getBrands(),
        getSessionUser()
    ]);

    return (
        <CatalogClient 
            initialProducts={result.products}
            totalProducts={result.total}
            currentPage={page}
            pageSize={pageSize}
            categories={categories}
            brands={brands}
            // @ts-ignore
            isWholesale={!!user?.isWholesale}
            isLoggedIn={!!user}
        />
    );
}

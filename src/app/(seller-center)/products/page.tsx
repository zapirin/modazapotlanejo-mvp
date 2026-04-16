import React from 'react';
import { getInventory, getCategories, getBrands, getSuppliers } from './new/actions';
import ProductsGridClient from './ProductsGridClient';

export default async function ProductsPage({ searchParams = {} }: { searchParams?: any }) {
    const [products, categories, brands, suppliers] = await Promise.all([
        getInventory(),
        getCategories(),
        getBrands(),
        getSuppliers(),
    ]);
    const limitError = (searchParams as any)?.error === 'limit_reached';
    const limitNum = (searchParams as any)?.limit;

    return <ProductsGridClient products={products} categories={categories} brands={brands} suppliers={suppliers} limitError={limitError} limitNum={limitNum} />;
}

import React from 'react';
import { getInventory } from './new/actions';
import ProductsGridClient from './ProductsGridClient';

export default async function ProductsPage({ searchParams = {} }: { searchParams?: any }) {
    const products = await getInventory();
    const limitError = (searchParams as any)?.error === 'limit_reached';
    const limitNum = (searchParams as any)?.limit;

    return <ProductsGridClient products={products} limitError={limitError} limitNum={limitNum} />;
}

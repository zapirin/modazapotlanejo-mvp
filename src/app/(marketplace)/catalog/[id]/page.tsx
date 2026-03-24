import React from 'react';
import { notFound } from 'next/navigation';
import { getProductDetail, getAdjacentProducts } from '../../actions';
import ProductDetailClient from './ProductDetailClient';
import { getSessionUser } from '@/app/actions/auth';

export default async function ProductPage({
    params,
}: {
    params: { id: string };
}) {
    // Resolve params if they are promises (Next.js 15 behavior)
    const resolvedParams = await params;
    
    const [product, user, adjacentProducts] = await Promise.all([
        getProductDetail(resolvedParams.id),
        getSessionUser(),
        getAdjacentProducts(resolvedParams.id)
    ]);

    if (!product) {
        notFound();
    }

    return (
        <ProductDetailClient 
            product={product} 
            user={user}
            // @ts-ignore
            isWholesale={!!user?.isWholesale}
            prevProduct={adjacentProducts.prev}
            nextProduct={adjacentProducts.next}
        />
    );
}

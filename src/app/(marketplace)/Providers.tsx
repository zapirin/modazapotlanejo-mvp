"use client";

import { CartProvider } from '@/lib/CartContext';
import { RecentlyViewedProvider } from '@/lib/RecentlyViewedContext';

export default function MarketplaceProviders({ children }: { children: React.ReactNode }) {
    return (
        <CartProvider>
            <RecentlyViewedProvider>
                {children}
            </RecentlyViewedProvider>
        </CartProvider>
    );
}

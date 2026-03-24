"use client";

import { toggleWishlist } from '@/app/actions/wishlist';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function WishlistRemoveButton({ productId }: { productId: string }) {
    const router = useRouter();
    const [removing, setRemoving] = useState(false);

    return (
        <button
            onClick={async () => {
                setRemoving(true);
                await toggleWishlist(productId);
                router.refresh();
            }}
            disabled={removing}
            className="absolute top-4 right-4 z-10 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black hover:bg-red-600 transition shadow-lg"
            title="Quitar de favoritos"
        >
            ✕
        </button>
    );
}

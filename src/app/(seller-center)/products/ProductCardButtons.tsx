"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { duplicateProduct } from './new/actions';

interface ProductCardButtonsProps {
    productId: string;
}

export default function ProductCardButtons({ productId }: ProductCardButtonsProps) {
    const router = useRouter();
    const [isDuplicating, setIsDuplicating] = useState(false);

    const handleDuplicate = async () => {
        if (!confirm('¿Deseas duplicar este producto? Se creará una copia con stock en cero.')) return;
        
        setIsDuplicating(true);
        try {
            const res = await duplicateProduct(productId);
            if (res.success && res.productId) {
                router.push(`/products/${res.productId}/edit`);
            } else {
                alert('Error al duplicar: ' + (res.error || 'Unknown error'));
            }
        } catch (error) {
            console.error(error);
            alert('Error inesperado al duplicar.');
        } finally {
            setIsDuplicating(false);
        }
    };

    return (
        <div className="flex gap-2 w-full">
            <Link 
                href={`/products/${productId}/edit`} 
                className="flex-1 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-center flex items-center justify-center transition-colors"
            >
                Editar
            </Link>
            <button 
                onClick={handleDuplicate}
                disabled={isDuplicating}
                className="flex-1 py-2 text-sm font-medium border border-blue-200 bg-blue-50 rounded-lg text-blue-700 hover:bg-blue-100 text-center transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isDuplicating ? (
                    <>
                        <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                        Copiando...
                    </>
                ) : (
                    'Duplicar'
                )}
            </button>
        </div>
    );
}

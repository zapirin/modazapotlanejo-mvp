"use client";

import Link from 'next/link';

export default function ProductCard({ product, user, isWholesale, badge, nowMs, showPricesWithoutLogin = false }: any) {
    const isNew = nowMs ? (nowMs - new Date(product.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000 : false;
    return (
        <Link href={`/catalog/${product.slug || product.id}`} className="group block space-y-4">
            <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-gray-200 dark:bg-gray-800 relative shadow-md group-hover:shadow-xl transition-all group-hover:-translate-y-2">
                {product.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.images[0]} alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy" suppressHydrationWarning />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-[10px] font-black uppercase tracking-widest">Sin Imagen</div>
                )}
                <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                    {isNew && <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">✨ Nuevo</span>}
                    {badge && <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">{badge}</span>}
                    {product.brand?.name && (
                        <span className="px-3 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">
                            {product.brand.name}
                        </span>
                    )}
                </div>
            </div>
            <div className="space-y-1">
                <h4 className="font-bold text-sm tracking-tight text-foreground group-hover:text-blue-600 transition-colors uppercase truncate">{product.name}</h4>
                {(user || showPricesWithoutLogin) ? (
                    <div className="flex items-center gap-2">
                        <p className="text-blue-600 font-black text-lg">
                            ${(user && isWholesale && product.wholesalePrice ? product.wholesalePrice : (product.basePrice || product.price)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                        {user && isWholesale && product.wholesalePrice && (
                            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">Mayoreo</span>
                        )}
                    </div>
                ) : (
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Regístrate para ver precios</p>
                )}
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{product.category?.name}{product.subcategory?.name ? ` · ${product.subcategory.name}` : ''}</p>
            </div>
        </Link>
    );
}

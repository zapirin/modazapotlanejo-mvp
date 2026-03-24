"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';

export default function CatalogClient({ 
    initialProducts, 
    totalProducts,
    currentPage,
    pageSize,
    categories, 
    brands,
    isWholesale = false,
    isLoggedIn = false
}: { 
    initialProducts: any[];
    totalProducts: number;
    currentPage: number;
    pageSize: number;
    categories: any[];
    brands: any[];
    isWholesale?: boolean;
    isLoggedIn?: boolean;
}) {
    const searchParams = useSearchParams();
    const router = useRouter();
    
    const [products, setProducts] = useState(initialProducts);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const selectedCategory = searchParams.get('category') || '';
    const selectedSubcategory = searchParams.get('subcategory') || '';
    const selectedBrand = searchParams.get('brand') || '';
    const selectedSort = searchParams.get('sort') || '';
    const onlyWithStock = searchParams.get('onlyWithStock') === 'true';
    const priceType = searchParams.get('priceType') || 'all';
    const [expandedCategory, setExpandedCategory] = useState<string | null>(selectedCategory || null);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [isCategoriesOpen, setIsCategoriesOpen] = useState(!!selectedCategory);

    useEffect(() => {
        setProducts(initialProducts);
    }, [initialProducts]);

    const handleFilterChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        if (key === 'category') params.delete('subcategory');
        // Resetear página al cambiar filtros
        params.delete('page');
        router.push(`/catalog?${params.toString()}`);
    };

    const clearAllFilters = () => {
        setSearch('');
        router.push('/catalog');
    };

    const hasActiveFilters = selectedCategory || selectedBrand || selectedSubcategory || 
        searchParams.get('search') || searchParams.get('minPrice') || 
        searchParams.get('maxPrice') || onlyWithStock || priceType !== 'all';

    const totalPages = Math.ceil(totalProducts / pageSize);

    const sortOptions = [
        { value: '', label: 'Más Recientes' },
        { value: 'price_asc', label: 'Precio: Menor a Mayor' },
        { value: 'price_desc', label: 'Precio: Mayor a Menor' },
        { value: 'best_selling', label: 'Más Vendido' },
        { value: 'name_asc', label: 'Nombre A-Z' },
        { value: 'name_desc', label: 'Nombre Z-A' },
    ];

    // Producto nuevo si tiene menos de 7 días
    const isNewProduct = (createdAt: string | Date) => {
        const diff = Date.now() - new Date(createdAt).getTime();
        return diff < 7 * 24 * 60 * 60 * 1000;
    };

    const currentCategory = categories.find((c: any) => c.slug === selectedCategory);

    return (
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-12">
            {/* Mobile filter toggle */}
            <button 
                className="md:hidden flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm font-bold"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                {showMobileFilters ? 'Ocultar Filtros' : `Mostrar Filtros${hasActiveFilters ? ' ●' : ''}`}
            </button>

            {/* SIDEBAR FILTERS */}
            <aside className={`w-full md:w-64 space-y-8 shrink-0 ${showMobileFilters ? 'block' : 'hidden md:block'}`}>

                {/* Limpiar filtros */}
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        Limpiar filtros
                    </button>
                )}

                {/* Search */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Buscar</h3>
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Producto, marca, categoría..."
                            className="w-full pl-4 pr-10 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-sm font-bold"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFilterChange('search', search)}
                        />
                        <button 
                            onClick={() => handleFilterChange('search', search)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </button>
                    </div>
                    {searchParams.get('search') && (
                        <p className="text-[10px] text-blue-600 font-bold">
                            Buscando: "{searchParams.get('search')}"
                        </p>
                    )}
                </div>

                {/* Disponibilidad */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Disponibilidad</h3>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                            <input 
                                type="checkbox"
                                checked={onlyWithStock}
                                onChange={(e) => handleFilterChange('onlyWithStock', e.target.checked ? 'true' : '')}
                                className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${onlyWithStock ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600 group-hover:border-blue-400'}`}>
                                {onlyWithStock && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                                )}
                            </div>
                        </div>
                        <span className="text-sm font-bold text-foreground">Solo con stock disponible</span>
                    </label>
                </div>

                {/* Tipo de precio — solo para mayoristas */}
                {isWholesale && (
                <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Tipo de precio</h3>
                    <div className="flex flex-col gap-1.5">
                        {[
                            { value: 'all', label: 'Todos' },
                            { value: 'wholesale', label: 'Solo mayoreo' },
                            { value: 'retail', label: 'Solo menudeo' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleFilterChange('priceType', opt.value === 'all' ? '' : opt.value)}
                                className={`text-left text-sm font-bold py-2 px-4 rounded-xl transition-all ${priceType === opt.value || (opt.value === 'all' && !priceType) ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                )}

                {/* Categories */}
                <div className="space-y-2">
                    <button
                        onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                        className="w-full flex items-center justify-between group"
                    >
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">Categorías</h3>
                        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isCategoriesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-300 ease-in-out ${isCategoriesOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <button 
                            onClick={() => { handleFilterChange('category', ''); setExpandedCategory(null); }}
                            className={`text-left text-sm font-bold py-2.5 px-4 rounded-xl transition-all ${!selectedCategory ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
                        >
                            Todas las categorías
                        </button>
                        {categories.map((cat: any) => (
                            <div key={cat.id}>
                                <button 
                                    onClick={() => {
                                        handleFilterChange('category', cat.slug);
                                        setExpandedCategory(expandedCategory === cat.slug ? null : cat.slug);
                                    }}
                                    className={`w-full text-left text-sm font-bold py-2.5 px-4 rounded-xl transition-all flex justify-between items-center ${selectedCategory === cat.slug ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
                                >
                                    <span>{cat.name}</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${selectedCategory === cat.slug ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                            {cat._count?.products || 0}
                                        </span>
                                        {cat.subcategories?.length > 0 && (
                                            <svg className={`w-3 h-3 transition-transform ${expandedCategory === cat.slug ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                                        )}
                                    </span>
                                </button>
                                {expandedCategory === cat.slug && cat.subcategories?.length > 0 && (
                                    <div className="ml-4 mt-1 mb-2 flex flex-col gap-0.5 border-l-2 border-blue-100 dark:border-blue-900/30 pl-3">
                                        {cat.subcategories.map((sub: any) => (
                                            <button
                                                key={sub.id}
                                                onClick={() => handleFilterChange('subcategory', selectedSubcategory === sub.slug ? '' : sub.slug)}
                                                className={`text-left text-xs font-bold py-1.5 px-3 rounded-lg transition-all ${selectedSubcategory === sub.slug ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                                            >
                                                {sub.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Brands */}
                {brands.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Marcas</h3>
                        <div className="flex flex-wrap gap-2">
                            {brands.map((brand: any) => (
                                <button 
                                    key={brand.id}
                                    onClick={() => handleFilterChange('brand', selectedBrand === brand.id ? '' : brand.id)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${selectedBrand === brand.id ? 'bg-foreground text-background border-foreground' : 'bg-transparent border-border text-gray-400 hover:border-gray-400'}`}
                                >
                                    {brand.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Price Range — solo para usuarios registrados */}
                {isLoggedIn && (
                <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Rango de Precio</h3>
                    <div className="flex gap-2 items-center">
                        <input 
                            type="number"
                            placeholder="Min"
                            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm font-bold text-center"
                            defaultValue={searchParams.get('minPrice') || ''}
                            onBlur={(e) => handleFilterChange('minPrice', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFilterChange('minPrice', (e.target as HTMLInputElement).value)}
                        />
                        <span className="text-gray-400 font-bold text-xs">—</span>
                        <input 
                            type="number"
                            placeholder="Max"
                            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm font-bold text-center"
                            defaultValue={searchParams.get('maxPrice') || ''}
                            onBlur={(e) => handleFilterChange('maxPrice', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFilterChange('maxPrice', (e.target as HTMLInputElement).value)}
                        />
                    </div>
                </div>
                )}
            </aside>

            {/* PRODUCT GRID */}
            <div className="flex-1 space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
                    <div>
                        <h2 className="text-2xl font-black text-foreground">
                            {selectedCategory ? categories.find((c: any) => c.slug === selectedCategory)?.name : 'Catálogo Completo'}
                            {selectedSubcategory && currentCategory && (
                                <span className="text-blue-600 ml-2">
                                    › {currentCategory.subcategories?.find((s: any) => s.slug === selectedSubcategory)?.name}
                                </span>
                            )}
                        </h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                            {totalProducts} {totalProducts === 1 ? 'producto' : 'productos'}
                            {totalPages > 1 && ` — Página ${currentPage} de ${totalPages}`}
                        </p>
                    </div>
                    <select
                        value={selectedSort}
                        onChange={(e) => handleFilterChange('sort', e.target.value)}
                        className="px-4 py-2 bg-input border border-border rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 cursor-pointer"
                    >
                        {sortOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                    {products.map((product: any) => (
                        <div key={product.id} className="group space-y-4">
                            <Link href={`/catalog/${product.id}`}>
                                <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-gray-200 dark:bg-gray-800 relative shadow-sm group-hover:shadow-xl transition-all group-hover:-translate-y-2">
                                    {product.images?.[0] ? (
                                        <Image 
                                            src={product.images[0]}
                                            alt={product.name}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">Sin Imagen</div>
                                    )}
                                    <div className="absolute top-4 left-4 flex flex-col gap-1">
                                        {isNewProduct(product.createdAt) && (
                                            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm animate-pulse">
                                                ✨ Nuevo
                                            </span>
                                        )}
                                        <span className="px-3 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">
                                            {product.brand?.name || 'Genérico'}
                                        </span>
                                        {isWholesale && product.sellByPackage && (
                                            <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">
                                                Mayoreo
                                            </span>
                                        )}
                                    </div>
                                    {/* Badge de sin stock */}
                                    {product.variants?.every((v: any) => v.stock === 0) && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <span className="px-4 py-2 bg-black/70 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                                                Sin stock
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </Link>
                            <div className="space-y-1">
                                <Link href={`/catalog/${product.id}`}>
                                    <h4 className="font-bold text-sm tracking-tight group-hover:text-blue-600 transition-colors uppercase">{product.name}</h4>
                                </Link>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {isLoggedIn ? (
                                        isWholesale && product.sellByPackage && product.wholesaleComposition && Array.isArray(product.wholesaleComposition) && product.wholesaleComposition.length > 0 ? (
                                            <div className="flex flex-col gap-0.5">
                                                {product.wholesaleComposition.slice(0, 2).map((method: any, i: number) => {
                                                    const pieces = Object.values(method.composition || {}).reduce((a: number, b: any) => a + (parseInt(b) || 0), 0) as number;
                                                    // price ya está guardado como precio/pz
                                                    const pricePerPiece = method.price ? parseFloat(method.price) : null;
                                                    return (
                                                        <span key={i} className="text-xs font-black text-emerald-600">
                                                            {method.name}: {pricePerPiece ? `$${pricePerPiece.toFixed(0)}/pz` : '-'}
                                                            <span className="text-gray-400 font-medium ml-1">({pieces} pz)</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-blue-600 font-black text-lg">
                                                ${(product.price || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                                            </p>
                                        )
                                    ) : (
                                        <Link href="/login" className="text-xs font-black text-gray-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
                                            Inicia sesión para ver precio
                                        </Link>
                                    )}
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {product.category?.name}{product.subcategory?.name ? ` • ${product.subcategory.name}` : ''}
                                </p>
                                {product.seller && (
                                    <Link 
                                        href={`/vendor/${product.seller.id}`}
                                        className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1 hover:text-blue-700 transition-colors"
                                    >
                                        🏭 {product.seller.businessName || product.seller.name}
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && (
                        <div className="col-span-full py-24 text-center space-y-4">
                            <div className="text-6xl text-gray-200 dark:text-gray-800 font-black tracking-tighter">🔍</div>
                            <p className="font-bold text-gray-500 uppercase tracking-widest text-xs">No encontramos productos con esos filtros</p>
                            <button 
                                onClick={clearAllFilters}
                                className="px-8 py-3 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                            >
                                Limpiar Filtros
                            </button>
                        </div>
                    )}
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-8 border-t border-border">
                        {currentPage > 1 && (
                            <button
                                onClick={() => handleFilterChange('page', String(currentPage - 1))}
                                className="px-5 py-2.5 bg-card border border-border rounded-xl text-xs font-black uppercase tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all"
                            >
                                ← Anterior
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let page = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                    page = currentPage - 2 + i;
                                }
                                if (page > totalPages) return null;
                                return (
                                    <button
                                        key={page}
                                        onClick={() => handleFilterChange('page', String(page))}
                                        className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${page === currentPage ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-card border border-border hover:border-blue-600 hover:text-blue-600'}`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                        </div>
                        {currentPage < totalPages && (
                            <button
                                onClick={() => handleFilterChange('page', String(currentPage + 1))}
                                className="px-5 py-2.5 bg-card border border-border rounded-xl text-xs font-black uppercase tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all"
                            >
                                Siguiente →
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

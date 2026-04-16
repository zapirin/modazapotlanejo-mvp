"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bulkCreateProducts, deleteProduct, getCategories, duplicateProduct, getStoreLocations, createStoreLocation, getBrands, getSuppliers } from '../products/new/actions';
import { adjustProductStock, adjustProductStockGrid } from './actions';
import InventoryRealtimeSync from '@/components/InventoryRealtimeSync';
import BulkActionsModal from '../products/BulkActionsModal';
import { useCallback } from 'react';

const formatVariantName = (variant: any) => {
    if (variant.attributes && typeof variant.attributes === 'object') {
        const attrs = variant.attributes as Record<string, any>;
        const parts = Object.values(attrs);
        if (parts.length > 0) return parts.join(' / ');
    }
    if (variant.color && variant.size) return `${variant.color} / ${variant.size}`;
    if (variant.color) return variant.color;
    if (variant.size) return variant.size;
    return 'Única';
};

async function getInventory(params?: {
    page?: number; search?: string; categoryId?: string; brandId?: string; supplierId?: string;
}) {
    const p = params || {};
    const qs = new URLSearchParams();
    qs.set('page', String(p.page || 1));
    qs.set('limit', '50');
    if (p.search) qs.set('search', p.search);
    if (p.categoryId) qs.set('categoryId', p.categoryId);
    if (p.brandId) qs.set('brandId', p.brandId);
    if (p.supplierId) qs.set('supplierId', p.supplierId);
    const res = await fetch('/api/inventory?' + qs.toString(), { cache: 'no-store' });
    if (!res.ok) return { products: [], total: 0, page: 1, totalPages: 1 };
    return res.json();
}

export default function InventoryPage() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const [categories, setCategories] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    
    // Filters state
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [selectedBrand, setSelectedBrand] = useState<string>("");
    const [selectedSupplier, setSelectedSupplier] = useState<string>("");
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Ajuste de Stock State
    const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null);
    const [stockAdjustments, setStockAdjustments] = useState<Record<string, number>>({});
    const [isAdjusting, setIsAdjusting] = useState(false);

    // Bulk Edit State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    // Computed filtered products for list and "select all"
    const filteredProducts = products.filter((p: any) => {
        const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
        let matchCategory = true;
        if (selectedCategory) {
            if (selectedCategory.includes('|')) {
                const [catId, subcatId] = selectedCategory.split('|');
                matchCategory = p.categoryId === catId && p.subcategoryId === subcatId;
            } else {
                matchCategory = p.categoryId === selectedCategory;
            }
        }
        
        const matchBrand = selectedBrand ? p.brandId === selectedBrand : true;
        const matchSupplier = selectedSupplier ? p.supplierId === selectedSupplier : true;

        return matchSearch && matchCategory && matchBrand && matchSupplier;
    });

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedIds(filteredProducts.map((p: any) => p.id));
        else setSelectedIds([]);
    };

    const handleSelectOne = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    useEffect(() => {
        loadInventory();
    }, []);

    useEffect(() => {
        const delay = setTimeout(() => {
            loadInventory(1);
        }, 400);
        return () => clearTimeout(delay);
    }, [searchQuery, selectedCategory, selectedBrand, selectedSupplier]);

    // Handler para cambios en tiempo real — actualiza el stock en pantalla sin recargar
    const handleInventoryChange = useCallback((change: { variantId: string; locationId: string; stock: number }) => {
        setProducts(prev => prev.map(product => ({
            ...product,
            variants: product.variants.map((variant: any) => {
                if (variant.id === change.variantId) {
                    return { ...variant, stock: change.stock };
                }
                return variant;
            })
        })));
    }, []);

    const loadInventory = async (page = 1) => {
        setLoading(true);
        try {
            const [data, cats, locs, brs, sups] = await Promise.all([
                getInventory({ page, search: searchQuery, categoryId: selectedCategory.split('|')[0] || '', brandId: selectedBrand, supplierId: selectedSupplier }),
                getCategories(),
                getStoreLocations(),
                getBrands(),
                getSuppliers()
            ]);
            setProducts(data.products || []);
            setTotalPages(data.totalPages || 1);
            setTotalProducts(data.total || 0);
            setCurrentPage(data.page || 1);
            setCategories(cats);
            setLocations(locs);
            setBrands(brs);
            setSuppliers(sups);
        } catch (error) {
            console.error("Error loading inventory:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (products.length === 0) return;

        // Header
        const headers = ["Nombre", "Categoría", "Costo", "Precio Base", "Descripción", "Variantes", "Stock Total"];

        // Data rows
        const rows = products.map(product => {
            const totalStock = product.variants.reduce((acc: number, v: any) => acc + v.stock, 0);
            const variantSummaries = product.variants.map((v: any) => formatVariantName(v)).join(";");

            return [
                `"${product.name}"`,
                `"${product.category?.name || 'Varios'}"`,
                product.cost || 0,
                product.price,
                `"${(product.description || "").replace(/"/g, '""')}"`,
                `"${variantSummaries}"`,
                totalStock
            ].join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `inventario_moda_zapo_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            const content = event.target?.result as string;
            const lines = content.split('\n');
            const newProducts = [];

            // Skip header (i=1)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Basic CSV parsing (handles quotes)
                const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

                if (parts.length >= 3) {
                    const name = parts[0].replace(/^"|"$/g, '');
                    const category = parts[1].replace(/^"|"$/g, '');
                    const price = parts[2].replace(/^"|"$/g, '');
                    const description = parts[3]?.replace(/^"|"$/g, '') || '';
                    const colorsStr = parts[4]?.replace(/^"|"$/g, '') || 'Único';
                    const sizesStr = parts[5]?.replace(/^"|"$/g, '') || 'Única';

                    const colors = colorsStr.split(';').map(c => c.trim());
                    const sizes = sizesStr.split(';').map(s => s.trim());

                    newProducts.push({
                        name,
                        category: category.toLowerCase(),
                        basePrice: price,
                        description,
                        colors,
                        sizes,
                        inventory: {}, // Import defaults to 0 stock for variant matrix
                        images: []
                    });
                }
            }

            if (newProducts.length > 0) {
                const results = await bulkCreateProducts(newProducts);
                alert(`Importación finalizada: ${results.success} éxitos, ${results.failed} errores.`);
                if (results.errors.length > 0) console.error("Import Errors:", results.errors);
                loadInventory();
            } else {
                alert("No se encontraron productos válidos en el archivo.");
            }
            setIsImporting(false);
        };

        reader.readAsText(file);
        e.target.value = '';
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!window.confirm("¿Estás seguro de que deseas mandar este producto a la papelera? Podrás restaurarlo más adelante si lo deseas.")) return;
        
        const res = await deleteProduct(productId);
        if (res.success) {
            loadInventory();
        } else {
            alert(res.error || "No se pudo eliminar el producto.");
        }
    };

    const handleDuplicateProduct = async (productId: string) => {
        setIsDuplicating(productId);
        try {
            const res = await duplicateProduct(productId);
            if (res.success && res.productId) {
                router.push(`/products/${res.productId}/edit`);
            } else {
                alert(res.error || "Error al duplicar el producto");
            }
        } catch (error) {
            console.error(error);
            alert("Error al duplicar el producto");
        } finally {
            setIsDuplicating(null);
            setOpenMenuId(null);
        }
    };

    const handleCreateLocation = async () => {
        const name = window.prompt("Ingresa el nombre de la nueva tienda o bodega (Ej. Centro, Almacén 2):");
        if (!name?.trim()) return;

        setLoading(true);
        const res = await createStoreLocation(name.trim());
        if (res.success) {
            alert(`✅ Sucursal "${name}" agregada exitosamente.`);
            loadInventory();
        } else {
            alert(res.error || "No se pudo crear la sucursal.");
            setLoading(false);
        }
    };

    const handleOpenAdjustModal = (product: any) => {
        setAdjustingProduct(product);
        setIsAdjusting(false);

        const initAdj: Record<string, number> = {};
        product.variants.forEach((v: any) => {
            const dbTotal = v.stock || 0;
            const levelSum = (v.inventoryLevels || []).reduce((acc: number, l: any) => acc + l.stock, 0);
            const hasLegacyGap = dbTotal > 0 && levelSum === 0;

            locations.forEach((loc: any) => {
                const level = (v.inventoryLevels || []).find((l: any) => l.locationId === loc.id);
                let val = level ? level.stock : 0;
                
                // Fallback for migration: dump stock in Main/WebStore if no explicit levels exist
                if (!level && hasLegacyGap && loc.isWebStore === true) {
                    val = dbTotal;
                }
                
                initAdj[`${v.id}_${loc.id}`] = val;
            });
        });
        setStockAdjustments(initAdj);
        setOpenMenuId(null);
    };

    const handleAdjustmentChange = (key: string, quantity: number) => {
        setStockAdjustments(prev => ({ ...prev, [key]: quantity }));
    };

    const submitStockAdjustment = async () => {
        if (!adjustingProduct) return;
        setIsAdjusting(true);

        const payload: { variantId: string, locationId: string, quantity: number }[] = [];
        Object.entries(stockAdjustments).forEach(([key, quantity]) => {
            const [variantId, locationId] = key.split('_');
            if (variantId && locationId) {
                payload.push({ variantId, locationId, quantity });
            }
        });

        const res = await adjustProductStockGrid(adjustingProduct.id, payload);
        if (res.success) {
            loadInventory();
            setAdjustingProduct(null);
        } else {
            alert(res.error || "No se pudo actualizar el inventario.");
        }
        setIsAdjusting(false);
    };

    return (
        <div className="max-w-6xl mx-auto py-6 lg:py-10 px-4" onClick={() => setOpenMenuId(null)}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black text-foreground tracking-tight">Todos los Productos</h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium mt-2">Inventario en tiempo real sincronizado con tu Punto de Venta.</p>
                </div>
                <div className="flex w-full md:w-auto gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".csv"
                        onChange={handleFileImport}
                    />
                    <button
                        onClick={handleCreateLocation}
                        className="flex-1 md:flex-none px-6 py-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition shadow-sm"
                    >
                        + SUCURSAL
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={isImporting}
                        className="flex-1 md:flex-none px-6 py-3 bg-card border border-border text-foreground font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm disabled:opacity-50"
                    >
                        {isImporting ? 'Importando...' : 'Importar'}
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="flex-1 md:flex-none px-6 py-3 bg-card border border-border text-foreground font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm"
                    >
                        Exportar
                    </button>
                    <Link href="/inventory/trash" className="flex-1 md:flex-none px-6 py-3 bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-400 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition shadow-sm flex items-center justify-center gap-2">
                        <span>🗑️</span> Papelera
                    </Link>
                    <Link href="/products/new" className="flex-1 md:flex-none px-6 py-3 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-blue-700 transition shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2">
                        <span>+</span> CREAR NUEVO
                    </Link>
                </div>
            </div>

            {selectedIds.length > 0 && (
                <div className="mb-4 flex flex-col md:flex-row items-center justify-between bg-blue-50/80 backdrop-blur py-3 px-6 rounded-3xl border border-blue-200 shadow-sm animate-fade-in gap-4">
                    <span className="text-blue-800 font-bold text-lg">💡 {selectedIds.length} artículos seleccionados</span>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button onClick={() => setSelectedIds([])} className="flex-1 md:flex-none text-sm font-bold text-gray-500 hover:text-red-600 px-4 py-2.5 rounded-xl bg-white shadow-sm transition">
                            ✖ Cancelar
                        </button>
                        <button onClick={() => setIsBulkModalOpen(true)} className="flex-1 md:flex-none bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2">
                            ⚡ Edición Masiva 
                        </button>
                    </div>
                </div>
            )}


            {totalPages > 1 && (
                <div className="mb-4 flex items-center justify-between bg-card border border-border rounded-2xl px-6 py-4">
                    <p className="text-sm text-gray-500 font-medium">
                        Mostrando <span className="font-black text-foreground">{products.length}</span> de <span className="font-black text-foreground">{totalProducts}</span> productos
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => loadInventory(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-xl border border-border font-bold text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                            ← Anterior
                        </button>
                        <span className="px-4 py-2 font-black text-sm">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => loadInventory(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-xl border border-border font-bold text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                            Siguiente →
                        </button>
                    </div>
                </div>
            )}

            {/* Panel de Búsqueda y Filtros */}
            <div className="bg-card p-5 rounded-t-3xl border border-border gap-4 shadow-sm flex flex-col">
                <div className="flex flex-col md:flex-row gap-4 w-full">
                    <div className="flex-1 relative">
                        <span className="absolute left-4 top-3.5 text-gray-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o modelo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-input border border-border rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground font-medium"
                        />
                    </div>
                    <button
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                        className={`px-5 py-3 rounded-2xl border font-bold text-sm transition-all focus:ring-2 outline-none flex items-center justify-center gap-2 ${isFiltersOpen ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' : 'bg-input border-border text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/80'}`}
                    >
                        <span>{isFiltersOpen ? '▲' : '🔬'}</span> Filtros Adicionales
                    </button>
                    {(!isFiltersOpen && (selectedCategory || selectedBrand || selectedSupplier)) && (
                        <button onClick={() => { setSelectedCategory(''); setSelectedBrand(''); setSelectedSupplier(''); }} className="px-4 py-3 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition">
                            Limpiar
                        </button>
                    )}
                </div>

                {isFiltersOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/50 animate-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-2">Categoría</label>
                            <select 
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full px-5 py-3 rounded-2xl border border-border bg-input outline-none focus:ring-2 focus:ring-blue-500/50 transition font-bold text-sm text-foreground"
                            >
                                <option value="">Todas las categorías</option>
                                {categories.map((c) => (
                                    <React.Fragment key={c.id}>
                                        <option value={c.id}>{c.name}</option>
                                        {c.subcategories?.map((sc: any) => (
                                            <option key={sc.id} value={`${c.id}|${sc.id}`}>
                                                &nbsp;&nbsp;↳ {sc.name}
                                            </option>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-2">Marca</label>
                            <select 
                                value={selectedBrand}
                                onChange={(e) => setSelectedBrand(e.target.value)}
                                className="w-full px-5 py-3 rounded-2xl border border-border bg-input outline-none focus:ring-2 focus:ring-blue-500/50 transition font-bold text-sm text-foreground"
                            >
                                <option value="">Todas las Marcas</option>
                                {brands.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-2">Proveedor</label>
                            <select 
                                value={selectedSupplier}
                                onChange={(e) => setSelectedSupplier(e.target.value)}
                                className="w-full px-5 py-3 rounded-2xl border border-border bg-input outline-none focus:ring-2 focus:ring-blue-500/50 transition font-bold text-sm text-foreground"
                            >
                                <option value="">Todos los Proveedores</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabla de Inventario */}
            <div className="bg-card rounded-b-3xl shadow-2xl border border-border overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-80 gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600"></div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Cargando Nube...</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 text-center px-6">
                        <span className="text-6xl mb-6">📦</span>
                        <h2 className="text-xl font-black text-foreground mb-2">Sin mercancia registrada</h2>
                        <p className="text-gray-500 max-w-sm mb-6">Tu inventario aparecerá aquí una vez que des de alta tus primeros modelos.</p>
                        <Link href="/products/new" className="px-8 py-3 bg-foreground text-background font-black rounded-xl hover:opacity-90 transition">Comenzar ahora</Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-card/80 border-b border-border text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">
                                    <th className="p-5 text-center w-12">
                                        <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="p-5">Modelo / Prenda</th>
                                    <th className="p-5">Categoría</th>
                                    <th className="p-5 text-emerald-600 dark:text-emerald-400">Costo</th>
                                    <th className="p-5 text-blue-600">Precio Venta</th>
                                    <th className="p-5">Matriz</th>
                                    <th className="p-5 text-center">Stock Físico</th>
                                    <th className="p-5 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredProducts.map((product: any) => {
                                    const totalStock = product.variants.reduce((acc: number, v: any) => acc + v.stock, 0);
                                    const options = product.variantOptions as any[] || [];
                                    const isSelected = selectedIds.includes(product.id);

                                    return (
                                        <tr key={product.id} onClick={() => handleSelectOne(product.id)} className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer ${isSelected ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                                            <td className="p-5 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectOne(product.id)}
                                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-2xl overflow-hidden shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform">
                                                        {product.images?.[0] ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" /> : '👕'}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-foreground text-lg tracking-tight leading-tight">{product.name}</p>
                                                        {product.sku && <p className="text-xs text-gray-400 font-mono mt-1 font-bold">{product.sku}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-foreground text-xs font-bold rounded-lg uppercase tracking-wider">
                                                    {product.category?.name || 'Varios'} {product.subcategory ? `- ${product.subcategory.name}` : ''}
                                                </span>
                                                {product.brand && (
                                                    <span className="block mt-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">{product.brand.name}</span>
                                                )}
                                            </td>
                                            <td className="p-5">
                                                <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                                                    ${product.cost?.toFixed(2) || '0.00'}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                {product.promotionalPrice && (
                                                    <span className="text-[10px] text-gray-400 line-through block leading-none">${product.price.toFixed(2)}</span>
                                                )}
                                                <span className={`font-black text-sm ${product.promotionalPrice ? 'text-purple-600' : 'text-blue-600'}`}>
                                                    ${(product.promotionalPrice || product.price).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="text-xs space-y-1">
                                                    {options.length > 0 ? (
                                                        options.map((opt: any, idx: number) => (
                                                            <p key={idx} className="font-medium text-gray-500 uppercase tracking-tighter">
                                                                <span className="text-foreground font-black">{opt.values?.length || 0}</span> {opt.name}
                                                            </p>
                                                        ))
                                                    ) : (
                                                        <p className="font-medium text-gray-500 uppercase tracking-tighter">Producto Único</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td 
                                                className="p-5 text-center cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/20 group/stock border-l border-r border-transparent hover:border-blue-100 dark:hover:border-blue-800 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenAdjustModal(product);
                                                }}
                                            >
                                                <div className="flex flex-col items-center gap-1 group-hover/stock:scale-105 transition-transform relative">
                                                    <span className={`inline-flex items-center justify-center min-w-[3.5rem] px-3 py-1.5 ${totalStock > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'} text-xs font-black rounded-xl shadow-sm`}>
                                                        {totalStock} <span className="ml-1 opacity-50 font-medium">pz</span>
                                                    </span>
                                                    <span className="text-[10px] text-blue-500 font-bold opacity-0 group-hover/stock:opacity-100 transition-opacity absolute top-full mt-1 uppercase tracking-widest whitespace-nowrap">
                                                        Editar Stock
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5 text-right relative">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === product.id ? null : product.id); }}
                                                    className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500 transition-all flex items-center justify-center p-0 m-0 ml-auto"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                                                </button>
                                                {openMenuId === product.id && (
                                                    <div className="absolute right-8 top-12 w-48 bg-card border border-border shadow-xl rounded-2xl z-20 py-2 animate-in fade-in slide-in-from-top-2">
                                                        <Link 
                                                            href={`/products/${product.id}/edit`}
                                                            className="w-full text-left px-5 py-3 flex text-sm font-bold text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                                                        >
                                                            ✏️ Editar Producto
                                                        </Link>
                                                        <button 
                                                            className="w-full text-left px-5 py-3 flex text-sm font-bold text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                                                            onClick={(e) => { e.stopPropagation(); handleDuplicateProduct(product.id); }}
                                                            disabled={isDuplicating === product.id}
                                                        >
                                                            {isDuplicating === product.id ? '⌛ Duplicando...' : '👯 Duplicar'}
                                                        </button>
                                                        <button 
                                                            className="w-full text-left px-5 py-3 flex text-sm font-bold text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); handleOpenAdjustModal(product); }}
                                                        >
                                                            ⚖️ Ajustar Stock
                                                        </button>
                                                        <div className="h-px bg-border my-1 w-full"></div>
                                                        <button 
                                                            className="w-full text-left px-5 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); handleDeleteProduct(product.id); }}
                                                        >
                                                            🗑️ Mandar a Papelera
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between bg-card border border-border rounded-2xl px-6 py-4">
                    <p className="text-sm text-gray-500 font-medium">
                        Mostrando <span className="font-black text-foreground">{products.length}</span> de <span className="font-black text-foreground">{totalProducts}</span> productos
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => loadInventory(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-xl border border-border font-bold text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                            ← Anterior
                        </button>
                        <span className="px-4 py-2 font-black text-sm">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => loadInventory(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-xl border border-border font-bold text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                            Siguiente →
                        </button>
                    </div>
                </div>
            )}

            <div className="mt-8 flex justify-center">
                <InventoryRealtimeSync 
                    onInventoryChange={handleInventoryChange}
                    fetchInventory={getInventory}
                />
            </div>

            {/* Modal de Ajuste de Stock */}
            {adjustingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50">
                            <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                                ⚖️ Reemplazar Stock en Sucursales
                            </h3>
                            <p className="text-sm text-gray-500 mt-1 font-medium">{adjustingProduct.name}</p>
                        </div>
                        
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mb-4">Ingresa la cantidad final exacta (Caja Registradora) para cada bodega</p>
                            
                            <div className="overflow-x-auto rounded-2xl border border-border shadow-sm">
                                <table className="w-full text-left text-sm bg-card">
                                    <thead className="bg-gray-50/50 dark:bg-gray-800/80 uppercase text-[10px] font-black tracking-widest text-gray-400">
                                        <tr>
                                            <th className="p-3 border-b border-border">Variante</th>
                                            {locations.map(loc => (
                                                <th key={loc.id} className="p-3 text-center min-w-[120px] border-b border-l border-border bg-blue-50/30">
                                                    {loc.name} {loc.isWebStore ? '🌐' : '🏪'}
                                                </th>
                                            ))}
                                            <th className="p-3 border-b border-l border-border text-center bg-gray-100/50">TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {adjustingProduct.variants.map((v: any) => {
                                            const totalRow = locations.reduce((acc, loc) => acc + (stockAdjustments[`${v.id}_${loc.id}`] || 0), 0);
                                            return (
                                                <tr key={v.id} className="hover:bg-input/50 transition-colors">
                                                    <td className="p-3 font-bold text-foreground max-w-[150px] truncate">
                                                        {formatVariantName(v)}
                                                    </td>
                                                    {locations.map(loc => {
                                                        const key = `${v.id}_${loc.id}`;
                                                        const val = stockAdjustments[key] || 0;
                                                        return (
                                                            <td key={loc.id} className="p-2 border-l border-border">
                                                                <div className="flex items-center justify-center gap-1 bg-input rounded-xl border border-border/50 p-1">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setStockAdjustments(p => ({...p, [key]: Math.max(0, val - 1)}))}
                                                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-black text-gray-500 transition-colors"
                                                                    >-</button>
                                                                    <input 
                                                                        type="number" 
                                                                        value={val}
                                                                        onChange={(e) => setStockAdjustments(p => ({...p, [key]: Math.max(0, parseInt(e.target.value) || 0)}))}
                                                                        className="w-10 text-center font-bold bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded text-base"
                                                                    />
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setStockAdjustments(p => ({...p, [key]: val + 1}))}
                                                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-black text-gray-500 transition-colors"
                                                                    >+</button>
                                                                </div>
                                                            </td>
                                                        )
                                                    })}
                                                    <td className="p-3 border-l border-border text-center font-black text-blue-600 bg-gray-50/30">
                                                        {totalRow}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div className="p-6 border-t border-border flex gap-3 bg-gray-50/50 dark:bg-gray-800/50">
                            <button
                                onClick={() => setAdjustingProduct(null)}
                                className="flex-1 py-3 px-4 bg-card border border-border text-foreground font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitStockAdjustment}
                                disabled={isAdjusting}
                                className="flex-1 py-3 px-4 bg-foreground text-background font-bold text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition shadow-lg disabled:opacity-50"
                            >
                                {isAdjusting ? 'Guardando...' : 'Guardar Ajuste'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isBulkModalOpen && (
                <BulkActionsModal 
                    selectedIds={selectedIds} 
                    onClose={() => setIsBulkModalOpen(false)}
                    onSuccess={() => {
                        setIsBulkModalOpen(false);
                        setSelectedIds([]);
                        loadInventory();
                    }}
                />
            )}
        </div>
    );
}

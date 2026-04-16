"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createProduct, getCategories, getBrands, createBrand, createSubcategory, getSuppliers, createSupplier, getStoreLocations } from './actions';
import { processImage } from '@/lib/imageUtils';
import { getTags, createTag } from '../../inventory/tags/actions';
import { getSessionUser } from '@/app/actions/auth';

export default function NewProductPage() {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);

    const [brands, setBrands] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        brandId: '',
        supplierId: '',
        category: '',
        subcategoryId: '',
        basePrice: '',
        wholesalePrice: '',
        cost: '',
        sellByPackage: false,
        packageSize: '6',
        isOnline: true,
        isPOS: true,
        variantOptions: [],
        inventory: {} as Record<string, string | number>, // Key will be JSON.stringify(attributes)
        wholesaleMethods: [] as any[],
        activeMethodId: '',
        images: [] as string[],
        tagIds: [] as string[],
        sku: ''
    });
    const [newTag, setNewTag] = useState('');
    const [isCreatingTag, setIsCreatingTag] = useState(false);
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');

    const handleGenerateDescription = async () => {
        if (formData.images.length === 0) {
            alert('Sube al menos una foto del producto para generar la descripción.');
            return;
        }
        setIsGeneratingDesc(true);
        try {
            const response = await fetch('/api/ai-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    images: formData.images.slice(0, 3),
                    productName: formData.name || '',
                    customPrompt: aiPrompt || ''
                })
            });
            const data = await response.json();
            if (data.description) {
                setFormData(prev => ({ ...prev, description: data.description }));
            } else {
                alert(data.error || 'No se pudo generar la descripción. Verifica tu configuración de IA en Configuración > General.');
            }
        } catch (e) {
            alert('Error al conectar con la IA. Intenta de nuevo.');
        }
        setIsGeneratingDesc(false);
    };

    // Genera el SKU automático basado en categoría, subcategoría, marca y nombre del producto
    const generateSKU = (
        categorySlug: string,
        subcategoryId: string,
        brandId: string,
        productName: string
    ): string => {
        // Prefijo de categoría — 2 letras de la subcategoría o categoría
        const cat = categories.find(c => c.slug === categorySlug);
        const subcat = cat?.subcategories?.find((s: any) => s.id === subcategoryId);
        const brand = brands.find(b => b.id === brandId);

        // Extraer 2 letras de la categoría
        const catCode = (cat?.name || categorySlug || 'XX')
            .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '').slice(0, 2);

        // Extraer 2 letras de la subcategoría
        const subcatCode = (subcat?.name || '')
            .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '').slice(0, 2);

        // Extraer 2 letras de la marca
        const brandCode = (brand?.name || '')
            .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '').slice(0, 2);

        // Extraer números del nombre del producto (número de modelo)
        const modelNumber = productName.replace(/[^0-9]/g, '').slice(0, 6);

        return `${catCode}${subcatCode}${brandCode}${modelNumber}`.slice(0, 20);
    };

    const [newOptionName, setNewOptionName] = useState('');

    useEffect(() => {
        async function load() {
            const [cats, brs, sups, tgs, userData, locs] = await Promise.all([
                getCategories(),
                getBrands(),
                getSuppliers(),
                getTags(),
                getSessionUser(),
                getStoreLocations()
            ]);
            setCategories(cats);
            setBrands(brs);
            setSuppliers(sups);
            setTags(tgs);
            setUser(userData);
            setLocations(locs);
        }
        load();
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
            try {
                const { url, isStorage, sizeKB } = await processImage(file, 'products');
                console.log(`Imagen procesada: ${sizeKB}KB ${isStorage ? '(Storage)' : '(base64 comprimido)'}`);
                setFormData(prev => ({
                    ...prev,
                    images: [...prev.images, url]
                }));
            } catch {
                // Fallback: subir sin comprimir
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = reader.result as string;
                    setFormData(prev => ({ ...prev, images: [...prev.images, base64String] }));
                };
                reader.readAsDataURL(file);
            }
        }
        if (e.target) e.target.value = '';
    };

    const handleRemoveImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleAddOption = () => {
        if (newOptionName.trim()) {
            setFormData(prev => ({
                ...prev,
                variantOptions: [...prev.variantOptions, { name: newOptionName.trim(), values: [] }]
            }));
            setNewOptionName('');
        }
    };

    const handleRemoveOption = (index: number) => {
        setFormData(prev => ({
            ...prev,
            variantOptions: prev.variantOptions.filter((_, i) => i !== index)
        }));
    };

    const handleAddValue = (optionIndex: number, value: string) => {
        if (!value.trim()) return;
        setFormData(prev => {
            const newOptions = [...prev.variantOptions];
            if (!newOptions[optionIndex].values.includes(value.trim())) {
                newOptions[optionIndex].values = [...newOptions[optionIndex].values, value.trim()];
            }
            return { ...prev, variantOptions: newOptions };
        });
    };

    const handleRemoveValue = (optionIndex: number, value: string) => {
        setFormData(prev => {
            const newOptions = [...prev.variantOptions];
            newOptions[optionIndex].values = newOptions[optionIndex].values.filter(v => v !== value);
            return { ...prev, variantOptions: newOptions };
        });
    };

    const handleInventoryChange = (attrKey: string, locationId: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            inventory: {
                ...prev.inventory,
                [`${attrKey}_${locationId}`]: value
            }
        }));
    };

    const handleWholesaleChange = (attrKey: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            wholesaleMethods: prev.wholesaleMethods.map(m => 
                m.id === prev.activeMethodId 
                    ? { ...m, composition: { ...m.composition, [attrKey]: value } }
                    : m
            )
        }));
    };

    const handleAddWholesaleMethod = () => {
        const name = window.prompt("Nombre del nuevo método (ej: Caja de 24, Paquete especial):");
        if (name?.trim()) {
            const newId = Math.random().toString(36).substr(2, 9);
            setFormData(prev => ({
                ...prev,
                wholesaleMethods: [...prev.wholesaleMethods, { id: newId, name: name.trim(), price: '', composition: {} }],
                activeMethodId: newId
            }));
        }
    };

    const handleWholesalePriceChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            wholesaleMethods: prev.wholesaleMethods.map(m => 
                m.id === prev.activeMethodId ? { ...m, price: value } : m
            )
        }));
    };

    const handleRemoveWholesaleMethod = (id: string) => {
        if (formData.wholesaleMethods.length <= 1) return alert("Debe haber al menos un método de mayoreo.");
        setFormData(prev => ({
            ...prev,
            wholesaleMethods: prev.wholesaleMethods.filter(m => m.id !== id),
            activeMethodId: prev.activeMethodId === id ? prev.wholesaleMethods.find(m => m.id !== id)?.id || '' : prev.activeMethodId
        }));
    };

    const handleCreateTag = async () => {
        if (!newTag.trim()) return;
        setIsCreatingTag(true);
        const res = await createTag(newTag.trim());
        if (res.success && res.tag) {
            setTags(prev => [...prev, res.tag]);
            setFormData(prev => ({
                ...prev,
                tagIds: [...prev.tagIds, res.tag.id]
            }));
            setNewTag('');
        } else {
            alert(res.error || "Error al crear la etiqueta");
        }
        setIsCreatingTag(false);
    };

    const generateCombinations = (options: { name: string, values: string[] }[]) => {
        if (options.length === 0) return [];
        let combinations: Record<string, string>[] = [{}];
        
        for (const option of options) {
            const newCombinations: Record<string, string>[] = [];
            for (const combo of combinations) {
                for (const value of option.values) {
                    newCombinations.push({ ...combo, [option.name]: value });
                }
            }
            combinations = newCombinations;
        }
        return combinations.filter(c => Object.keys(c).length === options.length);
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) return alert("El nombre del producto es requerido.");
        if (!formData.supplierId) return alert("Debe seleccionar o crear al menos un Proveedor para continuar.");

        setIsSubmitting(true);
        try {
            const combinations = generateCombinations(formData.variantOptions);
            const variantsData = combinations.map(combo => {
                const attrKey = JSON.stringify(combo);
                let totalStock = 0;
                const inventoryLevels: { locationId: string, quantity: number }[] = [];
                
                locations.forEach(loc => {
                    const quantity = parseInt((formData.inventory[`${attrKey}_${loc.id}`] || "0").toString()) || 0;
                    totalStock += quantity;
                    if (quantity >= 0) { // we send it even if 0 to initialize it
                        inventoryLevels.push({ locationId: loc.id, quantity });
                    }
                });

                return {
                    attributes: combo,
                    stock: totalStock,
                    inventoryLevels
                };
            });

            // Exclude old inventory shape to avoid type conflicts
            const { inventory, wholesaleMethods, activeMethodId, ...submissionData } = formData;

            const result = await createProduct({
                ...submissionData,
                basePrice: formData.basePrice,
                wholesalePrice: formData.wholesalePrice,
                cost: formData.cost,
                sku: formData.sku.trim() || null,
                categoryId: categories.find(c => c.slug === formData.category)?.id,
                variantOptions: formData.variantOptions,
                variantsData,
                wholesaleComposition: formData.sellByPackage ? formData.wholesaleMethods : null
            });
            if (result.success) {
                alert('Producto guardado correctamente');
                window.location.href = '/products';
            } else {
                alert('Error al guardar: ' + result.error);
            }
        } catch (error) {
            console.error(error);
            alert('Error inesperado');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedCategory = categories.find(c => c.slug === formData.category);

    return (
        <div className="max-w-4xl mx-auto py-6 lg:py-10 px-4">
            <div className="mb-10 text-center">
                <h1 className="text-3xl lg:text-4xl font-black text-foreground tracking-tight">Nuevo Producto</h1>
                <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Llene la ficha técnica para sincronizar su stock en la nube.</p>

                {/* Stepper */}
                <div className="mt-10 flex justify-center items-center gap-2 lg:gap-4 scale-90 lg:scale-100">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all ${step >= 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>1</div>
                    <div className={`h-1.5 w-8 lg:w-16 rounded-full transition-all ${step >= 2 ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}></div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all ${step >= 2 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>2</div>
                    <div className={`h-1.5 w-8 lg:w-16 rounded-full transition-all ${step >= 3 ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}></div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all ${step >= 3 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>3</div>
                </div>
            </div>

            <div className="bg-card rounded-3xl shadow-2xl border border-border overflow-hidden min-h-[500px] flex flex-col transition-all duration-300">
                <div className="p-6 lg:p-10 flex-1">
                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="border-b border-border pb-4 flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-black text-foreground">General</h2>
                                    <p className="text-sm text-gray-500">Información básica del modelo.</p>
                                </div>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                                        <input type="checkbox" checked={formData.isOnline} onChange={e => setFormData({ ...formData, isOnline: e.target.checked })} className="rounded text-blue-600 w-4 h-4" />
                                        En Línea
                                    </label>
                                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                                        <input type="checkbox" checked={formData.isPOS} onChange={e => setFormData({ ...formData, isPOS: e.target.checked })} className="rounded text-blue-600 w-4 h-4" />
                                        Punto de Venta
                                    </label>
                                </div>
                            </div>

                            {/* Images */}
                            <div className="space-y-4">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Fotografías del Producto</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {formData.images.map((img, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-border group bg-gray-50/50 dark:bg-card/50 border-dashed">
                                            <img src={img} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => handleRemoveImage(idx)}
                                                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg font-bold"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                                    >
                                        <span className="text-3xl mb-2">📸</span>
                                        <span className="text-xs font-bold px-4 text-center">Agregar Foto</span>
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*" 
                                        multiple 
                                        onChange={handleImageUpload} 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Nombre del Producto</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Pantalón Deezer 2566"
                                        className="w-full px-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground placeholder:text-gray-400"
                                        value={formData.name}
                                        onChange={(e) => {
                                            const newName = e.target.value;
                                            const newSku = generateSKU(formData.category, formData.subcategoryId, formData.brandId, newName);
                                            setFormData({ ...formData, name: newName, sku: newSku });
                                        }}
                                    />
                                </div>
                                {/* SKU auto-generado */}
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                                        ID / SKU del Producto
                                        <span className="ml-2 text-blue-500 normal-case font-medium text-[10px]">Auto-generado · editable</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: PADAES2566"
                                        className="w-full px-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground placeholder:text-gray-400 font-mono font-bold tracking-widest uppercase"
                                        value={formData.sku}
                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                                    />
                                    {formData.sku && (
                                        <p className="text-[10px] text-gray-400 font-medium px-1">
                                            Busca este producto en el POS escribiendo: <span className="font-black text-blue-600">{formData.sku}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Marca</label>
                                    <select
                                        className="w-full px-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground"
                                        value={formData.brandId}
                                        onChange={async (e) => {
                                            if (e.target.value === '__NEW__') {
                                                const name = window.prompt("Ingrese el nombre de la nueva marca:");
                                                if (name?.trim()) {
                                                    const res = await createBrand(name);
                                                    if (res.success && res.brand) {
                                                        setBrands([...brands, res.brand]);
                                                        setFormData(prev => ({ ...prev, brandId: res.brand.id }));
                                                    } else {
                                                        alert(res.error || "Error al crear la marca");
                                                    }
                                                }
                                            } else {
                                                const newSku = generateSKU(formData.category, formData.subcategoryId, e.target.value, formData.name);
                                                setFormData({ ...formData, brandId: e.target.value, sku: newSku });
                                            }
                                        }}
                                    >
                                        <option value="">Seleccionar Marca</option>
                                        <option value="__NEW__" className="font-bold text-blue-600">(+) Crear Nueva Marca</option>
                                        {brands.map(brand => (
                                            <option key={brand.id} value={brand.id}>{brand.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Proveedor *</label>
                                    <select
                                        required
                                        className="w-full px-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground"
                                        value={formData.supplierId}
                                        onChange={async (e) => {
                                            if (e.target.value === '__NEW__') {
                                                const name = window.prompt("Ingrese el nombre del nuevo proveedor:");
                                                if (name?.trim()) {
                                                    const res = await createSupplier(name);
                                                    if (res.success && res.supplier) {
                                                        setSuppliers([...suppliers, res.supplier]);
                                                        setFormData(prev => ({ ...prev, supplierId: res.supplier.id }));
                                                    } else {
                                                        alert(res.error || "Error al crear el proveedor");
                                                    }
                                                }
                                            } else {
                                                setFormData({ ...formData, supplierId: e.target.value });
                                            }
                                        }}
                                    >
                                        <option value="">Seleccionar Proveedor...</option>
                                        <option value="__NEW__" className="font-bold text-blue-600">(+) Crear Nuevo Proveedor</option>
                                        {suppliers.map(sup => (
                                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Categoría</label>
                                    <select
                                        className="w-full px-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground"
                                        value={formData.category}
                                        onChange={(e) => {
                                            const newSku = generateSKU(e.target.value, '', formData.brandId, formData.name);
                                            setFormData({ ...formData, category: e.target.value, subcategoryId: '', sku: newSku });
                                        }}
                                    >
                                        <option value="">Seleccionar Categoría</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.slug}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Subcategoría</label>
                                    <select
                                        className="w-full px-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground disabled:opacity-50"
                                        value={formData.subcategoryId}
                                        onChange={async (e) => {
                                            if (e.target.value === '__NEW__') {
                                                const name = window.prompt("Ingrese el nombre de la nueva subcategoría:");
                                                if (name?.trim() && formData.category) {
                                                    const res = await createSubcategory(name, formData.category);
                                                    if (res.success && res.subcategory) {
                                                        const newCats = [...categories];
                                                        const catIndex = newCats.findIndex(c => c.slug === formData.category);
                                                        if (catIndex >= 0) {
                                                            if (!newCats[catIndex].subcategories) newCats[catIndex].subcategories = [];
                                                            newCats[catIndex].subcategories.push(res.subcategory);
                                                            setCategories(newCats);
                                                        }
                                                        setFormData(prev => ({ ...prev, subcategoryId: res.subcategory.id }));
                                                    } else {
                                                        alert(res.error || "Error al crear subcategoría");
                                                    }
                                                }
                                            } else {
                                                const newSku = generateSKU(formData.category, e.target.value, formData.brandId, formData.name);
                                                setFormData({ ...formData, subcategoryId: e.target.value, sku: newSku });
                                            }
                                        }}
                                        disabled={!formData.category} // allow creating if at least base category is selected
                                    >
                                        <option value="">Seleccionar Subcategoría</option>
                                        {formData.category && user?.role === 'ADMIN' && <option value="__NEW__" className="font-bold text-blue-600">(+) Crear Nueva Subcategoría</option>}
                                        {selectedCategory?.subcategories?.map((sub: any) => (
                                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Costo Adquisición ($MXN)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3.5 font-bold text-gray-400">$</span>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold text-emerald-600 dark:text-emerald-400"
                                            value={formData.cost}
                                            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Precio Menudeo ($MXN)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3.5 font-bold text-gray-400">$</span>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold"
                                            value={formData.basePrice}
                                            onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                                        />
                                    </div>
                                </div>

                            </div>

                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">📦</span>
                                        <div>
                                            <p className="font-black text-blue-900 dark:text-blue-300">Venta por Corridas (Mayoreo)</p>
                                            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Habilitar para venta exclusiva de paquetes cerrados de mayoreo.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setFormData({ ...formData, sellByPackage: !formData.sellByPackage })}
                                        className={`w-14 h-8 rounded-full transition-all relative ${formData.sellByPackage ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.sellByPackage ? 'left-7' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                {formData.sellByPackage && (
                                    <div className="pt-4 border-t border-blue-200 dark:border-blue-800 flex items-center gap-4 animate-in zoom-in-95 duration-200">
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-blue-800 dark:text-blue-400">Podrá definir la composición exacta (tallas/colores) en el Paso 3.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Descripción detallada</label>
                                    <button
                                        type="button"
                                        onClick={handleGenerateDescription}
                                        disabled={isGeneratingDesc || formData.images.length === 0}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-black rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        {isGeneratingDesc ? '⏳ Generando...' : '✨ Generar con IA'}
                                    </button>
                                </div>
                                <textarea
                                    rows={2}
                                    placeholder="Instrucciones para la IA (opcional). Ej: Solo describe el pantalón, ignora la blusa de la modelo."
                                    className="w-full px-5 py-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none transition text-foreground text-sm"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                />
                                <textarea
                                    rows={3}
                                    placeholder="Detalla materiales y fit..."
                                    className="w-full px-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            
                            <div className="space-y-4 pt-6 border-t border-border">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Etiquetas / Tags</label>
                                <p className="text-xs text-gray-500 mb-4">Selecciona etiquetas existentes o crea una nueva escribiendo y presionando Enter.</p>
                                
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        placeholder="Nueva etiqueta (ej: Oferta, Temporada...)"
                                        className="flex-1 px-4 py-2 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-sm font-bold"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleCreateTag();
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={handleCreateTag}
                                        disabled={isCreatingTag || !newTag.trim()}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        + Agregar
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-3 mt-4">
                                    {tags.map(tag => (
                                        <label 
                                            key={tag.id} 
                                            className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold cursor-pointer transition-all ${
                                                formData.tagIds.includes(tag.id) 
                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500/50 dark:text-emerald-400 shadow-sm' 
                                                    : 'bg-input border-border text-foreground hover:border-emerald-300'
                                            }`}
                                        >
                                            <input 
                                                type="checkbox" 
                                                className="hidden"
                                                checked={formData.tagIds.includes(tag.id)}
                                                onChange={(e) => {
                                                    const newTagsList = e.target.checked 
                                                        ? [...formData.tagIds, tag.id] 
                                                        : formData.tagIds.filter(id => id !== tag.id);
                                                    setFormData({ ...formData, tagIds: newTagsList });
                                                }}
                                            />
                                            #{tag.name}
                                        </label>
                                    ))}
                                    {tags.length === 0 && (
                                        <p className="text-[10px] text-gray-400 font-medium italic">No hay etiquetas creadas aún.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="border-b border-border pb-4">
                                <h2 className="text-2xl font-black text-foreground">Configuración de Variantes</h2>
                                <p className="text-sm text-gray-500">Define los atributos y valores que tendrá este modelo (ej. Color, Talla, Material).</p>
                            </div>

                            <div className="space-y-8">
                                {formData.variantOptions.map((option, optIdx) => (
                                    <div key={optIdx} className="bg-gray-50/50 dark:bg-gray-900/20 p-6 rounded-3xl border border-border space-y-4 relative group">
                                        <div className="flex justify-between items-center">
                                            <input 
                                                type="text"
                                                className="bg-transparent text-lg font-black text-foreground outline-none border-b-2 border-transparent focus:border-blue-500 transition-colors w-1/2"
                                                value={option.name}
                                                onChange={(e) => {
                                                    const newOptions = [...formData.variantOptions];
                                                    newOptions[optIdx].name = e.target.value;
                                                    setFormData({ ...formData, variantOptions: newOptions });
                                                }}
                                                placeholder="Nombre del Atributo (ej. Color)"
                                            />
                                            <button 
                                                onClick={() => handleRemoveOption(optIdx)}
                                                className="text-red-500 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 p-2"
                                                title="Eliminar Atributo"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {option.values.map((val, valIdx) => (
                                                <span key={valIdx} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-2xl text-xs font-black transition-all">
                                                    {val}
                                                    <button onClick={() => handleRemoveValue(optIdx, val)} className="text-blue-400 hover:text-red-500 transition-colors">×</button>
                                                </span>
                                            ))}
                                            <input 
                                                type="text"
                                                placeholder="+ valor"
                                                className="px-4 py-2 bg-input border border-border rounded-2xl text-xs focus:ring-2 focus:ring-blue-500/50 outline-none w-32"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddValue(optIdx, (e.target as HTMLInputElement).value);
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}

                                <div className="flex gap-4 items-center pt-4">
                                    <input 
                                        type="text"
                                        placeholder="Nuevo Atributo (ej: Material, Estilo...)"
                                        className="flex-1 px-5 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition"
                                        value={newOptionName}
                                        onChange={(e) => setNewOptionName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                                    />
                                    <button 
                                        onClick={handleAddOption}
                                        className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black transition hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                                    >
                                        Agregar Atributo
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="border-b border-border pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                                <div>
                                    <h2 className="text-2xl font-black text-foreground">Inventario Inicial</h2>
                                    <p className="text-sm text-gray-500">Define el stock inicial para cada combinación generada.</p>
                                </div>
                                
                                {formData.sellByPackage && (
                                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-100 dark:bg-gray-800/50 p-3 rounded-2xl border border-border w-full lg:w-auto">
                                        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2 sm:pb-0 no-scrollbar">
                                            {formData.wholesaleMethods.map(method => (
                                                <div key={method.id} className="flex shrink-0">
                                                    <button
                                                        onClick={() => setFormData({ ...formData, activeMethodId: method.id })}
                                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${formData.activeMethodId === method.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-foreground'}`}
                                                    >
                                                        {method.name}
                                                        {formData.wholesaleMethods.length > 1 && (
                                                            <span onClick={(e) => { e.stopPropagation(); handleRemoveWholesaleMethod(method.id); }} className="hover:text-red-300 ml-1">×</span>
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                            <button 
                                                onClick={handleAddWholesaleMethod}
                                                className="px-4 py-2 rounded-xl text-xs font-black text-blue-500 hover:bg-white dark:hover:bg-gray-800 shadow-sm border border-dashed border-blue-200 dark:border-blue-800 transition-all shrink-0 whitespace-nowrap"
                                            >
                                                + Añadir Método
                                            </button>
                                        </div>

                                        {formData.wholesaleMethods.length > 0 && (
                                            <>
                                                <div className="hidden md:block h-8 w-[1px] bg-border mx-2" />
                                                <div className="flex items-center gap-3 shrink-0 bg-white dark:bg-gray-900 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-900/40">
                                                    <label className="text-[10px] font-black uppercase text-blue-600 tracking-tighter">Precio/pz:</label>
                                                    <div className="relative">
                                                        <span className="absolute left-0 top-1 text-xs font-bold text-gray-400">$</span>
                                                        <input 
                                                            type="number"
                                                            placeholder="0.00"
                                                            className="w-20 pl-4 bg-transparent border-none text-xs font-black outline-none focus:ring-0 text-foreground"
                                                            value={formData.wholesaleMethods.find(m => m.id === formData.activeMethodId)?.price || ''}
                                                            onChange={(e) => handleWholesalePriceChange(e.target.value)}
                                                        />
                                                    </div>
                                                    {(() => {
                                                        const activeMethod = formData.wholesaleMethods.find((m: any) => m.id === formData.activeMethodId);
                                                        if (!activeMethod?.price) return null;
                                                        const pieces = Object.values(activeMethod.composition || {}).reduce((a: number, b: any) => a + (parseInt(b as string) || 0), 0) as number;
                                                        if (pieces === 0) return null;
                                                        const total = parseFloat(activeMethod.price) * pieces;
                                                        return (
                                                            <span className="text-[10px] text-blue-500 font-black ml-2">
                                                                = ${total.toFixed(2)} total ({pieces} pz)
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {generateCombinations(formData.variantOptions).length > 0 ? (
                                <div className="space-y-6">
                                    <div className="overflow-x-auto rounded-3xl border border-border shadow-inner bg-gray-50/50 dark:bg-gray-900/20">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-border bg-gray-50/50 dark:bg-gray-800/50">
                                                    <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Combinación</th>
                                                    {locations.map(loc => (
                                                        <th key={loc.id} className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-center w-32 bg-blue-50/30 dark:bg-blue-900/10 border-l border-border">
                                                            Stock {loc.name} {loc.isWebStore ? '🌐' : '🏪'}
                                                        </th>
                                                    ))}
                                                    {formData.sellByPackage && (
                                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 text-center w-48 border-l border-border">
                                                            Pz x {formData.wholesaleMethods.find(m => m.id === formData.activeMethodId)?.name || 'Corrida'}
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {generateCombinations(formData.variantOptions).map((combo, idx) => {
                                                    const attrKey = JSON.stringify(combo);
                                                    const activeMethod = formData.wholesaleMethods.find(m => m.id === formData.activeMethodId);
                                                    return (
                                                        <tr key={idx} className="border-b border-border/50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                                            <td className="p-4 min-w-[200px]">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {Object.entries(combo).map(([k, v], i) => (
                                                                        <span key={i} className="px-3 py-1 bg-white dark:bg-gray-800 shadow-sm border border-border/50 rounded-lg text-xs font-black text-foreground">
                                                                            <span className="opacity-50 font-medium mr-1">{k}:</span> {v}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            {locations.map(loc => (
                                                                <td key={loc.id} className="p-2 border-l border-border bg-blue-50/10 dark:bg-blue-900/5">
                                                                    <div className="bg-input border border-border/50 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all shadow-inner">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            placeholder="0"
                                                                            className="w-full bg-transparent p-3 outline-none text-center font-black text-blue-600 dark:text-blue-400 text-lg"
                                                                            value={formData.inventory[`${attrKey}_${loc.id}`] || ''}
                                                                            onChange={(e) => handleInventoryChange(attrKey, loc.id, e.target.value)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            ))}
                                                            {formData.sellByPackage && (
                                                                <td className="p-3">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        placeholder="0"
                                                                        className="w-full bg-input border border-blue-200 dark:border-blue-800 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/50 outline-none text-center font-bold text-blue-900 dark:text-blue-100"
                                                                        value={activeMethod?.composition?.[attrKey] || ''}
                                                                        onChange={(e) => handleWholesaleChange(attrKey, e.target.value)}
                                                                    />
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    {formData.sellByPackage && (
                                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                            <p className="text-xs font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2">
                                                <span>💡</span> Puede crear múltiples métodos (Corridas, Cajas, Paquetes) y definir su composición. Cada método guardado aparecerá como acceso rápido en el Punto de Venta.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-12 text-center rounded-3xl border-2 border-dashed border-border flex flex-col items-center opacity-60">
                                    <span className="text-5xl mb-4">⚠️</span>
                                    <p className="font-bold text-gray-500">Configure al menos un atributo y un valor en el paso anterior.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="p-8 bg-gray-50 dark:bg-gray-900/30 border-t border-border flex justify-between items-center">
                    <button
                        disabled={step === 1}
                        onClick={() => setStep(step - 1)}
                        className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${step === 1 ? 'opacity-0 scale-90 pointer-events-none' : 'text-gray-500 hover:text-foreground'}`}
                    >
                        Anterior
                    </button>

                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            className="px-12 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                        >
                            Siguiente Paso
                        </button>
                    ) : (
                        <button
                            disabled={isSubmitting}
                            onClick={handleSubmit}
                            className="px-12 py-3 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 shadow-xl shadow-green-500/20 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Guardando en la Nube...' : 'Finalizar y Publicar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

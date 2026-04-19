"use client";
import { DEFAULT_PLANS } from '@/lib/plans';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
    updateMarketplaceSettingsFull,
    getSellersList,
    getProductsSearch,
    getSellersWithPermissions,
    deleteSellerPermanently,
    updateSellerPermissions,
    getPhotographyRequests,
    updatePhotographyRequest,
    updateAdminEmail,
    assignSellerSlug,
    savePlans,
    getPlans,
    getInactiveSellers,
    deleteSellerForever,
    reactivateSeller,
    updateBrandConfig,
    toggleBrandActive,
    deleteBrandConfig,
} from '@/app/actions/marketplace';
import { updateApplicationStatus } from '@/app/(seller-center)/admin/applications/actions';
import { getSellerApplications } from '@/app/actions/admin';
import { requestPasswordReset } from '@/app/actions/auth';
import { validateImageFile } from '@/lib/uploadImage';
import { processImage } from '@/lib/imageUtils';
import { toast } from 'sonner';

const TABS = [
    { key: 'site', label: '🎨 Sitio', icon: '🎨' },
    { key: 'sellers', label: '🏭 Vendedores', icon: '🏭' },
    { key: 'featured', label: '⭐ Destacados', icon: '⭐' },
    { key: 'photos', label: '📸 Fotografía', icon: '📸' },
    { key: 'plans', label: '💼 Planes', icon: '💼' },
    { key: 'brands', label: '🌐 Marcas', icon: '🌐' },
    { key: 'admin', label: '⚙️ Mi Cuenta', icon: '⚙️' },
];

export default function MarketplaceClient({ initialSettings }: { initialSettings: any }) {
    const [activeTab, setActiveTab] = useState('site');
    const [settings, setSettings] = useState(initialSettings);
    const [loading, setLoading] = useState(false);
    const [savingBrand, setSavingBrand] = useState<string | null>(null);

    // Modal nueva marca
    const [showNewBrandModal, setShowNewBrandModal] = useState(false);
    const [newBrandSellerId, setNewBrandSellerId] = useState('');
    const [newBrandDomain, setNewBrandDomain] = useState('');
    const [newBrandName, setNewBrandName] = useState('');
    const [newBrandColor, setNewBrandColor] = useState('blue');
    const [newBrandSaving, setNewBrandSaving] = useState(false);
    const [modalSellers, setModalSellers] = useState<any[]>([]);
    const [modalSellersLoaded, setModalSellersLoaded] = useState(false);

    // Tab: Site
    const [title, setTitle] = useState(initialSettings?.title || '');
    const [heroImage, setHeroImage] = useState(initialSettings?.heroImage || '');
    const [heroImages, setHeroImages] = useState<string[]>(
        initialSettings?.heroImages?.length > 0
            ? initialSettings.heroImages
            : (initialSettings?.heroImage ? [initialSettings.heroImage] : [])
    );
    const [newHeroUrl, setNewHeroUrl] = useState('');
    const [loadingHero, setLoadingHero] = useState(false);
    const [logoUrl, setLogoUrl] = useState(initialSettings?.logoUrl || '');
    const [sellerLabel, setSellerLabel] = useState(initialSettings?.sellerLabel || 'Vendedor');
    const heroInputRef = useRef<HTMLInputElement>(null);
    const newHeroRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Tab: Sellers
    const [sellers, setSellers] = useState<any[]>([]);
    const [loadingSellers, setLoadingSellers] = useState(false);
    const [orphanScan, setOrphanScan] = useState<{ count: number; totalMB: string } | null>(null);
    const [orphanDeleting, setOrphanDeleting] = useState(false);
    const [orphanResult, setOrphanResult] = useState<{ deleted: number; freedMB: string } | null>(null);
    const [applications, setApplications] = useState<any[]>([]);
    const [loadingApps, setLoadingApps] = useState(false);
    const [sellerSubTab, setSellerSubTab] = useState<'active' | 'inactive'>('active');
    const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());
    const toggleSeller = (id: string) => setExpandedSellers(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const [inactiveSellers, setInactiveSellers] = useState<any[]>([]);
    const [loadingInactive, setLoadingInactive] = useState(false);
    const [plans, setPlans] = useState<any[]>([]);
    const [savingPlans, setSavingPlans] = useState(false);

    // Tab: Featured
    const [productQuery, setProductQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedSellers, setSelectedSellers] = useState<string[]>(initialSettings?.featuredSellerIds || []);
    const [selectedProducts, setSelectedProducts] = useState<string[]>(initialSettings?.featuredProductIds || []);
    const [allSellers, setAllSellers] = useState<any[]>([]);

    // Tab: Photos
    const [photoRequests, setPhotoRequests] = useState<any[]>([]);

    // Tab: Admin
    const [adminEmail, setAdminEmail] = useState(initialSettings?.adminEmail || '');
    const [privacyUrl, setPrivacyUrl] = useState(initialSettings?.privacyUrl || '');
    const [termsUrl, setTermsUrl] = useState(initialSettings?.termsUrl || '');
    const [brandColors, setBrandColors] = useState<Record<string,string>>({
        'modazapotlanejo.com': (initialSettings?.brandColors as any)?.['modazapotlanejo.com'] || 'blue',
        'zonadelvestir.com': (initialSettings?.brandColors as any)?.['zonadelvestir.com'] || 'violet',
    });
    const [brands, setBrands] = useState<any[]>(initialSettings?.brandsConfig || []);
    const [editingBrand, setEditingBrand] = useState<any>(null);
    const [photographyEnabled, setPhotographyEnabled] = useState(initialSettings?.photographyEnabled !== false);
    const [photoPrices, setPhotoPrices] = useState(initialSettings?.photographyPrices || [
        { paquete: 'Básico', piezas: '1–10 piezas', precio: '$800', includes: 'Fondo blanco · 1 toma/pieza' },
        { paquete: 'Estándar', piezas: '11–30 piezas', precio: '$1,500', includes: 'Fondo blanco · 2 tomas/pieza' },
        { paquete: 'Pro', piezas: '31–60 piezas', precio: '$2,500', includes: 'Fondo blanco+ambiente · 3 tomas/pieza' },
        { paquete: 'Full', piezas: '60+ piezas', precio: 'Cotizar', includes: 'Personalizado · Modelo incluido' },
    ]);

    const handleSavePlans = async () => {
        setSavingPlans(true);
        const res = await savePlans(plans);
        if (res.success) toast.success('Planes guardados correctamente');
        else toast.error(res.error || 'Error al guardar');
        setSavingPlans(false);
    };

    const handleScanOrphans = async () => {
        setOrphanScan(null);
        setOrphanResult(null);
        try {
            const res = await fetch('/api/admin/orphaned-images');
            const data = await res.json();
            setOrphanScan({ count: data.count, totalMB: data.totalMB });
        } catch (e: any) {
            alert('Error al escanear: ' + e.message);
        }
    };

    const handleDeleteOrphans = async () => {
        if (!orphanScan || orphanScan.count === 0) return;
        if (!confirm(`¿Eliminar ${orphanScan.count} archivos huérfanos (${orphanScan.totalMB} MB)? Esta acción no se puede deshacer.`)) return;
        setOrphanDeleting(true);
        try {
            const res = await fetch('/api/admin/orphaned-images', { method: 'DELETE' });
            const data = await res.json();
            setOrphanResult({ deleted: data.deleted, freedMB: data.freedMB });
            setOrphanScan(null);
        } catch (e: any) {
            alert('Error al eliminar: ' + e.message);
        } finally {
            setOrphanDeleting(false);
        }
    };

    const loadSellers = async () => {
        setLoadingSellers(true);
        try {
            const data = await getSellersWithPermissions();
            setSellers(data || []);
        } catch { setSellers([]); }
        setLoadingSellers(false);
    };

    // useEffect va DESPUÉS de declarar las funciones para evitar hoisting issues
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (activeTab === 'sellers') {
            loadSellers();
            setLoadingApps(true);
            getSellerApplications().then(apps => { setApplications(apps || []); setLoadingApps(false); }).catch(() => setLoadingApps(false));
            setLoadingInactive(true);
            getInactiveSellers().then(list => { setInactiveSellers(list || []); setLoadingInactive(false); }).catch(() => setLoadingInactive(false));
        }
        if (activeTab === 'featured') loadAllSellers();
        if (activeTab === 'photos') loadPhotos();

        if (activeTab === 'plans') {
            getPlans().then(p => setPlans(p || [])).catch(() => setPlans([]));
        }
    }, [activeTab]);

    const loadAllSellers = async () => {
        const res = await getSellersList();
        if (res.success) setAllSellers(res.data || []);
    };

    const loadPhotos = async () => {
        const data = await getPhotographyRequests();
        setPhotoRequests(data);
    };

    const handleImageUpload = async (file: File, target: 'hero' | 'logo') => {
        const validation = validateImageFile(file);
        if (!validation.valid) { toast.error(validation.error); return; }
        try {
            const folder = target === 'hero' ? 'hero' : 'marketplace-logos';
            const { url, sizeKB } = await processImage(file, folder);
            if (target === 'hero') {
                setHeroImage(url);
                // Autoguardar inmediatamente
                const res = await updateMarketplaceSettingsFull({ title, heroImage: url, logoUrl, sellerLabel });
                if (res.success) toast.success(`Imagen de fondo actualizada (${sizeKB}KB)`);
                else toast.error(res.error || 'Error al guardar');
            } else {
                setLogoUrl(url);
                toast.success(`Logo actualizado (${sizeKB}KB)`);
            }
        } catch {
            // Fallback sin compresión
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                if (target === 'hero') setHeroImage(dataUrl);
                else setLogoUrl(dataUrl);
            };
            reader.readAsDataURL(file);
        }
    };
    const handleAddHeroImage = async (file: File) => {
        const validation = validateImageFile(file);
        if (!validation.valid) { toast.error(validation.error); return; }
        setLoadingHero(true);
        try {
            const { url, sizeKB } = await processImage(file, 'hero');
            const newImages = [...heroImages, url];
            setHeroImages(newImages);
            const res = await updateMarketplaceSettingsFull({ heroImages: newImages });
            if (res.success) toast.success(`Imagen agregada al slider (${sizeKB}KB)`);
            else toast.error(res.error || 'Error al guardar');
        } catch {
            toast.error('Error al procesar la imagen');
        } finally {
            setLoadingHero(false);
        }
    };

    const handleBrandImageUpload = async (brandDomain: string, target: 'logoUrl' | 'heroImage', file: File) => {
        const validation = validateImageFile(file);
        if (!validation.valid) { toast.error(validation.error); return; }
        setLoading(true);
        try {
            const folder = target === 'heroImage' ? 'brand-hero' : 'brand-logos';
            const { url, sizeKB } = await processImage(file, folder);
            setBrands(prev => prev.map(b => b.domain === brandDomain ? { ...b, [target]: url } : b));
            toast.success(`Imagen procesada (${sizeKB}KB). No olvides guardar los cambios.`);
        } catch {
            toast.error('Error al procesar la imagen');
        } finally {
            setLoading(false);
        }
    };

    const handleAddBrandHeroImage = async (brandDomain: string, file: File) => {
        const validation = validateImageFile(file);
        if (!validation.valid) { toast.error(validation.error); return; }
        setLoading(true);
        try {
            const { url, sizeKB } = await processImage(file, 'brand-hero');
            const currentBrand = brands.find((b: any) => b.domain === brandDomain);
            const newImages = [...(currentBrand?.heroImages || []), url];
            setBrands((prev: any[]) => prev.map(b => b.domain === brandDomain ? { ...b, heroImages: newImages } : b));
            const res = await updateBrandConfig(brandDomain, { heroImages: newImages });
            if (res.success) toast.success(`Imagen agregada al slider (${sizeKB}KB)`);
            else toast.error(res.error || 'Error al guardar');
        } catch {
            toast.error('Error al procesar la imagen');
        } finally {
            setLoading(false);
        }
    };

    const openNewBrandModal = async () => {
        setShowNewBrandModal(true);
        if (!modalSellersLoaded) {
            const res = await getSellersList();
            if (res.success) setModalSellers(res.data || []);
            setModalSellersLoaded(true);
        }
    };

    const handleSellerPickedForBrand = (sellerId: string) => {
        setNewBrandSellerId(sellerId);
        const s = modalSellers.find((s: any) => s.id === sellerId);
        if (s) setNewBrandName(s.businessName || s.name || '');
    };

    const handleCreateBrand = async () => {
        if (!newBrandDomain.trim() || !newBrandName.trim()) {
            toast.error('El dominio y el nombre son obligatorios');
            return;
        }
        setNewBrandSaving(true);
        try {
            const res = await updateBrandConfig(newBrandDomain.trim().toLowerCase(), {
                name: newBrandName.trim(),
                primaryColor: newBrandColor,
                isSingleVendor: !!newBrandSellerId,
                sellerId: newBrandSellerId || undefined,
            });
            if (res.success) {
                toast.success(`Marca "${newBrandName}" creada`);
                setBrands((prev: any[]) => [...prev, res.data]);
                setShowNewBrandModal(false);
                setNewBrandSellerId(''); setNewBrandDomain(''); setNewBrandName(''); setNewBrandColor('blue');
            } else {
                toast.error(res.error || 'Error al crear marca');
            }
        } catch (e: any) {
            toast.error('Error: ' + e.message);
        } finally {
            setNewBrandSaving(false);
        }
    };

    const handleSaveSite = async () => {
        setLoading(true);
        const res = await updateMarketplaceSettingsFull({ title, heroImage: heroImages[0] || '', heroImages, logoUrl, sellerLabel, privacyUrl, termsUrl });
        if (res.success) { toast.success('Configuración guardada'); setSettings(res.data); }
        else toast.error(res.error || 'Error al guardar');
        setLoading(false);
    };

    const handleSaveFeatured = async () => {
        setLoading(true);
        const res = await updateMarketplaceSettingsFull({
            featuredSellerIds: selectedSellers,
            featuredProductIds: selectedProducts,
        });
        if (res.success) toast.success('Destacados actualizados');
        else toast.error(res.error || 'Error al guardar');
        setLoading(false);
    };

    const handleSearchProducts = async (q: string) => {
        setProductQuery(q);
        if (q.length < 2) { setSearchResults([]); return; }
        const res = await getProductsSearch(q);
        if (res.success) setSearchResults(res.data || []);
    };

    const handleTogglePOS = async (seller: any) => {
        const newVal = !seller.posEnabled;
        setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, posEnabled: newVal, posRequested: false } : s));
        const res = await updateSellerPermissions(seller.id, { posEnabled: newVal, posRequested: false });
        if (!res.success) toast.error('Error al actualizar permiso');
        else toast.success(`POS ${newVal ? 'activado' : 'desactivado'} para ${seller.name}`);
    };

    const handleMaxProducts = async (seller: any, val: string) => {
        const num = val === '' ? null : parseInt(val);
        setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, maxProducts: num } : s));
        await updateSellerPermissions(seller.id, { maxProducts: num });
    };

    const handlePlanChange = async (seller: any, field: string, val: string) => {
        const num = parseInt(val) || 1;
        setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, [field]: num } : s));
        await updateSellerPermissions(seller.id, { [field]: num });
    };

    const handlePlanName = async (seller: any, val: string) => {
        setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, planName: val } : s));
        await updateSellerPermissions(seller.id, { planName: val });
    };

    const PLANS = [
        { name: 'Básico', maxLocations: 1, maxCashiers: 1, maxProducts: 50 },
        { name: 'Estándar', maxLocations: 2, maxCashiers: 3, maxProducts: 200 },
        { name: 'Pro', maxLocations: 5, maxCashiers: 10, maxProducts: null },
        { name: 'Empresarial', maxLocations: 20, maxCashiers: 50, maxProducts: null },
    ];

    const applyPlan = async (seller: any, plan: typeof PLANS[0]) => {
        const updated = { ...seller, planName: plan.name, maxLocations: plan.maxLocations, maxCashiers: plan.maxCashiers, maxProducts: plan.maxProducts };
        setSellers(prev => prev.map(s => s.id === seller.id ? updated : s));
        await updateSellerPermissions(seller.id, {
            planName: plan.name,
            maxLocations: plan.maxLocations,
            maxCashiers: plan.maxCashiers,
            maxProducts: plan.maxProducts,
        });
        toast.success(`Plan ${plan.name} aplicado a ${seller.name}`);
    };

    const handleDeleteSeller = async (seller: any) => {
        if (!confirm(`¿Desactivar permanentemente a ${seller.name}? Sus datos históricos se conservan.`)) return;
        const res = await deleteSellerPermanently(seller.id);
        if (res.success) {
            setSellers(prev => prev.filter(s => s.id !== seller.id));
            toast.success('Vendedor desactivado');
        } else toast.error(res.error || 'Error');
    };

    const handleSaveAdminEmail = async () => {
        const res = await updateAdminEmail(adminEmail);
        if (res.success) toast.success('Correo actualizado. Usa el nuevo correo para iniciar sesión.');
        else toast.error(res.error || 'Error');
    };

    const statusColors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-4xl font-black tracking-tight">Panel Administrador</h1>
                <p className="text-gray-500 font-medium mt-2">Gestión global de la plataforma.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit flex-wrap">
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.key ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-foreground'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── TAB: SITIO ── */}
            {activeTab === 'site' && (
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-8 space-y-6 shadow-sm">
                        <h2 className="text-xl font-black">🎨 Identidad Visual</h2>

                        {/* Logo del sitio */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Logo del Sitio</label>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                                    {logoUrl
                                        ? <Image src={logoUrl} alt="Logo" width={80} height={80} className="w-full h-full object-contain" />
                                        : <span className="text-2xl">🌐</span>}
                                </div>
                                <div className="space-y-2">
                                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                                        onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')} />
                                    <button onClick={() => logoInputRef.current?.click()}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition">
                                        {logoUrl ? 'Cambiar Logo' : 'Subir Logo'}
                                    </button>
                                    {logoUrl && <button onClick={() => setLogoUrl('')} className="block text-xs text-red-500 hover:underline font-bold">Eliminar</button>}
                                </div>
                            </div>
                        </div>

                        {/* Título */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Título del Sitio</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none" />
                        </div>

                        {/* Etiqueta vendedor */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                Etiqueta para vendedores
                                <span className="ml-1 normal-case font-medium text-gray-300">(ej. "Vendedor", "Fabricante", "Tienda")</span>
                            </label>
                            <input type="text" value={sellerLabel} onChange={e => setSellerLabel(e.target.value)}
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none" />
                        </div>

                        {/* Selector de colores por dominio */}
                        <div className="space-y-4 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">🎨 Color de Marca por Dominio</label>
                                <p className="text-xs text-gray-400 mt-1">Selecciona el color principal para cada dominio. Se aplica en botones, títulos, riel y más.</p>
                            </div>
                            {([
                                { domain: 'modazapotlanejo.com', label: 'Moda Zapotlanejo' },
                                { domain: 'zonadelvestir.com', label: 'Zona del Vestir' },
                            ] as {domain: string, label: string}[]).map(site => (
                                <div key={site.domain} className="space-y-2">
                                    <p className="text-xs font-black text-foreground">{site.label} <span className="text-gray-400 font-normal">— {site.domain}</span></p>
                                    <div className="flex gap-3 flex-wrap">
                                        {([
                                            { color: 'blue',    hex: '#2563eb', label: 'Azul' },
                                            { color: 'violet',  hex: '#7c3aed', label: 'Violeta' },
                                            { color: 'emerald', hex: '#059669', label: 'Esmeralda' },
                                            { color: 'amber',   hex: '#d97706', label: 'Ámbar' },
                                            { color: 'rose',    hex: '#e11d48', label: 'Rosa' },
                                            { color: 'slate',   hex: '#475569', label: 'Gris' },
                                        ] as {color: string, hex: string, label: string}[]).map(opt => {
                                            const isSelected = brandColors[site.domain] === opt.color;
                                            return (
                                                <button key={opt.color} type="button"
                                                    onClick={async () => {
                                                        const newColors = {...brandColors, [site.domain]: opt.color};
                                                        setBrandColors(newColors);
                                                        const res = await updateMarketplaceSettingsFull({ brandColors: newColors } as any);
                                                        if (res.success) toast.success(`Color ${opt.label} aplicado a ${site.label}`);
                                                        else toast.error('Error al guardar');
                                                    }}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border-2 ${isSelected ? 'scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                                                    style={{backgroundColor: opt.hex + (isSelected ? '30' : '15'), borderColor: isSelected ? opt.hex : 'transparent'}}>
                                                    <span className="w-4 h-4 rounded-full shrink-0 shadow" style={{backgroundColor: opt.hex}} />
                                                    {opt.label}
                                                    {isSelected && <span>✓</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* URLs legales */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">URL Política de Privacidad</label>
                                <input type="url" value={privacyUrl} onChange={e => setPrivacyUrl(e.target.value)}
                                    placeholder="https://... o /privacy"
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/50 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">URL Términos y Condiciones</label>
                                <input type="url" value={termsUrl} onChange={e => setTermsUrl(e.target.value)}
                                    placeholder="https://... o /terms"
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500/50 outline-none" />
                            </div>
                        </div>

                        {/* Hero images slider */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Imágenes del Slider (Landing)</label>
                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-[9px] font-black text-gray-500">
                                    {heroImages.length} imagen{heroImages.length !== 1 ? 'es' : ''}
                                </span>
                            </div>

                            {heroImages.length > 0 && (
                                <div className="grid grid-cols-3 gap-3">
                                    {heroImages.map((img, idx) => (
                                        <div key={idx} className="relative h-24 rounded-xl overflow-hidden border border-border group">
                                            <Image src={img} alt={`Slide ${idx + 1}`} fill className="object-cover" unoptimized />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                                            <button
                                                onClick={() => setHeroImages(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black opacity-0 group-hover:opacity-100 transition hover:bg-red-600">×</button>
                                            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 text-white text-[9px] font-black rounded">{idx + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {heroImages.length === 0 && (
                                <p className="text-xs text-gray-400 font-medium py-2">Sin imágenes — se mostrarán fotos de productos automáticamente.</p>
                            )}

                            <div className="flex gap-3">
                                <input ref={newHeroRef} type="file" accept="image/*" className="hidden"
                                    onChange={e => e.target.files?.[0] && handleAddHeroImage(e.target.files[0])} />
                                <button onClick={() => newHeroRef.current?.click()} disabled={loadingHero}
                                    className="shrink-0 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-border rounded-xl text-xs font-black hover:bg-gray-200 transition disabled:opacity-50">
                                    {loadingHero ? '⏳ Subiendo...' : '📁 Subir imagen'}
                                </button>
                                <input type="text" value={newHeroUrl} onChange={e => setNewHeroUrl(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && newHeroUrl.trim()) { setHeroImages(prev => [...prev, newHeroUrl.trim()]); setNewHeroUrl(''); }}}
                                    placeholder="O pega una URL y presiona Enter..."
                                    className="flex-1 px-4 py-2.5 bg-input border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/50 outline-none" />
                                {newHeroUrl.trim() && (
                                    <button onClick={() => { setHeroImages(prev => [...prev, newHeroUrl.trim()]); setNewHeroUrl(''); }}
                                        className="shrink-0 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition">
                                        + Agregar
                                    </button>
                                )}
                            </div>
                        </div>

                        <button onClick={handleSaveSite} disabled={loading}
                            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50">
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── TAB: VENDEDORES ── */}
            {activeTab === 'sellers' && (
                <div className="space-y-6">

                    {/* Solicitudes pendientes */}
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-5 space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-2">
                            📬 Solicitudes Pendientes
                            <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full text-[9px] font-black">{applications.length}</span>
                        </h3>
                        {loadingApps ? (
                            <div className="flex justify-center p-4"><div className="w-6 h-6 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>
                        ) : applications.length === 0 ? (
                            <div className="p-8 text-center text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/50 font-medium">
                                No hay solicitudes pendientes nuevas
                            </div>
                        ) : applications.map((app: any) => (
                                <div key={app.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 border border-border">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-foreground">{app.storeName}</p>
                                        <p className="text-xs text-gray-500">{app.contactName} · {app.email} · {app.phone}</p>
                                        {app.storeAddress && <p className="text-xs text-blue-500">📍 {app.storeAddress.replace('|', ' — ')}</p>}
                                        <p className="text-[10px] text-gray-400 mt-1">{app.category}</p>
                                        {app.planName && (
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[9px] font-black uppercase rounded-full">
                                                💼 Plan: {app.planName}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={async () => {
                                            await updateApplicationStatus(app.id, 'APPROVED');
                                            setApplications(prev => prev.filter((a: any) => a.id !== app.id));
                                            toast.success(`${app.storeName} aprobado`);
                                        }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition">
                                            ✓ Aprobar
                                        </button>
                                        <button onClick={async () => {
                                            await updateApplicationStatus(app.id, 'REJECTED');
                                            setApplications(prev => prev.filter((a: any) => a.id !== app.id));
                                            toast.success('Solicitud rechazada');
                                        }} className="px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-xl text-xs font-black hover:bg-red-200 transition">
                                            ✕ Rechazar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                    {/* Subpestañas activos / desactivados */}
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
                        <button onClick={() => setSellerSubTab('active')}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${sellerSubTab === 'active' ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm' : 'text-gray-500 hover:text-foreground'}`}>
                            ✅ Activos ({sellers.length})
                        </button>
                        <button onClick={() => setSellerSubTab('inactive')}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${sellerSubTab === 'inactive' ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm' : 'text-gray-500 hover:text-foreground'}`}>
                            🚫 Desactivados ({inactiveSellers.length})
                        </button>
                    </div>

                    {/* Lista de desactivados */}
                    {sellerSubTab === 'inactive' && (
                        <div className="space-y-4">
                            {loadingInactive ? (
                                <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div>
                            ) : inactiveSellers.length === 0 ? (
                                <div className="p-12 text-center bg-card border border-dashed border-border rounded-3xl opacity-50">
                                    <p className="text-3xl mb-2">✅</p>
                                    <p className="text-sm font-black uppercase tracking-widest text-gray-400">No hay vendedores desactivados</p>
                                </div>
                            ) : inactiveSellers.map((seller: any) => (
                                <div key={seller.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4 opacity-70 hover:opacity-100 transition">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-black text-sm text-gray-500">
                                                {(seller.businessName || seller.name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-black text-foreground">{seller.businessName || seller.name}</p>
                                                <p className="text-xs text-gray-400">{seller.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-2 text-[10px] text-gray-400 font-bold">
                                            <span>{seller._count?.ownedProducts || 0} productos</span>
                                            {seller.planName && <span>· Plan: {seller.planName}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={async () => {
                                            const res = await reactivateSeller(seller.id);
                                            if (res.success) {
                                                setInactiveSellers(prev => prev.filter((s: any) => s.id !== seller.id));
                                                loadSellers();
                                                toast.success(`${seller.businessName || seller.name} reactivado`);
                                            } else toast.error(res.error || 'Error');
                                        }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition">
                                            ✓ Reactivar
                                        </button>
                                        <button onClick={async () => {
                                            if (!confirm(`¿ELIMINAR PERMANENTEMENTE a ${seller.businessName || seller.name}? Esta acción es irreversible.`)) return;
                                            const res = await deleteSellerForever(seller.id);
                                            if (res.success) {
                                                setInactiveSellers(prev => prev.filter((s: any) => s.id !== seller.id));
                                                toast.success('Vendedor eliminado permanentemente');
                                            } else toast.error(res.error || 'No se pudo eliminar');
                                        }} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black hover:bg-red-700 transition">
                                            🗑 Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Lista de activos */}
                    {sellerSubTab === 'active' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <h2 className="text-xl font-black">🏭 Gestión de Vendedores</h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-400 font-bold">{sellers.length} vendedores</span>
                                    {!orphanScan && !orphanResult && (
                                        <button onClick={handleScanOrphans}
                                            className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 text-orange-700 rounded-xl text-xs font-black hover:bg-orange-100 transition flex items-center gap-2">
                                            🔍 Escanear Archivos Huérfanos
                                        </button>
                                    )}
                                    {orphanScan && (
                                        <div className="flex items-center gap-2">
                                            {orphanScan.count === 0 ? (
                                                <span className="text-xs font-bold text-emerald-600">✅ Sin huérfanos — disco limpio</span>
                                            ) : (
                                                <>
                                                    <span className="text-xs font-bold text-orange-600">{orphanScan.count} archivos · {orphanScan.totalMB} MB</span>
                                                    <button onClick={handleDeleteOrphans} disabled={orphanDeleting}
                                                        className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 rounded-xl text-xs font-black hover:bg-red-100 transition disabled:opacity-50">
                                                        {orphanDeleting ? '⏳ Eliminando...' : '🗑️ Eliminar'}
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={() => setOrphanScan(null)}
                                                className="text-xs text-gray-400 hover:text-gray-600 font-bold">✕</button>
                                        </div>
                                    )}
                                    {orphanResult && (
                                        <span className="text-xs font-bold text-emerald-600">✅ {orphanResult.deleted} archivos eliminados · {orphanResult.freedMB} MB liberados</span>
                                    )}
                                </div>
                            </div>
                            {loadingSellers ? (
                                <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
                            ) : sellers.map((seller: any) => (
                                <div key={seller.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                                    <div className="flex items-start justify-between gap-4 p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                         onClick={() => toggleSeller(seller.id)}>
                                        <div className="flex items-center gap-3">
                                            {seller.logoUrl
                                                ? <Image src={seller.logoUrl} alt={seller.name} width={40} height={40} className="w-10 h-10 rounded-xl object-contain border border-border" />
                                                : <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-black text-lg">{seller.name.charAt(0)}</div>
                                            }
                                            <div>
                                                <p className="font-black text-foreground">{seller.businessName || seller.name}</p>
                                                <p className="text-xs text-gray-400 font-medium">{seller.email} · {seller._count?.ownedProducts || 0} productos</p>
                                                {(seller.phone || seller.whatsapp) && (
                                                    <p className="text-xs text-emerald-600 font-bold">📱 {seller.whatsapp || seller.phone}</p>
                                                )}
                                                <p className="text-[10px] text-gray-400">
                                                    Miembro desde {new Date((seller as any).createdAt).toLocaleDateString('es-MX', {month:'short', year:'numeric'})}
                                                </p>
                                                {seller.sellerSlug ? (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-[10px] font-mono text-blue-500">/acceso/{seller.sellerSlug}</p>
                                                        <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/acceso/${seller.sellerSlug}`); toast.success('URL copiada'); }}
                                                            className="text-[9px] font-black text-gray-400 hover:text-blue-600 transition uppercase">Copiar</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={async e => { e.stopPropagation();
                                                        const res = await assignSellerSlug(seller.id);
                                                        if (res.success) { setSellers(prev => prev.map((s: any) => s.id === seller.id ? { ...s, sellerSlug: res.slug } : s)); toast.success('URL generada'); }
                                                        else toast.error(res.error || 'Error');
                                                    }} className="text-[9px] font-black text-orange-500 hover:text-orange-600 uppercase tracking-wide mt-0.5 block">
                                                        ⚡ Generar URL del POS
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-gray-400 transition-transform duration-200 ${expandedSellers.has(seller.id) ? 'rotate-180' : ''}`}>⌄</span>
                                            <button onClick={async e => { e.stopPropagation();
                                                if (!confirm(`¿Enviar email de reseteo a ${seller.email}?`)) return;
                                                const res = await requestPasswordReset(seller.email);
                                                if (res.success) toast.success('Email de reseteo enviado');
                                                else toast.error('Error al enviar email');
                                            }} className="px-3 py-1.5 text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition">
                                                🔑 Resetear acceso
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleDeleteSeller(seller); }}
                                                className="px-3 py-1.5 text-xs font-black text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 transition">
                                                Desactivar
                                            </button>
                                        </div>
                                    </div>

                                    {expandedSellers.has(seller.id) && (
                                        <div className="space-y-3 px-5 pb-5 border-t border-border pt-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${seller.posEnabled ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-gray-50 dark:bg-gray-800/30 border-border'}`}>
                                                    <span className="text-base">🖥️</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-black text-foreground uppercase tracking-wide">Acceso POS</p>
                                                        {seller.posRequested && !seller.posEnabled && (
                                                            <p className="text-[9px] text-orange-500 font-black">⚠️ Solicitud pendiente</p>
                                                        )}
                                                    </div>
                                                    <button onClick={() => handleTogglePOS(seller)}
                                                        className={`relative w-9 h-5 rounded-full transition-all shrink-0 ${seller.posEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${seller.posEnabled ? 'left-4' : 'left-0.5'}`} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-gray-50 dark:bg-gray-800/30">
                                                    <span className="text-base">💰</span>
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-foreground uppercase tracking-wide">Comisión %</p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <input type="number" min={0} max={100} step={0.5}
                                                                defaultValue={seller.commission || 0}
                                                                onBlur={async (e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (isNaN(val) || val < 0 || val > 100) return;
                                                                    const res = await updateSellerPermissions(seller.id, { commission: val });
                                                                    if (res.success) toast.success(`Comisión actualizada a ${val}%`);
                                                                    else toast.error(res.error || 'Error');
                                                                }}
                                                                className="w-16 px-2 py-1 text-sm font-black text-blue-600 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-lg text-center focus:ring-2 focus:ring-blue-500 outline-none" />
                                                            <span className="text-sm font-black text-blue-600">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-gray-50 dark:bg-gray-800/30">
                                                    <span className="text-base">📅</span>
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-foreground uppercase tracking-wide">Mensualidad $</p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <span className="text-sm font-black text-emerald-600">$</span>
                                                            <input type="number" min={0} step={1}
                                                                defaultValue={seller.fixedFee ?? 0}
                                                                onBlur={async (e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (isNaN(val) || val < 0) return;
                                                                    const res = await updateSellerPermissions(seller.id, { fixedFee: val });
                                                                    if (res.success) toast.success(`Mensualidad actualizada a $${val}`);
                                                                    else toast.error(res.error || 'Error');
                                                                }}
                                                                className="w-20 px-2 py-1 text-sm font-black text-emerald-600 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                                                    <span className="text-base">🏷️</span>
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-foreground uppercase tracking-wide">Plan actual</p>
                                                        <p className="text-sm font-black text-blue-600">{seller.planName || 'Básico'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-xl border border-border bg-gray-50 dark:bg-gray-800/30 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Asignar Plan Rápido</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {PLANS.map((plan: any) => (
                                                        <button key={plan.name} onClick={() => applyPlan(seller, plan)}
                                                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${seller.planName === plan.name ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-gray-500 hover:border-blue-400 hover:text-blue-600'}`}>
                                                            {plan.name} <span className="opacity-60">{plan.maxLocations}loc · {plan.maxCashiers}caj · {plan.maxProducts ? `${plan.maxProducts}prod` : '∞prod'}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {[
                                                    { label: 'Locaciones POS', field: 'maxLocations', icon: '📍', val: seller.maxLocations ?? 1, current: seller._count?.ownedLocations ?? 0 },
                                                    { label: 'Cajeros', field: 'maxCashiers', icon: '👤', val: seller.maxCashiers ?? 1, current: seller._count?.cashiers ?? 0 },
                                                    { label: 'Productos', field: 'maxProducts', icon: '📦', val: seller.maxProducts ?? '', current: seller._count?.ownedProducts ?? 0 },
                                                ].map((item: any) => (
                                                    <div key={item.field} className="flex flex-col gap-1 p-3 rounded-xl border border-border bg-white dark:bg-gray-900">
                                                        <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">{item.icon} {item.label}</p>
                                                        <p className="text-[9px] text-gray-400">Usando: {item.current}</p>
                                                        <input type="number" min="0" value={item.val} placeholder="∞"
                                                            onChange={e => item.field === 'maxProducts' ? handleMaxProducts(seller, e.target.value) : handlePlanChange(seller, item.field, e.target.value)}
                                                            className="w-full px-2 py-1 text-center text-sm font-black bg-gray-50 dark:bg-gray-800 border border-border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50" />
                                                    </div>
                                                ))}
                                                <div className="flex flex-col gap-1 p-3 rounded-xl border border-border bg-white dark:bg-gray-900">
                                                    <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">🏷️ Nombre del plan</p>
                                                    <input type="text" value={seller.planName || 'Básico'}
                                                        onChange={e => handlePlanName(seller, e.target.value)}
                                                        className="w-full px-2 py-1 text-xs font-black bg-gray-50 dark:bg-gray-800 border border-border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 mt-auto" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: DESTACADOS ── */}
            {activeTab === 'featured' && (
                <div className="space-y-8">
                    <div className="bg-card border border-border rounded-3xl p-8 space-y-6 shadow-sm">
                        <h2 className="text-xl font-black">⭐ Vendedores Destacados</h2>
                        <div className="flex flex-wrap gap-2">
                            {allSellers.map((s: any) => (
                                <button key={s.id}
                                    onClick={() => setSelectedSellers(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                                    className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${selectedSellers.includes(s.id) ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-gray-500 hover:border-blue-400'}`}>
                                    {s.businessName || s.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-3xl p-8 space-y-6 shadow-sm">
                        <h2 className="text-xl font-black">⭐ Productos Destacados</h2>
                        <input type="text" value={productQuery} onChange={e => handleSearchProducts(e.target.value)}
                            placeholder="Buscar producto..." 
                            className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none" />
                        {searchResults.length > 0 && (
                            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                                {searchResults.map((p: any) => (
                                    <div key={p.id} onClick={() => setSelectedProducts(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                        className={`p-3 cursor-pointer flex justify-between items-center text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition ${selectedProducts.includes(p.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                        <span className="font-bold">{p.name}</span>
                                        {selectedProducts.includes(p.id) && <span className="text-blue-600 font-black text-xs">✓ Destacado</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {selectedProducts.length > 0 && (
                            <p className="text-xs text-gray-400 font-bold">{selectedProducts.length} producto(s) destacado(s)</p>
                        )}
                        <button onClick={handleSaveFeatured} disabled={loading}
                            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50">
                            {loading ? 'Guardando...' : 'Guardar Destacados'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── TAB: FOTOGRAFÍA ── */}
            {activeTab === 'photos' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black">📸 Solicitudes de Fotografía</h2>
                    </div>

                    {/* Toggle activar/desactivar módulo */}
                    <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between">
                        <div>
                            <p className="font-black text-foreground">Módulo Solicitar Fotos</p>
                            <p className="text-xs text-gray-400 mt-1">Activa o desactiva este módulo para todos los vendedores.</p>
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                const newVal = !photographyEnabled;
                                setPhotographyEnabled(newVal);
                                const res = await updateMarketplaceSettingsFull({ photographyEnabled: newVal });
                                if (res.success) toast.success(newVal ? 'Módulo activado' : 'Módulo desactivado');
                                else toast.error('Error al guardar');
                            }}
                            className={"w-14 h-8 rounded-full transition-all relative " + (photographyEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700')}
                        >
                            <div className={"absolute top-1 w-6 h-6 bg-white rounded-full transition-all " + (photographyEnabled ? 'left-7' : 'left-1')}></div>
                        </button>
                    </div>

                    {/* Precios del servicio — editables */}
                    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">💰 Precios del Servicio</h3>
                            <button onClick={async () => {
                                const res = await updateMarketplaceSettingsFull({ photographyPrices: photoPrices });
                                if (res.success) toast.success('Precios guardados');
                                else toast.error('Error al guardar');
                            }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition">
                                💾 Guardar precios
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {photoPrices.map((pkg: any, i: number) => (
                                <div key={i} className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-2xl space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-gray-400">Paquete</label>
                                            <input value={pkg.paquete} onChange={e => setPhotoPrices((prev: any[]) => prev.map((p, j) => j === i ? {...p, paquete: e.target.value} : p))}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-black focus:ring-1 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-gray-400">Precio</label>
                                            <input value={pkg.precio} onChange={e => setPhotoPrices((prev: any[]) => prev.map((p, j) => j === i ? {...p, precio: e.target.value} : p))}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-black focus:ring-1 focus:ring-blue-500 outline-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400">Rango de piezas</label>
                                        <input value={pkg.piezas} onChange={e => setPhotoPrices((prev: any[]) => prev.map((p, j) => j === i ? {...p, piezas: e.target.value} : p))}
                                            className="w-full px-2 py-1.5 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400">Incluye</label>
                                        <input value={pkg.includes} onChange={e => setPhotoPrices((prev: any[]) => prev.map((p, j) => j === i ? {...p, includes: e.target.value} : p))}
                                            className="w-full px-2 py-1.5 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Solicitudes Recibidas</h3>
                    {photoRequests.length === 0 ? (
                        <div className="p-16 text-center bg-card border border-dashed border-border rounded-3xl opacity-50">
                            <p className="text-4xl mb-3">📷</p>
                            <p className="font-black text-gray-400 uppercase tracking-widest text-sm">No hay solicitudes</p>
                        </div>
                    ) : photoRequests.map((req: any) => (
                        <div key={req.id} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
                            <div className="flex-1">
                                <p className="font-black text-foreground">{req.user?.businessName || req.user?.name}</p>
                                <p className="text-xs text-gray-400 font-medium">{req.user?.email} · {req.itemCount} artículos</p>
                                {req.notes && <p className="text-xs text-gray-500 mt-1 italic">"{req.notes}"</p>}
                                <p className="text-xs text-gray-400 mt-1">
                                    Fecha estimada: {new Date(req.estimatedDate).toLocaleDateString('es-MX')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${statusColors[req.status] || 'bg-gray-100 text-gray-600'}`}>
                                    {req.status}
                                </span>
                                <select value={req.status}
                                    onChange={async e => {
                                        await updatePhotographyRequest(req.id, e.target.value);
                                        setPhotoRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: e.target.value } : r));
                                        toast.success('Estado actualizado');
                                    }}
                                    className="text-xs font-black bg-input border border-border rounded-xl px-3 py-2 outline-none cursor-pointer">
                                    <option value="PENDING">Pendiente</option>
                                    <option value="APPROVED">Aprobada</option>
                                    <option value="COMPLETED">Completada</option>
                                    <option value="CANCELLED">Cancelada</option>
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── TAB: PLANES ── */}
            {activeTab === 'plans' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black">💼 Planes de Suscripción</h2>
                            <p className="text-xs text-gray-400 mt-1">Edita los precios y características de cada plan. Se reflejan en la página de registro.</p>
                        </div>
                        <button onClick={handleSavePlans} disabled={savingPlans}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition disabled:opacity-50">
                            {savingPlans ? 'Guardando...' : '💾 Guardar Planes'}
                        </button>
                    </div>

                    {plans.length === 0 ? (
                        <div className="flex justify-center p-10">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {plans.map((plan, idx) => (
                                <div key={plan.id} className="bg-card border border-border rounded-2xl p-6 space-y-4">
                                    {/* Preview del plan */}
                                    <div className={`p-4 rounded-2xl text-white bg-gradient-to-br ${plan.color} space-y-1`}>
                                        <div className="flex justify-between items-center">
                                            <span className="font-black uppercase text-lg">{plan.name}</span>
                                            <span className="font-black text-xl">{plan.price}</span>
                                        </div>
                                        {plan.badge && <span className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-full">{plan.badge}</span>}
                                    </div>

                                    {/* Campos editables */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Nombre</label>
                                            <input value={plan.name}
                                                onChange={e => setPlans(prev => prev.map((p, i) => i === idx ? {...p, name: e.target.value} : p))}
                                                className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Precio (ej: $299/mes)</label>
                                            <input value={plan.price}
                                                onChange={e => setPlans(prev => prev.map((p, i) => i === idx ? {...p, price: e.target.value} : p))}
                                                className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sucursales</label>
                                            <input type="number" value={plan.locations} min={1}
                                                onChange={e => setPlans(prev => prev.map((p, i) => i === idx ? {...p, locations: parseInt(e.target.value)||1} : p))}
                                                className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Cajeros</label>
                                            <input type="number" value={plan.cashiers} min={1}
                                                onChange={e => setPlans(prev => prev.map((p, i) => i === idx ? {...p, cashiers: parseInt(e.target.value)||1} : p))}
                                                className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Productos (0 = ilimitados)</label>
                                            <input type="number" value={plan.products} min={0}
                                                onChange={e => setPlans(prev => prev.map((p, i) => i === idx ? {...p, products: parseInt(e.target.value)||0} : p))}
                                                className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Badge (ej: ⭐ Popular)</label>
                                            <input value={plan.badge}
                                                onChange={e => setPlans(prev => prev.map((p, i) => i === idx ? {...p, badge: e.target.value} : p))}
                                                className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Características incluidas (una por línea)</label>
                                        <textarea rows={3}
                                            value={(plan.features || []).join('\n')}
                                            onChange={e => setPlans(prev => prev.map((p, i) => i === idx ? {...p, features: e.target.value.split('\n').filter(Boolean)} : p))}
                                            className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-medium resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={plan.highlight}
                                            onChange={e => setPlans(prev => prev.map((p, i) => i === idx ? {...p, highlight: e.target.checked} : p))}
                                            className="w-4 h-4 accent-blue-600 rounded" />
                                        <span className="text-xs font-bold text-gray-500">Resaltado (borde azul destacado)</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: MARCAS ── */}
            {activeTab === 'brands' && (
                <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-black">🌐 Configuración de Marcas</h2>
                            <p className="text-xs text-gray-400 mt-1">Personaliza cada dominio — logo, nombre, colores y contenido destacado.</p>
                        </div>
                        <button onClick={openNewBrandModal}
                            className="shrink-0 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition flex items-center gap-2">
                            + Nueva Marca
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {brands.map((brand: any, idx: number) => (
                            <div key={brand.domain} className="bg-card border border-border rounded-2xl p-6 space-y-4">
                                {/* Preview header */}
                                <div className={`p-4 rounded-2xl ${brand.primaryColor === 'violet' ? 'bg-violet-600' : brand.primaryColor === 'emerald' ? 'bg-emerald-600' : brand.primaryColor === 'amber' ? 'bg-amber-600' : brand.primaryColor === 'rose' ? 'bg-rose-600' : 'bg-blue-600'} text-white`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-black text-lg">{brand.name}</p>
                                            <p className="text-xs opacity-80">{brand.tagline}</p>
                                            <p className="text-[10px] opacity-60 mt-1">{brand.domain}</p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={async () => {
                                                    const next = !brand.isActive;
                                                    const res = await toggleBrandActive(brand.domain, next);
                                                    if (res.success) {
                                                        setBrands(prev => prev.map((b: any) => b.domain === brand.domain ? { ...b, isActive: next } : b));
                                                        toast.success(next ? 'Marca activada' : 'Marca desactivada');
                                                    } else {
                                                        toast.error(res.error || 'Error');
                                                    }
                                                }}
                                                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-black transition"
                                                title={brand.isActive ? 'Desactivar marca' : 'Activar marca'}>
                                                {brand.isActive ? '⏸ Desactivar' : '▶ Activar'}
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`¿Eliminar permanentemente la marca "${brand.name}" (${brand.domain})? Esta acción no se puede deshacer.`)) return;
                                                    const res = await deleteBrandConfig(brand.domain);
                                                    if (res.success) {
                                                        setBrands(prev => prev.filter((b: any) => b.domain !== brand.domain));
                                                        toast.success('Marca eliminada');
                                                    } else {
                                                        toast.error(res.error || 'Error al eliminar');
                                                    }
                                                }}
                                                className="px-2.5 py-1 bg-red-500/80 hover:bg-red-500 rounded-lg text-[10px] font-black transition"
                                                title="Eliminar marca">
                                                🗑 Eliminar
                                            </button>
                                        </div>
                                    </div>
                                    {!brand.isActive && (
                                        <div className="mt-2 px-2 py-1 bg-black/30 rounded-lg text-[10px] font-black text-yellow-300">⚠ Marca desactivada — no visible en el sitio</div>
                                    )}
                                </div>
                                {/* Campos */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase text-gray-400">Nombre</label>
                                            <input value={brand.name}
                                                onChange={e => setBrands(prev => prev.map((b, i) => i === idx ? {...b, name: e.target.value} : b))}
                                                className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase text-gray-400">Slogan</label>
                                            <input value={brand.tagline || ''}
                                                onChange={e => setBrands(prev => prev.map((b, i) => i === idx ? {...b, tagline: e.target.value} : b))}
                                                className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-gray-400">Descripción (hero)</label>
                                        <textarea rows={2} value={brand.description || ''}
                                            onChange={e => setBrands(prev => prev.map((b, i) => i === idx ? {...b, description: e.target.value} : b))}
                                            className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-medium resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-gray-400">URL del Logo</label>
                                        <div className="flex gap-2">
                                            <input value={brand.logoUrl || ''}
                                                onChange={e => setBrands(prev => prev.map((b, i) => i === idx ? {...b, logoUrl: e.target.value} : b))}
                                                placeholder="/logo.png"
                                                className="flex-1 px-3 py-2 bg-input border border-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                                            <label className="cursor-pointer p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition">
                                                <input type="file" className="hidden" accept="image/*"
                                                    onChange={e => e.target.files?.[0] && handleBrandImageUpload(brand.domain, 'logoUrl', e.target.files[0])} />
                                                <span title="Subir imagen">📤</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Slider de imágenes independiente por marca */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Imágenes del Slider</label>
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-[9px] font-black text-gray-500">
                                                {(brand.heroImages || []).length} imagen{(brand.heroImages || []).length !== 1 ? 'es' : ''}
                                            </span>
                                        </div>
                                        {(brand.heroImages || []).length > 0 && (
                                            <div className="grid grid-cols-3 gap-3">
                                                {(brand.heroImages || []).map((img: string, imgIdx: number) => (
                                                    <div key={imgIdx} className="relative h-24 rounded-xl overflow-hidden border border-border group">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={img} alt={`Slide ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                                                        <button
                                                            onClick={() => setBrands(prev => prev.map((b, i) => i === idx ? { ...b, heroImages: (b.heroImages || []).filter((_: string, fi: number) => fi !== imgIdx) } : b))}
                                                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black opacity-0 group-hover:opacity-100 transition hover:bg-red-600">×</button>
                                                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 text-white text-[9px] font-black rounded">{imgIdx + 1}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {(brand.heroImages || []).length === 0 && (
                                            <p className="text-xs text-gray-400 font-medium py-2">Sin imágenes — se mostrarán fotos de productos automáticamente.</p>
                                        )}
                                        <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-border rounded-xl text-xs font-black hover:bg-gray-200 transition ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <input type="file" className="hidden" accept="image/*" disabled={loading}
                                                onChange={e => e.target.files?.[0] && handleAddBrandHeroImage(brand.domain, e.target.files[0])} />
                                            {loading ? '⏳ Subiendo...' : '📁 Subir imagen'}
                                        </label>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-gray-400">Color principal</label>
                                        <select value={brand.primaryColor || 'blue'}
                                            onChange={e => setBrands(prev => prev.map((b, i) => i === idx ? {...b, primaryColor: e.target.value} : b))}
                                            className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                                            <option value="blue">🔵 Azul (Modazapo)</option>
                                            <option value="violet">🟣 Violeta (Zona Vestir)</option>
                                            <option value="kalexa">⚛️ Kalexa Purple</option>
                                            <option value="emerald">🟢 Esmeralda</option>
                                            <option value="amber">🟡 Ámbar</option>
                                            <option value="rose">🌸 Rosa</option>
                                        </select>
                                    </div>
                                </div>
                                <button onClick={async () => {
                                    setSavingBrand(brand.domain);
                                    try {
                                        const res = await updateBrandConfig(brand.domain, {
                                            name: brand.name,
                                            tagline: brand.tagline,
                                            description: brand.description,
                                            logoUrl: brand.logoUrl,
                                            heroImages: brand.heroImages || [],
                                            primaryColor: brand.primaryColor
                                        });
                                        if (res.success) toast.success(`Configuración guardada para ${brand.name}`);
                                        else toast.error(res.error || 'Error al guardar');
                                    } catch (e: any) {
                                        toast.error('Error: ' + e.message);
                                    } finally {
                                        setSavingBrand(null);
                                    }
                                }} disabled={savingBrand === brand.domain}
                                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition disabled:opacity-50">
                                    {savingBrand === brand.domain ? 'Guardando...' : '💾 Guardar Configuración de Marca'}
                                </button>
                            </div>
                        ))}
                    </div>
                    {brands.length === 0 && (
                        <div className="p-12 text-center bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-border mt-6">
                            <p className="text-sm font-bold text-gray-400">No hay configuraciones de marca. Crea la primera con el botón "Nueva Marca".</p>
                        </div>
                    )}

                    {/* ── MODAL NUEVA MARCA ── */}
                    {showNewBrandModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowNewBrandModal(false); }}>
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                            <div className="relative bg-card border border-border rounded-3xl p-8 w-full max-w-lg shadow-2xl space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-black">Nueva Marca Independiente</h3>
                                    <button onClick={() => setShowNewBrandModal(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none">×</button>
                                </div>

                                {/* Selector de vendedor */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vendedor (tienda principal)</label>
                                    {!modalSellersLoaded ? (
                                        <div className="flex items-center gap-2 text-xs text-gray-400"><span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />Cargando vendedores...</div>
                                    ) : (
                                        <select value={newBrandSellerId} onChange={e => handleSellerPickedForBrand(e.target.value)}
                                            className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                                            <option value="">— Sin vendedor (marca sin tienda vinculada) —</option>
                                            {modalSellers.map((s: any) => (
                                                <option key={s.id} value={s.id}>{s.businessName || s.name} {s.sellerSlug ? `(${s.sellerSlug})` : ''}</option>
                                            ))}
                                        </select>
                                    )}
                                    {newBrandSellerId && (
                                        <p className="text-[10px] text-blue-600 font-bold">✓ El catálogo solo mostrará productos de este vendedor.</p>
                                    )}
                                </div>

                                {/* Dominio */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dominio</label>
                                    <input value={newBrandDomain} onChange={e => setNewBrandDomain(e.target.value)}
                                        placeholder="mitienda.com"
                                        className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                                    <p className="text-[10px] text-gray-400">El dominio debe apuntar a este servidor para funcionar.</p>
                                </div>

                                {/* Nombre de la marca */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre de la marca</label>
                                    <input value={newBrandName} onChange={e => setNewBrandName(e.target.value)}
                                        placeholder="Mi Tienda Fashion"
                                        className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>

                                {/* Color */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Color principal</label>
                                    <select value={newBrandColor} onChange={e => setNewBrandColor(e.target.value)}
                                        className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="blue">🔵 Azul</option>
                                        <option value="violet">🟣 Violeta</option>
                                        <option value="kalexa">⚛️ Kalexa Purple</option>
                                        <option value="emerald">🟢 Esmeralda</option>
                                        <option value="amber">🟡 Ámbar</option>
                                        <option value="rose">🌸 Rosa</option>
                                    </select>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setShowNewBrandModal(false)}
                                        className="flex-1 py-3 border border-border rounded-xl text-sm font-black hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                                        Cancelar
                                    </button>
                                    <button onClick={handleCreateBrand} disabled={newBrandSaving || !newBrandDomain.trim() || !newBrandName.trim()}
                                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                                        {newBrandSaving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando...</> : '🌐 Crear Marca'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: MI CUENTA ── */}
            {activeTab === 'admin' && (
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-8 space-y-5 shadow-sm">
                        <h2 className="text-xl font-black">⚙️ Configuración de Mi Cuenta</h2>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Correo del Administrador</label>
                            <p className="text-xs text-gray-400 font-medium">Al cambiar el correo, úsalo para iniciar sesión la próxima vez.</p>
                            <div className="flex gap-3">
                                <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                                    placeholder="admin@tucorreo.com"
                                    className="flex-1 px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none" />
                                <button onClick={handleSaveAdminEmail}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                                    Actualizar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

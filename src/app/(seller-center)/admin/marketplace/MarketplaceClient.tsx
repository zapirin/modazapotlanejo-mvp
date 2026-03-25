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
    { key: 'admin', label: '⚙️ Mi Cuenta', icon: '⚙️' },
];

export default function MarketplaceClient({ initialSettings }: { initialSettings: any }) {
    const [activeTab, setActiveTab] = useState('site');
    const [settings, setSettings] = useState(initialSettings);
    const [loading, setLoading] = useState(false);

    // Tab: Site
    const [title, setTitle] = useState(initialSettings?.title || '');
    const [heroImage, setHeroImage] = useState(initialSettings?.heroImage || '');
    const [logoUrl, setLogoUrl] = useState(initialSettings?.logoUrl || '');
    const [sellerLabel, setSellerLabel] = useState(initialSettings?.sellerLabel || 'Vendedor');
    const heroInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Tab: Sellers
    const [sellers, setSellers] = useState<any[]>([]);
    const [loadingSellers, setLoadingSellers] = useState(false);
    const [compressing, setCompressing] = useState(false);
    const [applications, setApplications] = useState<any[]>([]);
    const [loadingApps, setLoadingApps] = useState(false);
    const [plans, setPlans] = useState<any[]>([]);
    const [savingPlans, setSavingPlans] = useState(false);
    const [compressionResult, setCompressionResult] = useState<{savedMB: string; compressed: number} | null>(null);

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

    const handleCompressImages = async () => {
        if (!confirm('¿Comprimir todas las imágenes en la BD? Esto puede tardar 1-2 minutos.')) return;
        setCompressing(true);
        setCompressionResult(null);
        let offset = 0;
        let totalSaved = 0;
        let totalCompressed = 0;
        try {
            while (true) {
                const res = await fetch('/api/admin/compress-images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ offset }),
                });
                const data = await res.json();
                totalSaved += data.savedKB || 0;
                totalCompressed += data.compressed || 0;
                if (!data.hasMore) break;
                offset = data.nextOffset;
            }
            setCompressionResult({ savedMB: (totalSaved/1024).toFixed(1), compressed: totalCompressed });
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setCompressing(false);
        }
    };

    const loadSellers = async () => {
        setLoadingSellers(true);
        const data = await getSellersWithPermissions();
        setSellers(data);
        setLoadingSellers(false);
    };

    // useEffect va DESPUÉS de declarar las funciones para evitar hoisting issues
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (activeTab === 'sellers') {
            loadSellers();
            setLoadingApps(true);
            getSellerApplications().then(apps => { setApplications(apps); setLoadingApps(false); });
        }
        if (activeTab === 'featured') loadAllSellers();
        if (activeTab === 'photos') loadPhotos();
        if (activeTab === 'plans') {
            getPlans().then(setPlans);
        }
    }, [activeTab]);

    const loadAllSellers = async () => {
        const res = await getSellersList();
        if (res.success) setAllSellers(res.data);
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

    const handleSaveSite = async () => {
        setLoading(true);
        const res = await updateMarketplaceSettingsFull({ title, heroImage, logoUrl, sellerLabel, privacyUrl, termsUrl });
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
        if (res.success) setSearchResults(res.data);
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

                        {/* Hero image */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Imagen de Fondo (Landing)</label>
                            {heroImage && (
                                <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-border">
                                    <Image src={heroImage} alt="Hero" fill className="object-cover" />
                                    <button onClick={() => setHeroImage('')}
                                        className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black hover:bg-red-600">×</button>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <input ref={heroInputRef} type="file" accept="image/*" className="hidden"
                                    onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'hero')} />
                                <button onClick={() => heroInputRef.current?.click()}
                                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-border rounded-xl text-xs font-black hover:bg-gray-200 transition">
                                    📁 Subir imagen
                                </button>
                                <input type="text" value={heroImage} onChange={e => setHeroImage(e.target.value)}
                                    placeholder="O pega una URL de imagen..."
                                    className="flex-1 px-4 py-2.5 bg-input border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/50 outline-none" />
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
                    {(applications.length > 0 || loadingApps) && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-5 space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                📬 Solicitudes Pendientes
                                <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full text-[9px] font-black">{applications.length}</span>
                            </h3>
                            {loadingApps ? (
                                <div className="flex justify-center p-4"><div className="w-6 h-6 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>
                            ) : applications.map((app: any) => (
                                <div key={app.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 border border-border">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-foreground">{app.storeName}</p>
                                        <p className="text-xs text-gray-500">{app.contactName} · {app.email} · {app.phone}</p>
                                        {app.storeAddress && <p className="text-xs text-blue-500">📍 {app.storeAddress.replace('|', ' — ')}</p>}
                                        <p className="text-[10px] text-gray-400 mt-1">{app.category} {app.planName ? `· Plan: ${app.planName}` : ''}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={async () => {
                                            await updateApplicationStatus(app.id, 'APPROVED');
                                            setApplications(prev => prev.filter(a => a.id !== app.id));
                                            toast.success(`${app.storeName} aprobado`);
                                        }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition">
                                            ✓ Aprobar
                                        </button>
                                        <button onClick={async () => {
                                            await updateApplicationStatus(app.id, 'REJECTED');
                                            setApplications(prev => prev.filter(a => a.id !== app.id));
                                            toast.success('Solicitud rechazada');
                                        }} className="px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-xl text-xs font-black hover:bg-red-200 transition">
                                            ✕ Rechazar
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {!loadingApps && applications.length === 0 && (
                                <p className="text-xs text-amber-600 font-bold">No hay solicitudes pendientes.</p>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h2 className="text-xl font-black">🏭 Gestión de Vendedores</h2>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 font-bold">{sellers.length} vendedores</span>
                            <button
                                onClick={handleCompressImages}
                                disabled={compressing}
                                className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-amber-700 rounded-xl text-xs font-black hover:bg-amber-100 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {compressing ? '⏳ Comprimiendo...' : '🗜️ Comprimir Imágenes BD'}
                            </button>
                            {compressionResult && (
                                <span className="text-xs font-bold text-emerald-600">
                                    ✅ {compressionResult.compressed} imgs · -{compressionResult.savedMB}MB
                                </span>
                            )}
                        </div>
                    </div>
                    {loadingSellers ? (
                        <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/></div>
                    ) : sellers.map((seller: any) => (
                        <div key={seller.id} className="bg-card border border-border rounded-2xl p-5 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    {seller.logoUrl
                                        ? <Image src={seller.logoUrl} alt={seller.name} width={40} height={40} className="w-10 h-10 rounded-xl object-contain border border-border" />
                                        : <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-black text-lg">{seller.name.charAt(0)}</div>
                                    }
                                    <div>
                                        <p className="font-black text-foreground">{seller.businessName || seller.name}</p>
                                        <p className="text-xs text-gray-400 font-medium">{seller.email} · {seller._count?.ownedProducts || 0} productos</p>
                                        {seller.sellerSlug ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-[10px] font-mono text-blue-500">/acceso/{seller.sellerSlug}</p>
                                                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/acceso/${seller.sellerSlug}`); toast.success('URL copiada'); }}
                                                    className="text-[9px] font-black text-gray-400 hover:text-blue-600 transition uppercase">Copiar</button>
                                            </div>
                                        ) : (
                                            <button onClick={async () => {
                                                const res = await assignSellerSlug(seller.id);
                                                if (res.success) { setSellers(prev => prev.map((s: any) => s.id === seller.id ? { ...s, sellerSlug: res.slug } : s)); toast.success('URL generada'); }
                                                else toast.error(res.error || 'Error');
                                            }} className="text-[9px] font-black text-orange-500 hover:text-orange-600 uppercase tracking-wide mt-0.5 block">
                                                ⚡ Generar URL del POS
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={async () => {
                                        if (!confirm(`¿Enviar email de reseteo de contraseña a ${seller.email}?`)) return;
                                        const res = await requestPasswordReset(seller.email);
                                        if (res.success) toast.success('Email de reseteo enviado');
                                        else toast.error('Error al enviar email');
                                    }} className="px-3 py-1.5 text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition">
                                        🔑 Resetear acceso
                                    </button>
                                    <button onClick={() => handleDeleteSeller(seller)}
                                        className="px-3 py-1.5 text-xs font-black text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 transition">
                                        Desactivar
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-border">
                                {/* Fila 1: POS + Comisión + Plan */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                                <input
                                                    type="number" min={0} max={100} step={0.5}
                                                    defaultValue={seller.commission || 0}
                                                    onBlur={async (e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (isNaN(val) || val < 0 || val > 100) return;
                                                        const res = await updateSellerPermissions(seller.id, { commission: val });
                                                        if (res.success) toast.success(`Comisión actualizada a ${val}%`);
                                                        else toast.error(res.error || 'Error');
                                                    }}
                                                    className="w-16 px-2 py-1 text-sm font-black text-blue-600 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-lg text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                                <span className="text-sm font-black text-blue-600">%</span>
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

                                {/* Fila 2: Botones de plan rápido */}
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

                                {/* Fila 3: Límites ajustables individualmente */}
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
                        </div>
                    ))}
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

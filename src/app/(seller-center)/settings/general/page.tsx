"use client";

import React, { useState, useEffect, useRef } from 'react';
import { getStoreSettings, updateStoreSettings, updateSellerLogo, getRequireCashSession, updateRequireCashSession, getRequireSalesperson, updateRequireSalesperson, getCashierCanDeleteSuspended, updateCashierCanDeleteSuspended, createStripeConnectLink, getStripeConnectStatus } from '../actions';
import { useSearchParams } from 'next/navigation';
import { validateImageFile } from '@/lib/uploadImage';
import { processImage } from '@/lib/imageUtils';
import { toast } from 'sonner';

export default function GeneralSettingsPage() {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingLogo, setSavingLogo] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [storeName, setStoreName] = useState('');
    const [legalName, setLegalName] = useState('');
    const [taxId, setTaxId] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [shippingZip, setShippingZip] = useState('');
    const [requireCashSession, setRequireCashSession] = useState(false);
    const [requireSalesperson, setRequireSalesperson] = useState(false);
    const [cashierCanDeleteSuspended, setCashierCanDeleteSuspended] = useState(true);
    const [aiProvider, setAiProvider] = useState('');
    const [aiApiKey, setAiApiKey] = useState('');
    const [savingAi, setSavingAi] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

    // Transferencia / Depósito
    const [acceptsTransfer, setAcceptsTransfer] = useState(false);
    const [transferBank, setTransferBank] = useState('');
    const [transferAccountHolder, setTransferAccountHolder] = useState('');
    const [transferCLABE, setTransferCLABE] = useState('');
    const [transferAccountNumber, setTransferAccountNumber] = useState('');
    const [transferInstructions, setTransferInstructions] = useState('');
    const [savingTransfer, setSavingTransfer] = useState(false);

    // Stripe Connect
    const [stripeStatus, setStripeStatus] = useState<string | null>(null);
    const [connectingStripe, setConnectingStripe] = useState(false);
    const searchParams = useSearchParams();

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        setLoading(true);
        const res = await getStoreSettings();
        if (res.success && res.data) {
            setSettings(res.data);
            setStoreName(res.data.storeName || '');
            setLogoPreview(res.data.logoUrl || null);
            setLegalName(res.data.legalName || '');
            setTaxId(res.data.taxId || '');
            setAddress(res.data.address || '');
            setPhone(res.data.phone || '');
            setShippingZip(res.data.shippingZip || '');
            setAiProvider(res.data.aiProvider || '');
            setAiApiKey(res.data.aiApiKey || '');
            setAcceptsTransfer(res.data.acceptsTransfer || false);
            setTransferBank(res.data.transferBank || '');
            setTransferAccountHolder(res.data.transferAccountHolder || '');
            setTransferCLABE(res.data.transferCLABE || '');
            setTransferAccountNumber(res.data.transferAccountNumber || '');
            setTransferInstructions(res.data.transferInstructions || '');
        }
        const cashRes = await getRequireCashSession();
        setRequireCashSession(cashRes.requireCashSession);
        const spRes = await getRequireSalesperson();
        setRequireSalesperson(spRes.requireSalesperson);
        const cdRes = await getCashierCanDeleteSuspended();
        setCashierCanDeleteSuspended(cdRes.cashierCanDeleteSuspended);
        // Cargar estado de Stripe Connect
        const stripeRes = await getStripeConnectStatus();
        setStripeStatus(stripeRes.status);
        setLoading(false);
    };

    const handleConnectStripe = async () => {
        setConnectingStripe(true);
        const res = await createStripeConnectLink();
        if (res.success && res.url) {
            window.location.href = res.url;
        } else {
            toast.error(res.error || 'Error al conectar con Stripe');
            setConnectingStripe(false);
        }
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validation = validateImageFile(file);
        if (!validation.valid) { toast.error(validation.error || 'Archivo inválido'); return; }
        setSavingLogo(true);
        try {
            const { url, isStorage, sizeKB } = await processImage(file, 'logos');
            setLogoPreview(url);
            const res = await updateSellerLogo(url);
            if (res.success) toast.success(`Logo actualizado (${sizeKB}KB${isStorage ? ' · en Storage' : ''})`);
            else toast.error(res.error || 'Error al subir logo');
        } catch {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const dataUrl = ev.target?.result as string;
                setLogoPreview(dataUrl);
                await updateSellerLogo(dataUrl);
                toast.success('Logo actualizado');
            };
            reader.readAsDataURL(file);
        }
        setSavingLogo(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const res = await updateStoreSettings({ storeName, legalName, taxId, address, phone, shippingZip });
        if (res.success) {
            toast.success('Configuración actualizada');
            setSettings(res.data);
        } else {
            toast.error('Error: ' + res.error);
        }
        setSaving(false);
    };

    if (loading) return (
        <div className="p-10 flex justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
            <div>
                <h1 className="text-3xl font-black text-foreground tracking-tight">Tienda y Facturación</h1>
                <p className="text-gray-500 font-medium mt-2">Personaliza la identidad visual de tu tienda y tus datos fiscales.</p>
            </div>

            <div className="bg-card rounded-3xl border border-border shadow-sm p-8 space-y-8">
                <section>
                    <h2 className="text-lg font-black text-foreground border-b border-border pb-2 mb-6">Logo de tu Tienda</h2>
                    <div className="flex items-center gap-6">
                        <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-border bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                            {logoPreview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" suppressHydrationWarning />
                            ) : (
                                <span className="text-4xl">🏪</span>
                            )}
                        </div>
                        <div className="space-y-3">
                            <p className="text-xs text-gray-500 font-medium">Aparece en tickets, marketplace y login del POS.<br/>JPG, PNG, WebP — hasta 5MB.</p>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/svg+xml" className="hidden" onChange={handleLogoChange} />
                            <div className="flex gap-3">
                                <button onClick={() => fileInputRef.current?.click()} disabled={savingLogo}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50">
                                    {savingLogo ? 'Subiendo...' : logoPreview ? 'Cambiar Logo' : 'Subir Logo'}
                                </button>
                                {logoPreview && (
                                    <button onClick={async () => { await updateSellerLogo(''); setLogoPreview(null); toast.success('Logo eliminado'); }}
                                        className="px-4 py-2 text-xs font-black text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition">
                                        Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-lg font-black text-foreground border-b border-border pb-2 mb-4">Identidad de la Tienda</h2>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre Público del Negocio</label>
                        <input type="text" className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold"
                            value={storeName} onChange={e => setStoreName(e.target.value)} />
                    </div>
                </section>

                <section>
                    <h2 className="text-lg font-black text-foreground border-b border-border pb-2 mb-4">Datos Fiscales / Legales</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Razón Social</label>
                            <input type="text" className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold"
                                value={legalName} onChange={e => setLegalName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">RFC / Identificador</label>
                            <input type="text" className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold uppercase"
                                value={taxId} onChange={e => setTaxId(e.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dirección Matriz</label>
                            <textarea rows={2} className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold resize-none"
                                value={address} onChange={e => setAddress(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Teléfono Público</label>
                            <input type="tel" className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold"
                                value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Código Postal de Envío 📦</label>
                            <input type="text" maxLength={5} placeholder="Ej: 45430"
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold"
                                value={shippingZip} onChange={e => setShippingZip(e.target.value.replace(/\D/g, ''))} />
                            <p className="text-[10px] text-gray-400 font-medium">Skydropx usará este CP como punto de origen para cotizar envíos a tus compradores.</p>
                        </div>
                    </div>
                </section>

                {/* Toggle Control de Caja */}
                <div className="pt-6 border-t border-border space-y-3">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border">
                        <div>
                            <p className="font-black text-sm text-foreground">Control de Caja al iniciar turno</p>
                            <p className="text-xs text-gray-500 mt-0.5">Si está activo, el cajero deberá registrar el fondo inicial antes de operar el POS.</p>
                        </div>
                        <button
                            onClick={async () => {
                                const newVal = !requireCashSession;
                                setRequireCashSession(newVal);
                                const res = await updateRequireCashSession(newVal);
                                if (res.success) toast.success(newVal ? 'Control de caja activado' : 'Control de caja desactivado');
                                else toast.error('Error al guardar');
                            }}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${requireCashSession ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 ${requireCashSession ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    {/* Toggle Vendedor de Piso obligatorio */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border">
                        <div>
                            <p className="font-black text-sm text-foreground">Vendedor de piso obligatorio en POS</p>
                            <p className="text-xs text-gray-500 mt-0.5">Si está activo, no se podrá completar una venta sin asignar un vendedor de piso. Si está inactivo, las ventas sin vendedor se atribuyen al cajero.</p>
                        </div>
                        <button
                            onClick={async () => {
                                const newVal = !requireSalesperson;
                                setRequireSalesperson(newVal);
                                const res = await updateRequireSalesperson(newVal);
                                if (res.success) toast.success(newVal ? 'Vendedor de piso requerido' : 'Vendedor de piso opcional');
                                else { setRequireSalesperson(!newVal); toast.error('Error al guardar'); }
                            }}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${requireSalesperson ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 ${requireSalesperson ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    {/* Toggle Cajero puede eliminar ventas suspendidas */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border">
                        <div>
                            <p className="font-black text-sm text-foreground">Cajero puede eliminar ventas suspendidas</p>
                            <p className="text-xs text-gray-500 mt-0.5">Si está activo, los cajeros podrán eliminar ventas suspendidas sin abonos. Las ventas con abonos solo las puede eliminar el administrador.</p>
                        </div>
                        <button
                            onClick={async () => {
                                const newVal = !cashierCanDeleteSuspended;
                                setCashierCanDeleteSuspended(newVal);
                                const res = await updateCashierCanDeleteSuspended(newVal);
                                if (res.success) toast.success(newVal ? 'Cajeros pueden eliminar ventas suspendidas' : 'Solo el admin puede eliminar ventas suspendidas');
                                else { setCashierCanDeleteSuspended(!newVal); toast.error('Error al guardar'); }
                            }}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${cashierCanDeleteSuspended ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 ${cashierCanDeleteSuspended ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Sección IA */}
                <div className="pt-6 border-t border-border space-y-4">
                    <div>
                        <p className="font-black text-sm text-foreground">✨ Generación de Descripciones con IA</p>
                        <p className="text-xs text-gray-500 mt-0.5">Configura tu proveedor de IA para generar descripciones de productos automáticamente con tus fotos.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-400">Proveedor de IA</label>
                            <select
                                value={aiProvider}
                                onChange={e => setAiProvider(e.target.value)}
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none transition font-bold"
                            >
                                <option value="">-- Seleccionar --</option>
                                <option value="openai">OpenAI (ChatGPT)</option>
                                <option value="anthropic">Anthropic (Claude)</option>
                                <option value="gemini">Google Gemini</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-400">API Key</label>
                            <div className="relative">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    placeholder="Pega tu API Key aquí..."
                                    value={aiApiKey}
                                    onChange={e => setAiApiKey(e.target.value)}
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none transition font-bold pr-12"
                                />
                                <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-sm">
                                    {showApiKey ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={async () => {
                                setSavingAi(true);
                                const res = await updateStoreSettings({ aiProvider, aiApiKey });
                                if (res.success) toast.success('Configuración de IA guardada');
                                else toast.error('Error: ' + res.error);
                                setSavingAi(false);
                            }}
                            disabled={savingAi || !aiProvider || !aiApiKey}
                            className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition disabled:opacity-50"
                        >
                            {savingAi ? 'Guardando...' : '✨ Guardar Config. IA'}
                        </button>
                    </div>
                </div>

                {/* Stripe Connect */}
                <div className="pt-6 border-t border-border space-y-4">
                    <div>
                        <p className="font-black text-sm text-foreground">💳 Recibir Pagos con Tarjeta (Stripe)</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Conecta tu cuenta bancaria para recibir los pagos directamente. El marketplace retiene automáticamente la comisión acordada.
                        </p>
                    </div>

                    {searchParams.get('stripe') === 'success' && stripeStatus !== 'active' && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium">
                            ✅ Registro recibido. Stripe está verificando tu información (puede tardar unos minutos). Regresa aquí para ver el estado.
                        </div>
                    )}

                    {stripeStatus === 'active' ? (
                        <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                            <span className="text-2xl">✅</span>
                            <div>
                                <p className="font-black text-sm text-emerald-700 dark:text-emerald-400">Cuenta conectada y activa</p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Los pagos se depositan directamente a tu cuenta bancaria, menos la comisión del marketplace.</p>
                            </div>
                        </div>
                    ) : stripeStatus === 'pending_verification' ? (
                        <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <span className="text-2xl">⏳</span>
                            <div>
                                <p className="font-black text-sm text-amber-700 dark:text-amber-400">Verificación en proceso</p>
                                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Stripe está revisando tu información. Normalmente tarda menos de 24 horas.</p>
                            </div>
                            <button onClick={handleConnectStripe} disabled={connectingStripe}
                                className="ml-auto shrink-0 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-black hover:bg-amber-700 transition disabled:opacity-50">
                                {connectingStripe ? 'Cargando...' : 'Completar datos'}
                            </button>
                        </div>
                    ) : stripeStatus === 'pending' ? (
                        <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
                            <span className="text-2xl">📋</span>
                            <div>
                                <p className="font-black text-sm text-blue-700 dark:text-blue-400">Registro incompleto</p>
                                <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">Falta completar el formulario de Stripe para activar los pagos.</p>
                            </div>
                            <button onClick={handleConnectStripe} disabled={connectingStripe}
                                className="ml-auto shrink-0 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition disabled:opacity-50">
                                {connectingStripe ? 'Cargando...' : 'Completar registro'}
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleConnectStripe} disabled={connectingStripe}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2">
                            {connectingStripe ? (
                                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Redirigiendo a Stripe...</>
                            ) : (
                                <>🔗 Conectar mi cuenta de Stripe</>
                            )}
                        </button>
                    )}
                    <p className="text-[10px] text-gray-400">Proceso seguro gestionado por Stripe. Tus datos bancarios nunca pasan por nuestros servidores.</p>
                </div>

                {/* Depósito / Transferencia */}
                <div className="pt-6 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-black text-sm text-foreground">🏦 Aceptar Depósito / Transferencia</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Muestra tus datos bancarios al comprador para que pague por transferencia SPEI o depósito.
                            </p>
                        </div>
                        <button
                            onClick={() => setAcceptsTransfer(v => !v)}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${acceptsTransfer ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 ${acceptsTransfer ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {acceptsTransfer && (
                        <div className="space-y-4 p-5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Datos de tu cuenta</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Banco</label>
                                    <input type="text" placeholder="Ej: BBVA, Banorte, HSBC..."
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-border rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition font-bold text-sm"
                                        value={transferBank} onChange={e => setTransferBank(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Titular de la cuenta</label>
                                    <input type="text" placeholder="Nombre como aparece en la cuenta"
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-border rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition font-bold text-sm"
                                        value={transferAccountHolder} onChange={e => setTransferAccountHolder(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">CLABE Interbancaria (18 dígitos)</label>
                                    <input type="text" placeholder="000000000000000000" maxLength={18}
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-border rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition font-bold text-sm tracking-widest"
                                        value={transferCLABE} onChange={e => setTransferCLABE(e.target.value.replace(/\D/g, ''))} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Número de Cuenta (opcional)</label>
                                    <input type="text" placeholder="Ej: 1234567890"
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-border rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition font-bold text-sm"
                                        value={transferAccountNumber} onChange={e => setTransferAccountNumber(e.target.value.replace(/\D/g, ''))} />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Instrucciones adicionales (opcional)</label>
                                    <textarea rows={2} placeholder="Ej: Enviar comprobante por WhatsApp al 33-1234-5678"
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-border rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition font-medium text-sm resize-none"
                                        value={transferInstructions} onChange={e => setTransferInstructions(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={async () => {
                                setSavingTransfer(true);
                                const res = await updateStoreSettings({
                                    acceptsTransfer,
                                    transferBank,
                                    transferAccountHolder,
                                    transferCLABE,
                                    transferAccountNumber,
                                    transferInstructions,
                                });
                                if (res.success) toast.success(acceptsTransfer ? 'Datos de transferencia guardados' : 'Opción de transferencia desactivada');
                                else toast.error('Error: ' + res.error);
                                setSavingTransfer(false);
                            }}
                            disabled={savingTransfer || (acceptsTransfer && (!transferBank || !transferAccountHolder || !transferCLABE))}
                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                            {savingTransfer ? 'Guardando...' : '🏦 Guardar Datos de Transferencia'}
                        </button>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button onClick={handleSave} disabled={saving}
                        className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50">
                        {saving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        </div>
    );
}

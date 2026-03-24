"use client";

import React, { useState, useEffect, useRef } from 'react';
import { getStoreSettings, updateStoreSettings, updateSellerLogo } from '../actions';
import { validateImageFile } from '@/lib/uploadImage';
import { processImage } from '@/lib/imageUtils';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import _unused from '@/lib/uploadImage';
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
        }
        setLoading(false);
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
        const res = await updateStoreSettings({ storeName, legalName, taxId, address, phone });
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
                    </div>
                </section>

                <div className="pt-6 border-t border-border flex justify-end">
                    <button onClick={handleSave} disabled={saving}
                        className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50">
                        {saving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        </div>
    );
}

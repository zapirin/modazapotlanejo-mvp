"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { getSessionUser, updateProfile } from '@/app/actions/auth';
import { updateSellerLogo, ensureSellerSlug } from '../actions';
import { validateImageFile } from '@/lib/uploadImage';
import { processImage } from '@/lib/imageUtils';

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingLogo, setSavingLogo] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadUser(); }, []);

    const loadUser = async () => {
        setLoading(true);
        const u = await getSessionUser();
        if (u) {
            setUser(u);
            setName(u.name || '');
            setEmail(u.email || '');
            setLogoPreview((u as any).logoUrl || null);
            // Auto-generar slug si el vendedor no tiene uno
            if (u.role === 'SELLER' && !(u as any).sellerSlug) {
                const slugRes = await ensureSellerSlug();
                if (slugRes.success) setUser((prev: any) => ({ ...prev, sellerSlug: slugRes.slug }));
            }
        }
        setLoading(false);
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateImageFile(file);
        if (!validation.valid) {
            setMessage({ type: 'error', text: validation.error! });
            return;
        }

        setSavingLogo(true);
        try {
            const { url, isStorage, sizeKB } = await processImage(file, 'logos');
            setLogoPreview(url);
            const res = await updateSellerLogo(url);
            if (res.success) {
                setMessage({ type: 'success', text: `Logo actualizado (${sizeKB}KB${isStorage ? ' · guardado en CDN' : ''})` });
            } else {
                setMessage({ type: 'error', text: res.error || 'Error al guardar logo' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Error al procesar la imagen' });
        } finally {
            setSavingLogo(false);
        }
        e.target.value = '';
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        if (password && password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
            return;
        }
        setSaving(true);
        const res = await updateProfile({ name, password: password || undefined });
        if (res.success) {
            setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
            setPassword('');
            setConfirmPassword('');
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al actualizar perfil' });
        }
        setSaving(false);
    };

    if (loading) return (
        <div className="p-10 flex justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    const isSeller = user?.role === 'SELLER' || user?.role === 'ADMIN';

    return (
        <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
            <div>
                <h1 className="text-3xl font-black text-foreground tracking-tight">Mi Perfil</h1>
                <p className="text-gray-500 font-medium mt-2">Gestiona tu información personal y seguridad de acceso.</p>
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl text-sm font-bold border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:border-red-800'}`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            {/* Logo movido a Tienda y Facturación */}

            {/* URL del POS — solo para sellers */}
            {isSeller && (user as any)?.sellerSlug && (
                <div className="bg-card rounded-3xl border border-border shadow-sm p-6 space-y-3">
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Enlace del Punto de Venta</h2>
                        <p className="text-xs text-gray-400 font-medium mt-1">Comparte esta URL con tus cajeros para que accedan al POS.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl font-mono text-sm text-blue-600 font-bold truncate">
                            {typeof window !== 'undefined' ? window.location.origin : ''}/acceso/{(user as any).sellerSlug}
                        </div>
                        <button
                            onClick={() => {
                                const url = `${window.location.origin}/acceso/${(user as any).sellerSlug}`;
                                navigator.clipboard.writeText(url);
                                setMessage({ type: 'success', text: '¡Enlace copiado al portapapeles!' });
                            }}
                            className="px-4 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shrink-0"
                        >
                            Copiar
                        </button>
                    </div>
                </div>
            )}

            {/* Datos del perfil */}
            <div className="bg-card rounded-3xl border border-border shadow-sm p-8 space-y-6">
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre Completo</label>
                        <input type="text" required value={name} onChange={e => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold" />
                    </div>
                    <div className="space-y-2 opacity-60">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Correo Electrónico (No Editable)</label>
                        <input type="email" disabled value={email}
                            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-900 border border-border rounded-xl cursor-not-allowed font-medium" />
                    </div>
                    <div className="pt-4 border-t border-border">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Cambiar Contraseña</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nueva Contraseña</label>
                                <input type="password" placeholder="Dejar en blanco para no cambiar" value={password} onChange={e => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Confirmar Contraseña</label>
                                <input type="password" placeholder="Repite la nueva contraseña" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold" />
                            </div>
                        </div>
                    </div>
                    <div className="pt-6 flex justify-end">
                        <button type="submit" disabled={saving}
                            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50">
                            {saving ? 'Guardando...' : 'Actualizar Perfil'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { applyAsSeller } from '@/app/actions/admin';

export default function SellerRegistrationForm({ plans }: { plans: any[] }) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [formData, setFormData] = useState({
        storeName: '',
        contactName: '',
        email: '',
        phone: '',
        categories: [] as string[],
        storeAddress: '',
    });

    const categories = [
        { id: 'damas', name: 'Damas' },
        { id: 'caballeros', name: 'Caballeros' },
        { id: 'niños', name: 'Niños' },
        { id: 'accesorios', name: 'Accesorios' },
        { id: 'calzado', name: 'Calzado' },
    ];

    const toggleCategory = (catId: string) => {
        setFormData(prev => ({
            ...prev,
            categories: prev.categories.includes(catId)
                ? prev.categories.filter(c => c !== catId)
                : [...prev.categories, catId]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (formData.categories.length === 0) {
            setStatus({ type: 'error', message: 'Debes seleccionar al menos una categoría.' });
            return;
        }

        setLoading(true);
        setStatus(null);

        const result = await applyAsSeller({
            ...formData,
            category: formData.categories,
            storeAddress: formData.storeAddress,
        });

        if (result.success) {
            setStatus({ type: 'success', message: '¡Solicitud enviada! Nos pondremos en contacto contigo pronto.' });
            setFormData({ storeName: '', contactName: '', email: '', phone: '', categories: [], storeAddress: '' });
        } else {
            setStatus({ type: 'error', message: result.error || 'Ocurrió un error.' });
        }
        setLoading(false);
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-24 min-h-screen flex flex-col items-center">
            <div className="w-full max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="space-y-4 text-center">
                    <h1 className="text-6xl font-black tracking-tighter uppercase italic text-foreground">Vende en el Marketplace</h1>
                    <p className="text-blue-600 font-bold uppercase tracking-[0.3em] text-xs">Escala tu fábrica al siguiente nivel digital</p>
                </div>

                {/* Planes */}
                <div className="space-y-4">
                    <div className="text-center space-y-1">
                        <h3 className="text-2xl font-black uppercase tracking-tight text-foreground">Elige tu Plan</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Todos incluyen POS · Inventario · Catálogo online · Analítica</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(plans || []).map((plan: any) => (
                            <div key={plan.name} className={`relative p-6 rounded-3xl text-white bg-gradient-to-br ${plan.color} ${plan.highlight ? 'ring-4 ring-blue-400 ring-offset-2' : ''} space-y-3`}>
                                {plan.badge && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-gray-900 text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg whitespace-nowrap">
                                        {plan.badge}
                                    </span>
                                )}
                                <div className="flex justify-between items-start pt-2">
                                    <h4 className="text-lg font-black uppercase">{plan.name}</h4>
                                    <span className="text-right">
                                        <span className="text-xl font-black">{plan.price}</span>
                                    </span>
                                </div>
                                <div className="space-y-1.5 text-[11px] font-bold text-white/90">
                                    <p>🏬 {plan.locations} sucursal{plan.locations > 1 ? 'es' : ''}</p>
                                    <p>👤 {plan.cashiers} cajero{plan.cashiers > 1 ? 's' : ''}</p>
                                    <p>📦 {plan.products === 0 ? 'Ilimitados' : plan.products} productos</p>
                                    {(plan.features || ['POS + Inventario + Catálogo online', 'Analítica de ventas']).map((f: string, fi: number) => (
                                        <p key={fi}>✓ {f}</p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-center text-gray-400 font-medium">
                        Inicia gratis con el plan Básico. El administrador ajusta tu plan según tus necesidades.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-10 bg-white dark:bg-gray-950 p-12 rounded-[50px] border border-border shadow-sm">
                    {status && (
                        <div className={`p-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-center animate-in fade-in zoom-in-95 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            {status.message}
                        </div>
                    )}

                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 pl-2">Tienda o Fábrica</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all font-bold"
                                    placeholder="Nombre de tu negocio"
                                    value={formData.storeName}
                                    onChange={(e) => setFormData({...formData, storeName: e.target.value})}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 pl-2">Persona de Contacto</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all font-bold"
                                    placeholder="Nombre completo"
                                    value={formData.contactName}
                                    onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 pl-2">Correo Electrónico</label>
                                <input 
                                    required
                                    type="email" 
                                    className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all font-bold"
                                    placeholder="ejemplo@correo.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 pl-2">Teléfono WhatsApp</label>
                                <input 
                                    required
                                    type="tel" 
                                    className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all font-bold"
                                    placeholder="33 1234 5678"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                />
                            </div>
                        </div>

                        {/* Domicilio */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 pl-2">
                                Domicilio de la Tienda o Fábrica
                                <span className="ml-2 text-gray-300 font-medium normal-case tracking-normal">— ¿Dónde están ubicados?</span>
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 pl-2">Ciudad / Zona</label>
                                    <select
                                        value={formData.storeAddress.split('|')[0] || ''}
                                        onChange={(e) => {
                                            const city = e.target.value;
                                            const street = formData.storeAddress.split('|')[1] || '';
                                            setFormData({...formData, storeAddress: city ? `${city}|${street}` : street});
                                        }}
                                        className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all font-bold text-sm"
                                    >
                                        <option value="">Selecciona una ciudad...</option>
                                        <optgroup label="Jalisco">
                                            <option value="Zapotlanejo, Jalisco">Zapotlanejo, Jalisco</option>
                                            <option value="Villa Hidalgo, Jalisco">Villa Hidalgo, Jalisco</option>
                                        </optgroup>
                                        <optgroup label="Guadalajara">
                                            <option value="Medrano, Guadalajara">Medrano, Guadalajara</option>
                                            <option value="Obregón, Guadalajara">Obregón, Guadalajara</option>
                                        </optgroup>
                                        <optgroup label="Guanajuato">
                                            <option value="Moroleón, Guanajuato">Moroleón, Guanajuato</option>
                                            <option value="Texticuitzeo, Guanajuato">Texticuitzeo, Guanajuato</option>
                                        </optgroup>
                                        <option value="Otra ciudad">Otra ciudad</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 pl-2">Calle y número (opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Av. Industria #45, Local 12"
                                        value={formData.storeAddress.split('|')[1] || ''}
                                        onChange={(e) => {
                                            const city = formData.storeAddress.split('|')[0] || '';
                                            setFormData({...formData, storeAddress: `${city}|${e.target.value}`});
                                        }}
                                        className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all font-bold text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 p-8 bg-gray-50/50 dark:bg-gray-900/50 rounded-[32px] border border-border/50">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 block mb-4">¿Qué categorías manejas? (Selecciona múltiples)</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] border transition-all ${
                                            formData.categories.includes(cat.id)
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-500/20'
                                                : 'bg-white dark:bg-gray-950 border-border text-gray-500 hover:border-blue-500/50'
                                        }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className={`w-full py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] transition-all shadow-2xl overflow-hidden relative group ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-foreground text-background hover:scale-[1.02] shadow-foreground/20'}`}
                    >
                        <span className="relative z-10">{loading ? 'Procesando...' : 'Enviar Solicitud Premium'}</span>
                        {!loading && <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>}
                        {!loading && <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-black text-white z-20">Enviar Solicitud Premium</span>}
                    </button>
                </form>

                <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] pt-4">
                    ¿YA ERES PARTE? <Link href="/login" className="text-blue-600 hover:underline">ACCESO A SELLER CENTER</Link>
                </p>
            </div>
        </div>
    );
}

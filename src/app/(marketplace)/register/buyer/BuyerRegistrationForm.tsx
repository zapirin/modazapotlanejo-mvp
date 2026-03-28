"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerBuyer } from '@/app/actions/auth';

const ESTADOS_MX = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
    'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México',
    'Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit',
    'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
    'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
];

export default function BuyerRegistrationForm({ brandName }: { brandName: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [type, setType] = useState<'normal' | 'wholesale'>('normal');

    const [formData, setFormData] = useState({
        name: '', email: '', password: '', businessName: '', taxId: '',
    });
    const [address, setAddress] = useState({
        name: '', phone: '', street: '', colonia: '', city: '', state: '', zip: '', referencias: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const result = await registerBuyer({
            email: formData.email,
            name: formData.name,
            password: formData.password,
            isWholesale: type === 'wholesale',
            businessName: type === 'wholesale' ? formData.businessName : undefined,
            taxId: type === 'wholesale' ? formData.taxId : undefined,
            shippingAddress: address.street ? address : undefined,
        });

        if (result.success) {
            router.push('/');
            router.refresh();
        } else {
            setError(result.error || 'Ocurrió un error inesperado');
            setLoading(false);
        }
    };

    const inputClass = "w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold";

    return (
        <div className="min-h-screen bg-background py-24 px-6">
            <div className="max-w-xl mx-auto space-y-12">
                <div className="space-y-4 text-center">
                    <h1 className="text-6xl font-black tracking-tighter uppercase italic text-foreground">Únete como Comprador</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px]">Accede a lo mejor de {brandName}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Tipo de comprador */}
                    <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-[24px] border border-border">
                        <button type="button" onClick={() => setType('normal')}
                            className={`flex-1 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${type === 'normal' ? 'bg-white dark:bg-gray-800 shadow-xl scale-[1.02]' : 'text-gray-400 hover:text-gray-600'}`} style={type === 'normal' ? {color: 'var(--brand-600)'} : {}}>
                            Comprador Individual (B2C)
                        </button>
                        <button type="button" onClick={() => setType('wholesale')}
                            className={`flex-1 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${type === 'wholesale' ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-xl scale-[1.02]' : 'text-gray-400 hover:text-gray-600'}`}>
                            Comprador Mayorista (B2B)
                        </button>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded-2xl text-red-600 text-[10px] font-black uppercase tracking-widest text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-4">Nombre Completo</label>
                            <input type="text" required className={inputClass} placeholder="Ej. Juan Pérez"
                                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-4">Correo Electrónico</label>
                            <input type="email" required className={inputClass} placeholder="tu@email.com"
                                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-4">Contraseña</label>
                            <input type="password" required className={inputClass} placeholder="••••••••"
                                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                        </div>

                        {type === 'wholesale' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 pl-4">Nombre del Negocio</label>
                                    <input type="text" required
                                        className="w-full px-6 py-4 bg-emerald-50/10 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition font-bold"
                                        placeholder="Ej. Boutique Elegancia"
                                        value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 pl-4">RFC / Identificación Fiscal</label>
                                    <input type="text"
                                        className="w-full px-6 py-4 bg-emerald-50/10 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition font-bold"
                                        placeholder="ABC123456XYZ"
                                        value={formData.taxId} onChange={e => setFormData({...formData, taxId: e.target.value})} />
                                </div>
                            </div>
                        )}

                        {/* Dirección de envío obligatoria */}
                        <div className="border border-border rounded-3xl overflow-hidden">
                            <div className="w-full px-6 py-4 flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest" style={{color:"var(--brand-600)"}}>📦 Dirección de Envío <span className="text-red-500">*</span></p>
                                    <p className="text-xs text-gray-400 mt-0.5">Necesaria para recibir tus pedidos</p>
                                </div>
                            </div>
                            <div className="p-6 space-y-4 border-t border-border">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Nombre del destinatario</label>
                                            <input type="text" className={inputClass} placeholder="Quien recibe"
                                                value={address.name} onChange={e => setAddress({...address, name: e.target.value})} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Teléfono</label>
                                            <input type="tel" className={inputClass} placeholder="33 1234 5678"
                                                value={address.phone} onChange={e => setAddress({...address, phone: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Calle y número</label>
                                        <input type="text" className={inputClass} placeholder="Ej. Av. Revolución 123"
                                            value={address.street} onChange={e => setAddress({...address, street: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Colonia</label>
                                            <input type="text" className={inputClass} placeholder="Col. Centro"
                                                value={address.colonia} onChange={e => setAddress({...address, colonia: e.target.value})} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Ciudad</label>
                                            <input type="text" className={inputClass} placeholder="Guadalajara"
                                                value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Estado</label>
                                            <select className={inputClass} value={address.state} onChange={e => setAddress({...address, state: e.target.value})}>
                                                <option value="">Selecciona...</option>
                                                {ESTADOS_MX.map(e => <option key={e} value={e}>{e}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Código Postal</label>
                                            <input type="text" maxLength={5} className={inputClass} placeholder="44100"
                                                value={address.zip} onChange={e => setAddress({...address, zip: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Referencias <span className="text-red-500">*</span></label>
                                        <input type="text" required className={inputClass}
                                            placeholder="Ej. Entre Av. López y calle Morelos, casa azul con reja negra"
                                            value={address.referencias} onChange={e => setAddress({...address, referencias: e.target.value})} />
                                    </div>
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={loading}
                        className={`w-full py-5 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-2xl transition-all ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-foreground text-background hover:scale-[1.02] shadow-foreground/20'}`}>
                        {loading ? 'Procesando...' : 'Crear mi Cuenta'}
                    </button>
                </form>

                <div className="text-center space-y-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        ¿Ya tienes cuenta? <Link href="/login" className="hover:underline" style={{color:"var(--brand-600)"}}>Inicia Sesión</Link>
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed px-12">
                        Al registrarte aceptas nuestros <Link href="/terms" className="underline">Términos</Link> y <Link href="/privacy" className="underline">Política de Privacidad</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

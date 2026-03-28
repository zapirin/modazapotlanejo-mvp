import React from 'react';
import Navbar from './Navbar';
import Providers from './Providers';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import { getMarketplaceSettings } from '@/app/actions/marketplace';
import { unstable_noStore as noStore } from 'next/cache';
import type { Metadata } from 'next';
import { getSessionUser } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

// Mapa de colores por nombre de marca
const COLOR_MAP: Record<string, Record<string, string>> = {
    blue:    { c50:'#eff6ff', c100:'#dbeafe', c200:'#bfdbfe', c500:'#3b82f6', c600:'#2563eb', c700:'#1d4ed8', rgb:'37,99,235' },
    violet:  { c50:'#f5f3ff', c100:'#ede9fe', c200:'#ddd6fe', c500:'#8b5cf6', c600:'#7c3aed', c700:'#6d28d9', rgb:'124,58,237' },
    emerald: { c50:'#ecfdf5', c100:'#d1fae5', c200:'#a7f3d0', c500:'#10b981', c600:'#059669', c700:'#047857', rgb:'5,150,105' },
    amber:   { c50:'#fffbeb', c100:'#fef3c7', c200:'#fde68a', c500:'#f59e0b', c600:'#d97706', c700:'#b45309', rgb:'217,119,6' },
    rose:    { c50:'#fff1f2', c100:'#ffe4e6', c200:'#fecdd3', c500:'#f43f5e', c600:'#e11d48', c700:'#be123c', rgb:'225,29,72' },
    slate:   { c50:'#f8fafc', c100:'#f1f5f9', c200:'#e2e8f0', c500:'#64748b', c600:'#475569', c700:'#334155', rgb:'71,85,105' },
};

function getBrandCssVars(color: string): string {
    const c = COLOR_MAP[color] || COLOR_MAP.blue;
    return `--brand-50:${c.c50};--brand-100:${c.c100};--brand-200:${c.c200};--brand-500:${c.c500};--brand-600:${c.c600};--brand-700:${c.c700};--brand-rgb:${c.rgb};`;
}

export async function generateMetadata(): Promise<Metadata> {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    const brand = getBrandConfig(host);
    
    return {
        title: {
            default: brand.name,
            template: `%s | ${brand.name}`
        },
        description: brand.description,
    };
}

export default async function MarketplaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    noStore(); // Forzar lectura fresca de BD en cada request
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    const brand = getBrandConfig(host);
    const user = await getSessionUser();
    // Leer color de marca guardado por el admin (si existe)
    let brandPrimaryColor = brand.primaryColor;
    try {
        const settings = await getMarketplaceSettings();
        const brandColors = (settings as any)?.brandColors as Record<string,string> | undefined;
        const savedColor = brandColors?.[brand.domain];
        if (savedColor) brandPrimaryColor = savedColor;
    } catch {}

    return (
        <Providers>
        <div className="min-h-screen bg-background" style={{'--brand-50': COLOR_MAP[brandPrimaryColor]?.c50 || COLOR_MAP.blue.c50, '--brand-100': COLOR_MAP[brandPrimaryColor]?.c100 || COLOR_MAP.blue.c100, '--brand-200': COLOR_MAP[brandPrimaryColor]?.c200 || COLOR_MAP.blue.c200, '--brand-500': COLOR_MAP[brandPrimaryColor]?.c500 || COLOR_MAP.blue.c500, '--brand-600': COLOR_MAP[brandPrimaryColor]?.c600 || COLOR_MAP.blue.c600, '--brand-700': COLOR_MAP[brandPrimaryColor]?.c700 || COLOR_MAP.blue.c700} as React.CSSProperties}>
            <Navbar brandConfig={brand} user={user} />
            <main className="pt-28">
                {children}
            </main>
            <footer className="bg-gray-50 dark:bg-gray-900 border-t border-border py-12 mt-20">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="relative w-8 h-8 overflow-hidden rounded-lg">
                                <Image 
                                    src={brand.logo.url} 
                                    alt={brand.name} 
                                    fill 
                                    className="object-contain"
                                />
                            </div>
                            <div className="flex flex-col leading-[0.85]">
                                {brand.logo.text.split(' ').map((word, i) => (
                                    <span key={i} className={`font-black tracking-tight uppercase ${i === 0 ? 'text-lg' : 'text-[10px] opacity-70'}`}>
                                        {word}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            {brand.footerDescription} Conectando a los mejores fabricantes con compradores de todo México.
                        </p>
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em]" style={{color:"var(--brand-600)"}}>Marketplace</h4>
                        <ul className="space-y-2 text-sm text-gray-500 font-bold uppercase tracking-widest">
                            <li><Link href="/catalog" className="hover:text-blue-600 transition-colors">Catálogo</Link></li>
                            <li><Link href="/categories" className="hover:text-blue-600 transition-colors">Categorías</Link></li>
                            <li><Link href="/brands" className="hover:text-blue-600 transition-colors">Marcas</Link></li>
                        </ul>
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em]" style={{color:"var(--brand-600)"}}>Legal</h4>
                        <ul className="space-y-2 text-sm text-gray-500 font-bold uppercase tracking-widest">
                            <li><Link href={(brand as any).privacyUrl || "/privacy"} className="hover:text-blue-600 transition-colors">Privacidad</Link></li>
                            <li><Link href={(brand as any).termsUrl || "/terms"} className="hover:text-blue-600 transition-colors">Términos</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em]" style={{color:"var(--brand-600)"}}>Vende con Nosotros</h4>
                        <ul className="space-y-2 text-sm text-gray-500 font-bold uppercase tracking-widest">
                            <li>
                                <Link href="/register/seller" className="hover:text-blue-600 transition-colors flex items-center gap-1.5 group">
                                    <span className="text-blue-500 group-hover:scale-110 transition-transform">🏪</span>
                                    Vender en {brand.name}
                                </Link>
                            </li>
                            <li><Link href="/dashboard" className="hover:text-blue-600 transition-colors">Panel de Vendedor</Link></li>
                        </ul>
                    </div>

                </div>
                <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <span>© 2026 MODAZAPOTLANEJO.COM</span>
                    <span>Hecho con ❤️ en Zapotlanejo</span>
                </div>
            </footer>
        </div>
        </Providers>
    );
}

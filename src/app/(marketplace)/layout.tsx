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
import { getCategories, getBrands, getActiveBrandConfig } from './actions';

export const dynamic = 'force-dynamic';

// Mapa de colores por nombre de marca
const COLOR_MAP: Record<string, Record<string, string>> = {
    blue:    { c50:'#eff6ff', c100:'#dbeafe', c200:'#bfdbfe', c500:'#3b82f6', c600:'#2563eb', c700:'#1d4ed8', rgb:'37,99,235' },
    violet:  { c50:'#f5f3ff', c100:'#ede9fe', c200:'#ddd6fe', c500:'#8b5cf6', c600:'#7c3aed', c700:'#6d28d9', rgb:'124,58,237' },
    emerald: { c50:'#ecfdf5', c100:'#d1fae5', c200:'#a7f3d0', c500:'#10b981', c600:'#059669', c700:'#047857', rgb:'5,150,105' },
    amber:   { c50:'#fffbeb', c100:'#fef3c7', c200:'#fde68a', c500:'#f59e0b', c600:'#d97706', c700:'#b45309', rgb:'217,119,6' },
    rose:    { c50:'#fff1f2', c100:'#ffe4e6', c200:'#fecdd3', c500:'#f43f5e', c600:'#e11d48', c700:'#be123c', rgb:'225,29,72' },
    slate:   { c50:'#f8fafc', c100:'#f1f5f9', c200:'#e2e8f0', c500:'#64748b', c600:'#475569', c700:'#334155', rgb:'71,85,105' },
    kalexa:  { c50:'#f5f0ff', c100:'#ece0ff', c200:'#d4b8ff', c500:'#8124E3', c600:'#6b1dc0', c700:'#550fa0', rgb:'129,36,227' },
};

function getBrandCssVars(color: string): string {
    const c = COLOR_MAP[color] || COLOR_MAP.blue;
    return `--brand-50:${c.c50};--brand-100:${c.c100};--brand-200:${c.c200};--brand-500:${c.c500};--brand-600:${c.c600};--brand-700:${c.c700};--brand-rgb:${c.rgb};`;
}

export async function generateMetadata(): Promise<Metadata> {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = await getActiveBrandConfig(host);
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    return {
        metadataBase: new URL(baseUrl),
        title: {
            default: brand.name,
            template: `%s | ${brand.name}`,
        },
        description: brand.description,
        keywords: brand.isSingleVendor
            ? [`${brand.name}`, 'ropa moda', 'Zapotlanejo', 'jeans', 'blusas', 'tienda en línea', 'moda mujer', 'moda hombre']
            : ['marketplace ropa', 'mayoreo ropa México', 'Zapotlanejo Jalisco', 'moda mayorista', 'ropa al por mayor', 'fabricantes ropa'],
        authors: [{ name: brand.name, url: baseUrl }],
        creator: brand.name,
        publisher: brand.name,
        robots: {
            index: true,
            follow: true,
            googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
        },
        openGraph: {
            type: 'website',
            locale: 'es_MX',
            url: baseUrl,
            siteName: brand.name,
            title: brand.name,
            description: brand.description,
            images: [
                {
                    url: `${baseUrl}${brand.logo.url}`,
                    width: 1200,
                    height: 630,
                    alt: brand.name,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: brand.name,
            description: brand.description,
            images: [`${baseUrl}${brand.logo.url}`],
        },
        alternates: {
            canonical: baseUrl,
        },
    };
}

export default async function MarketplaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    noStore(); // Forzar lectura fresca de BD en cada request
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = await getActiveBrandConfig(host);
    const user = await getSessionUser();
    // Leer color de marca guardado por el admin (si existe)
    let brandPrimaryColor = brand.primaryColor;
    try {
        const settingsRes = await getMarketplaceSettings();
        if (settingsRes.success && settingsRes.data) {
            const brandColors = (settingsRes.data as any)?.brandColors as Record<string,string> | undefined;
            const savedColor = brandColors?.[brand.domain];
            if (savedColor) brandPrimaryColor = savedColor;
        }
    } catch {}
    // Fetch dynamic menu data
    let [categories, brandsData] = await Promise.all([
        getCategories(brand.isSingleVendor ? brand.sellerId : undefined),
        getBrands(brand.isSingleVendor ? brand.sellerId : undefined)
    ]);

    // Filtrar categorías excluidas para tiendas de un solo vendedor
    if (brand.isSingleVendor && brand.excludeCategories && brand.excludeCategories.length > 0) {
        const excluded = brand.excludeCategories.map((c: string) => c.toUpperCase());
        categories = categories.filter((c: any) => !excluded.includes(c.name.toUpperCase()));
    }

    return (
        <Providers>
        <div className="min-h-screen bg-background" style={{'--brand-50': COLOR_MAP[brandPrimaryColor]?.c50 || COLOR_MAP.blue.c50, '--brand-100': COLOR_MAP[brandPrimaryColor]?.c100 || COLOR_MAP.blue.c100, '--brand-200': COLOR_MAP[brandPrimaryColor]?.c200 || COLOR_MAP.blue.c200, '--brand-500': COLOR_MAP[brandPrimaryColor]?.c500 || COLOR_MAP.blue.c500, '--brand-600': COLOR_MAP[brandPrimaryColor]?.c600 || COLOR_MAP.blue.c600, '--brand-700': COLOR_MAP[brandPrimaryColor]?.c700 || COLOR_MAP.blue.c700} as React.CSSProperties}>
            <Navbar brandConfig={brand} user={user} categories={categories} brands={brandsData} />
            <main className="pt-28">
                {children}
            </main>
            <footer className="bg-gray-50 dark:bg-gray-900 border-t border-border py-12 mt-20">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
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
                            {brand.footerDescription}
                        </p>
                        {brand.isSingleVendor && brand.storeInfo && (
                            <div className="space-y-1 text-xs text-gray-400">
                                <p className="flex items-center gap-1.5">📍 {brand.storeInfo.address}</p>
                                <p className="flex items-center gap-1.5">🕐 {brand.storeInfo.schedule}</p>
                                {brand.storeInfo.since && <p className="flex items-center gap-1.5">🏪 Desde {brand.storeInfo.since}</p>}
                            </div>
                        )}
                        {brand.isSingleVendor && brand.socialLinks && (
                            <div className="flex gap-2 pt-2 flex-wrap">
                                {brand.whatsapp && (
                                    <a href={`https://wa.me/${brand.whatsapp}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-9 h-9 rounded-full flex items-center justify-center hover:scale-110 transition-transform hover:opacity-90" style={{background:'#25D366'}}>
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                    </a>
                                )}
                                {brand.socialLinks.instagram && (
                                    <a href={brand.socialLinks.instagram} target="_blank" rel="noopener noreferrer" title="Instagram" className="w-9 h-9 rounded-full flex items-center justify-center hover:scale-110 transition-transform hover:opacity-90" style={{background:'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)'}}>
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                                    </a>
                                )}
                                {brand.socialLinks.facebook && (
                                    <a href={brand.socialLinks.facebook} target="_blank" rel="noopener noreferrer" title="Facebook" className="w-9 h-9 rounded-full flex items-center justify-center hover:scale-110 transition-transform hover:opacity-90" style={{background:'#1877F2'}}>
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                    </a>
                                )}
                                {brand.socialLinks.tiktok && (
                                    <a href={brand.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" title="TikTok" className="w-9 h-9 rounded-full flex items-center justify-center hover:scale-110 transition-transform hover:opacity-90" style={{background:'#010101'}}>
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                                    </a>
                                )}
                                {brand.socialLinks.youtube && (
                                    <a href={brand.socialLinks.youtube} target="_blank" rel="noopener noreferrer" title="YouTube" className="w-9 h-9 rounded-full flex items-center justify-center hover:scale-110 transition-transform hover:opacity-90" style={{background:'#FF0000'}}>
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em]" style={{color:"var(--brand-600)"}}>{brand.isSingleVendor ? 'Tienda' : 'Marketplace'}</h4>
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

                    {!brand.isSingleVendor ? (
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
                    ) : (
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em]" style={{color:"var(--brand-600)"}}>Contacto</h4>
                            <ul className="space-y-2 text-sm text-gray-500 font-bold uppercase tracking-widest">
                                {brand.whatsapp && (
                                    <li>
                                        <a href={`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent('Hola, me interesa información de sus productos.')}`} target="_blank" rel="noopener noreferrer" className="hover:text-green-600 transition-colors flex items-center gap-1.5">
                                            📱 WhatsApp
                                        </a>
                                    </li>
                                )}
                                <li><Link href="/register/buyer" className="hover:text-blue-600 transition-colors">Crear Cuenta</Link></li>
                            </ul>
                        </div>
                    )}

                </div>
                <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <span>© 2026 {brand.name.toUpperCase()}</span>
                    <span>Hecho con ❤️ en Zapotlanejo</span>
                </div>
            </footer>
        </div>
        </Providers>
    );
}

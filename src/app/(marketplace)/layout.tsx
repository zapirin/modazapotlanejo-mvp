import React from 'react';
import Navbar from './Navbar';
import Providers from './Providers';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import type { Metadata } from 'next';
import { getSessionUser } from '@/app/actions/auth';

export async function generateMetadata(): Promise<Metadata> {
    const headersList = await headers();
    const host = headersList.get('host');
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
    const headersList = await headers();
    const host = headersList.get('host');
    const brand = getBrandConfig(host);
    const user = await getSessionUser();

    return (
        <Providers>
        <div className="min-h-screen bg-background">
            <Navbar brandConfig={brand} user={user} />
            <main className="pt-28">
                {children}
            </main>
            <footer className="bg-gray-50 dark:bg-gray-900 border-t border-border py-12 mt-20">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="relative w-8 h-8 overflow-hidden rounded-lg bg-white p-0.5">
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
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Marketplace</h4>
                        <ul className="space-y-2 text-sm text-gray-500 font-bold uppercase tracking-widest">
                            <li><Link href="/catalog" className="hover:text-blue-600 transition-colors">Catálogo</Link></li>
                            <li><Link href="/categories" className="hover:text-blue-600 transition-colors">Categorías</Link></li>
                            <li><Link href="/brands" className="hover:text-blue-600 transition-colors">Marcas</Link></li>
                        </ul>
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Legal</h4>
                        <ul className="space-y-2 text-sm text-gray-500 font-bold uppercase tracking-widest">
                            <li><Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacidad</Link></li>
                            <li><Link href="/terms" className="hover:text-blue-600 transition-colors">Términos</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Vende con Nosotros</h4>
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

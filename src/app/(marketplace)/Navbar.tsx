"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { BrandConfig } from '@/lib/brand';
import { useCart } from '@/lib/CartContext';
import { useRecentlyViewed } from '@/lib/RecentlyViewedContext';
import { getUnreadCount } from '@/app/actions/messages';

export default function Navbar({ brandConfig, user }: { brandConfig: BrandConfig, user: any }) {
    const pathname = usePathname();
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { items: recentlyViewed } = useRecentlyViewed();
    const { getItemCount } = useCart();
    const itemCount = getItemCount();
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Check initial state from localStorage or DOM
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || (!stored && document.documentElement.classList.contains('dark'))) {
            setIsDark(true);
        }
    }, []);

    const toggleTheme = () => {
        const newDark = !isDark;
        setIsDark(newDark);
        if (newDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
        setSearchOpen(false);
    }, [pathname]);

    // Fetch unread messages count
    useEffect(() => {
        const fetchUnread = async () => {
            try {
                const count = await getUnreadCount();
                setUnreadCount(count);
            } catch (error) {
                console.error('Error fetching unread count:', error);
            }
        };
        fetchUnread();
        
        // Refresh every 30 seconds
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleSearch = () => {
        if (searchQuery.trim()) {
            router.push(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
            setSearchOpen(false);
            setSearchQuery('');
        }
    };

    const navLinks = [
        { name: 'Inicio', href: '/' },
        { name: 'Catálogo', href: '/catalog' },
        { name: 'Categorías', href: '/categories' },
        { name: 'Marcas', href: '/brands' },
        { name: 'Vendedores', href: '/vendors' },
    ];

    return (
        <>
            <nav 
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    scrolled || mobileMenuOpen || searchOpen
                        ? 'bg-white/80 dark:bg-gray-950/80 backdrop-blur-md shadow-sm border-b border-border py-3' 
                        : 'bg-transparent py-4'
                }`}
            >
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
                    <Link href="/" className="flex items-center gap-3 group shrink-0">
                        <div className="relative w-12 h-12 overflow-hidden rounded-xl shadow-lg shadow-blue-500/10 group-hover:scale-105 transition-transform bg-white p-0.5">
                            <Image
                                src={brandConfig.logo.url}
                                alt={brandConfig.name}
                                fill
                                className="object-contain"
                            />
                        </div>
                        <div className="flex flex-col leading-[0.85] hidden sm:flex">
                            {brandConfig.logo.text.split(' ').map((word: string, i: number) => (
                                <span key={i} className={`font-black tracking-tight text-foreground uppercase ${i === 0 ? 'text-xl' : 'text-[11px] opacity-70'}`}>
                                    {word}
                                </span>
                            ))}
                        </div>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden lg:flex items-center gap-6">
                        {navLinks.map((link) => (
                            <Link 
                                key={link.href} 
                                href={link.href}
                                className={`text-xs font-black uppercase tracking-widest transition-colors hover:text-blue-600 ${
                                    pathname === link.href ? 'text-[color:var(--brand-600)]' : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3">
                        {/* Theme Toggle (Desktop) */}
                        <button 
                            onClick={toggleTheme}
                            className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors hidden sm:block"
                            aria-label="Cambiar tema"
                        >
                            {isDark ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>

                        {/* Search Toggle */}
                        <button 
                            onClick={() => setSearchOpen(!searchOpen)}
                            className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors"
                            aria-label="Buscar"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </button>

                        {/* Wishlist Icon */}
                        <Link href="/wishlist" className="p-2 text-gray-700 dark:text-gray-300 hover:text-red-500 transition-colors relative" title="Mi Lista de Deseos">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </Link>

                        {/* Messages Icon */}
                        <Link href="/messages" className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors relative" title="Mis Mensajes">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 border-2 border-white dark:border-gray-950 rounded-full" style={{backgroundColor:"var(--brand-600)"}}></span>
                            )}
                        </Link>

                        {/* Cart Icon */}
                        <Link href="/cart" className="relative p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            {itemCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-in zoom-in duration-200" style={{backgroundColor:"var(--brand-600)"}}>
                                    {itemCount}
                                </span>
                            )}
                        </Link>

                        <Link 
                            href={user ? "/dashboard" : "/login"} 
                            className="text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors"
                        >
                            {user ? "Mi cuenta" : "Ingresar"}
                        </Link>
                        {!user && (
                            <Link 
                                href="/register/buyer" 
                                className="hidden sm:inline-flex px-5 py-2.5 bg-foreground text-background rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-foreground/10"
                            >
                                Registrarse
                            </Link>
                        )}
                        {/* Mobile Hamburger */}
                        <button 
                            className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Menú"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Search Bar — Expandable */}
                {searchOpen && (
                    <div className="max-w-7xl mx-auto px-6 pt-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 border border-border rounded-2xl px-5 py-3">
                            <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Buscar productos, categorías, vendedores..."
                                className="flex-1 bg-transparent outline-none text-sm font-bold placeholder:text-gray-400"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                autoFocus
                            />
                            <button 
                                onClick={handleSearch}
                                className="px-4 py-1.5 text-white rounded-xl text-xs font-black uppercase tracking-widest transition" style={{backgroundColor:"var(--brand-600)"}}
                            >
                                Buscar
                            </button>
                            <button 
                                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                                className="text-gray-400 hover:text-gray-600 transition p-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-lg pt-24 px-6 md:hidden animate-in fade-in slide-in-from-right duration-300">
                    <div className="flex flex-col gap-2">
                        {/* Mobile Header with Theme Toggle */}
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Menú</h4>
                            <button 
                                onClick={toggleTheme}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-border rounded-full text-xs font-bold text-foreground"
                            >
                                {isDark ? (
                                    <><svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> Modo Claro</>
                                ) : (
                                    <><svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> Modo Oscuro</>
                                )}
                            </button>
                        </div>

                        {/* Mobile search */}
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 border border-border rounded-2xl px-4 py-3 mb-4">
                            <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="flex-1 bg-transparent outline-none text-sm font-bold placeholder:text-gray-400"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                            />
                        </div>
                        
                        {navLinks.map((link) => (
                            <Link 
                                key={link.href} 
                                href={link.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`px-4 py-4 rounded-2xl text-lg font-black tracking-tight transition-colors ${
                                    pathname === link.href 
                                        ? 'text-[color:var(--brand-600)] bg-[color:var(--brand-50)] dark:bg-gray-800' 
                                        : 'text-foreground hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                        {/* Recently Viewed (Mobile) */}
                        {recentlyViewed.length > 0 && (
                            <div className="mt-8 space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Visto Recientemente</h4>
                                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                                    {recentlyViewed.map(item => (
                                        <Link 
                                            key={item.id} 
                                            href={`/catalog/${item.id}`}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="w-20 h-28 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 border border-border"
                                        >
                                            <Image src={item.image} alt={item.name} width={80} height={112} className="object-cover w-full h-full" />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        <hr className="border-border my-4" />
                        {!user && (
                            <Link 
                                href="/register/buyer" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="px-4 py-4 rounded-2xl text-lg font-black transition-colors text-[color:var(--brand-600)]"
                            >
                                Registrarse
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

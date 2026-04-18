import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getLatestProducts, getFeaturedCategories, getBestSellers, getNewArrivals, getLandingStats, getActiveBrandConfig } from './actions';
import { getMarketplaceSettings, getFeaturedContent } from '@/app/actions/marketplace';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import { unstable_noStore as noStore } from 'next/cache';
import { getSessionUser } from '@/app/actions/auth';
import RecentlyViewed from '@/components/RecentlyViewed';
import ProductCard from './ProductCard';
import HeroSlider from '@/components/HeroSlider';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = await getActiveBrandConfig(host);
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const isModa = host.includes('modazapotlanejo');
    const isZona = host.includes('zonadelvestir');

    const isKalexa = host.includes('kalexafashion');

    const title = isModa
        ? 'Moda Zapotlanejo — Marketplace Mayorista de Ropa Jalisco'
        : isZona
        ? 'Zona del Vestir — Moda Mayorista México'
        : isKalexa
        ? 'Kalexa Fashion | Jeans y Ropa de Mayoreo desde Zapotlanejo, Jalisco'
        : brand.name;

    const description = isModa
        ? 'El marketplace mayorista líder de Zapotlanejo, Jalisco. Compra ropa al mayoreo directo de fabricantes: jeans, blusas, vestidos, pantalones y más. Envíos a todo México.'
        : isZona
        ? 'Zona del Vestir — La zona mayorista de moda más grande de México. Ropa al por mayor de fabricantes y distribuidoras con los mejores precios. Envíos a todo México.'
        : isKalexa
        ? 'Catálogo mayorista con más de 2,000 modelos. Pantalones, blusas, vestidos y jeans de moda. Directo de fábrica desde Zapotlanejo. Envío a todo México.'
        : brand.description;

    const keywords = isModa
        ? ['ropa mayoreo Zapotlanejo', 'marketplace mayorista ropa', 'jeans mayoreo Jalisco', 'blusas mayoreo México', 'fabricantes ropa Zapotlanejo', 'moda mayorista Jalisco', 'comprar ropa mayoreo']
        : isZona
        ? ['zona del vestir', 'ropa mayoreo México', 'moda mayorista', 'fabricantes textiles México', 'ropa al por mayor', 'mayoristas moda México']
        : isKalexa
        ? ['Kalexa Fashion', 'jeans mayoreo Zapotlanejo', 'ropa mayoreo Jalisco', 'blusas mayoreo', 'pantalones dama mayoreo', 'tienda ropa en línea México', 'ropa mujer mayoreo']
        : [brand.name, 'ropa moda', 'Zapotlanejo', 'jeans', 'blusas', 'tienda en línea México'];

    return {
        title,
        description,
        keywords,
        openGraph: {
            title,
            description,
            url: baseUrl,
            type: 'website',
            locale: 'es_MX',
            siteName: brand.name,
            images: [{ url: `${baseUrl}${brand.logo.url}`, width: 1200, height: 630, alt: brand.name }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [`${baseUrl}${brand.logo.url}`],
        },
        alternates: { canonical: baseUrl },
    };
}


const COLOR_MAP: Record<string, Record<string, string>> = {
    blue: { c50: '#eff6ff', c500: '#3b82f6', c600: '#2563eb', c700: '#1d4ed8' },
    violet: { c50: '#f5f3ff', c500: '#8b5cf6', c600: '#7c3aed', c700: '#6d28d9' },
    emerald: { c50: '#ecfdf5', c500: '#10b981', c600: '#059669', c700: '#047857' },
    amber: { c50: '#fffbeb', c500: '#f59e0b', c600: '#d97706', c700: '#b45309' },
    rose: { c50: '#fff1f2', c500: '#eb3ff4ff', c600: '#eb3ff4ff', c700: '#eb3ff4ff' },
    slate: { c50: '#f8fafc', c500: '#64748b', c600: '#475569', c700: '#334155' },
    kalexa: { c50: '#f5f0ff', c500: '#8124E3', c600: '#6b1dc0', c700: '#550fa0' },
};

export default async function LandingPage() {
    noStore();
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = await getActiveBrandConfig(host);

    const sellerId = brand.sellerId || undefined;
    const [products, categories, user, bestSellers, newArrivals, stats, siteSettings, featured] = await Promise.all([
        getLatestProducts(8, sellerId),
        getFeaturedCategories(),
        getSessionUser(),
        getBestSellers(4, sellerId),
        getNewArrivals(8, sellerId),
        getLandingStats(sellerId),
        getMarketplaceSettings(),
        getFeaturedContent(),
    ]);
    // Filtrar categorías excluidas para tiendas de un solo vendedor
    const filteredCategories = brand.excludeCategories && brand.excludeCategories.length > 0
        ? categories.filter((c: any) => !brand.excludeCategories!.map(e => e.toUpperCase()).includes(c.name.toUpperCase()))
        : categories;

    const heroImageUrl = brand.isSingleVendor ? (brand.heroImage || siteSettings?.data?.heroImage || null) : (siteSettings?.data?.heroImage || brand.heroImage || null);

    // Build slider images: DB heroImages → brand config images → single heroImage → product images
    const heroImages: string[] = (() => {
        const dbImages = (siteSettings?.data as any)?.heroImages as string[] | undefined;
        if (dbImages && dbImages.length > 0) return dbImages;
        if (brand.heroImages && brand.heroImages.length > 0) return brand.heroImages;
        const slides: string[] = [];
        if (heroImageUrl) slides.push(heroImageUrl);
        // Fill remaining slots with product images (for visual variety)
        const productImgs = [...bestSellers, ...newArrivals]
            .map((p: any) => Array.isArray(p.images) ? p.images[0] : null)
            .filter((url: any): url is string => typeof url === 'string' && url.length > 0);
        const seen = new Set(slides);
        for (const url of productImgs) {
            if (!seen.has(url) && slides.length < 5) { seen.add(url); slides.push(url); }
        }
        return slides;
    })();

    // @ts-ignore
    const isWholesale = !!user?.isWholesale;
    const showPricesWithoutLogin = (host || '').includes('kalexafashion');
    const nowMs = Date.now(); // calculado una sola vez en servidor
    const month = new Date(nowMs).getMonth(); // usa el mismo nowMs para consistencia

    // Temporada — calculada en servidor con nowMs fijo
    const season = month >= 2 && month <= 4 ? { name: 'Primavera 2026', emoji: '🌸' }
        : month >= 5 && month <= 7 ? { name: 'Verano 2026', emoji: '☀️' }
            : month >= 8 && month <= 10 ? { name: 'Otoño 2026', emoji: '🍂' }
                : { name: 'Invierno 2026', emoji: '❄️' };

    const protocol2 = (host || '').includes('localhost') ? 'http' : 'https';
    const baseUrl2 = `${protocol2}://${(host || 'modazapotlanejo.com').split(',')[0].trim().replace(/^https?:\/\//, '')}`;

    const orgJsonLd = {
        '@context': 'https://schema.org',
        '@type': brand.isSingleVendor ? 'Store' : 'Organization',
        name: brand.name,
        description: brand.description,
        url: baseUrl2,
        logo: `${baseUrl2}${brand.logo.url}`,
        ...(brand.isSingleVendor && brand.storeInfo?.address ? { address: { '@type': 'PostalAddress', addressLocality: 'Zapotlanejo', addressRegion: 'Jalisco', addressCountry: 'MX' } } : {}),
        ...(brand.whatsapp ? { telephone: `+${brand.whatsapp}` } : {}),
        sameAs: [
            brand.socialLinks?.instagram,
            brand.socialLinks?.facebook,
            brand.socialLinks?.tiktok,
        ].filter(Boolean),
    };

    return (
        <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <div className="flex flex-col">

            {/* ── HERO ── */}
            <section className="relative min-h-[95vh] flex items-center overflow-hidden" suppressHydrationWarning>
                <HeroSlider
                    images={heroImages}
                    gradient="linear-gradient(to bottom right, #0f172a, #1e3a8a, #312e81)"
                >

                <div className="max-w-7xl mx-auto px-6 relative z-10 w-full pt-20 pb-40">
                    <div className="max-w-2xl space-y-8">
                        {/* Banner temporada */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-black uppercase tracking-widest" style={{ background: "linear-gradient(to right, var(--brand-600), var(--brand-700))", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                            <span>{season.emoji}</span>
                            <span>Tendencias {season.name}</span>
                            {stats.newThisWeek > 0 && (
                                <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-[9px]">
                                    +{stats.newThisWeek} esta semana
                                </span>
                            )}
                        </div>

                        <div className="space-y-4">
                            <h2 className="font-black uppercase tracking-[0.2em] text-xs md:text-sm drop-shadow-sm" style={{ color: "var(--brand-500)" }}>{brand.isSingleVendor ? brand.tagline : `${brand.name} Fashion Marketplace`}</h2>
                            <h1 className="text-6xl md:text-9xl font-black tracking-tighter leading-[0.85] text-foreground drop-shadow-sm">
                                {brand.isSingleVendor ? (
                                    <>{brand.name.split(' ')[0].toUpperCase()} <br /><span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(to right, var(--brand-600), var(--brand-700))" }}>{brand.name.split(' ').slice(1).join(' ').toUpperCase() || 'FASHION'}.</span></>
                                ) : (
                                    <>LA MODA <br />QUE MUEVE A <br /><span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(to right, var(--brand-600), var(--brand-700))" }}>MÉXICO.</span></>
                                )}
                            </h1>
                        </div>
                        <p className="text-lg md:text-xl text-foreground/80 dark:text-white/80 font-medium max-w-lg leading-relaxed drop-shadow-sm">
                            {brand.isSingleVendor ? brand.description : `${brand.description} Calidad premium, precios de fábrica y envíos a todo el país.`}
                        </p>
                        <div className="flex flex-wrap gap-4 pt-4">
                            <Link href="/catalog" className="px-8 py-4 text-white rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl" style={{ backgroundColor: "var(--brand-600)" }}>
                                Explorar Catálogo
                            </Link>

                        </div>
                    </div>
                </div>

                {/* Stats reales en tiempo real */}
                <div className="absolute bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t border-border">
                    <div className="max-w-7xl mx-auto px-6 py-5">
                        <div className="flex flex-wrap gap-8 md:gap-16 items-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                            {!brand.isSingleVendor && stats.totalSellers >= 50 && (
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-black text-foreground">{stats.totalSellers}</span>
                                    <span>Vendedores<br />verificados</span>
                                </div>
                            )}
                            <div className={`flex items-center gap-3 ${!brand.isSingleVendor ? 'md:border-l md:border-border md:pl-16' : ''}`}>
                                <span className="text-2xl font-black text-foreground">{stats.totalProducts.toLocaleString()}</span>
                                <span>Productos<br />en catálogo</span>
                            </div>
                            <div className="flex items-center gap-3 md:border-l md:border-border md:pl-16">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                <span className="text-2xl font-black text-emerald-500">{stats.newThisWeek}</span>
                                <span>Nuevos<br />esta semana</span>
                            </div>
                            {brand.isSingleVendor && brand.whatsapp && (
                                <div className="flex items-center gap-3 md:border-l md:border-border md:pl-16">
                                    <a href={`https://wa.me/${brand.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-full text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform" style={{backgroundColor: brand.isSingleVendor ? '#25D366' : 'var(--brand-600)'}}>
                                        📱 WhatsApp
                                    </a>
                                </div>
                            )}
                            {!brand.isSingleVendor && stats.totalOrders >= 100 && (
                                <div className="flex items-center gap-3 md:border-l md:border-border md:pl-16">
                                    <span className="text-2xl font-black text-foreground">{stats.totalOrders.toLocaleString()}</span>
                                    <span>Pedidos<br />completados</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                </HeroSlider>
            </section>

            {/* ── TICKER NOVEDADES ── */}
            {newArrivals.length > 0 && (
                <div className="text-white py-3 overflow-hidden" style={{ backgroundColor: "var(--brand-600)" }}>
                    <div className="flex gap-12 animate-[marquee_30s_linear_infinite] whitespace-nowrap" suppressHydrationWarning>
                        {[...newArrivals, ...newArrivals].map((p: any, i: number) => (
                            <Link key={i} href={`/catalog/${p.slug || p.id}`}
                                className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0">
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">NUEVO</span>
                                <span className="text-xs font-bold uppercase tracking-wide">{p.name}</span>
                                {p.wholesalePrice && (
                                    <span className="text-[9px] font-black opacity-80">${p.wholesalePrice}/pz</span>
                                )}
                                <span className="opacity-30">·</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* ── BANNER PROMOCIONAL ── */}
            {(() => {
                const banner = (siteSettings?.data as any)?.banner;
                if (!banner?.enabled || !banner?.text) return null;
                const expires = banner.expires ? new Date(banner.expires) : null;
                if (expires && expires < new Date()) return null;
                return (
                    <div className="w-full" style={{ backgroundColor: banner.bgColor || 'var(--brand-600)' }}>
                        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-3 text-white text-center sm:text-left">
                                {banner.emoji && <span className="text-2xl">{banner.emoji}</span>}
                                <div>
                                    <p className="text-sm font-black uppercase tracking-widest">{banner.text}</p>
                                    {banner.subtext && <p className="text-xs font-medium opacity-80">{banner.subtext}</p>}
                                </div>
                            </div>
                            {banner.ctaUrl && banner.ctaText && (
                                <Link href={banner.ctaUrl}
                                    className="shrink-0 px-5 py-2 bg-white rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg"
                                    style={{ color: banner.bgColor || 'var(--brand-600)' }}>
                                    {banner.ctaText} →
                                </Link>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ── CATEGORÍAS ── */}
            <section className="py-24 max-w-7xl mx-auto px-6 w-full">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
                    <div className="space-y-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "var(--brand-600)" }}>Nuestras Secciones</h3>
                        <h2 className="text-4xl font-black tracking-tight uppercase">EXPLORA POR CATEGORÍA</h2>
                    </div>
                    <Link href="/categories" className="text-sm font-black uppercase tracking-widest border-b-2 pb-1 transition-colors" style={{ borderColor: "var(--brand-600)", color: "var(--brand-600)" }}>
                        Ver todas las categorías
                    </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[...filteredCategories].sort((a: any, b: any) => {
                        const ORDER = ['DAMAS', 'CABALLEROS', 'NIÑOS', 'ACCESORIOS', 'CALZADO'];
                        const ai = ORDER.indexOf(a.name?.toUpperCase());
                        const bi = ORDER.indexOf(b.name?.toUpperCase());
                        if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
                        if (ai === -1) return 1;
                        if (bi === -1) return -1;
                        return ai - bi;
                    }).map((category: any, idx: number) => {
                        const gradients = ['from-rose-500 to-orange-500', 'from-blue-500 to-indigo-500', 'from-emerald-500 to-teal-500', 'from-violet-500 to-purple-500'];
                        return (
                            <Link key={category.id} href={`/catalog?category=${category.slug}`}
                                className="group relative h-56 rounded-3xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-border transition-all hover:scale-[1.02] hover:shadow-2xl">
                                {category.image ? (
                                    <Image src={category.image} alt={category.name} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                                ) : (
                                    <div className={`absolute inset-0 bg-gradient-to-br ${gradients[idx % gradients.length]} opacity-20 group-hover:opacity-40 transition-opacity`} />
                                )}
                                <div className="absolute inset-x-0 bottom-0 p-6 md:p-10 z-10 flex flex-col items-center text-center">
                                    <h4 className="text-xl font-black text-white drop-shadow-lg group-hover:-translate-y-1 transition-transform duration-500 leading-none mb-1 uppercase">{category.name}</h4>
                                    <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">{category._count.products} Productos</span>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* ── ÚLTIMOS MODELOS ── */}
            <section className="py-24 bg-gray-50 dark:bg-gray-900/30 w-full">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
                        <div className="space-y-2">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "var(--brand-600)" }}>Lo más reciente</h3>
                            <h2 className="text-4xl font-black tracking-tight uppercase">NUEVOS MODELOS</h2>
                        </div>
                        <Link href="/catalog" className="px-6 py-3 bg-white dark:bg-gray-800 border border-border rounded-full text-[10px] font-black uppercase tracking-widest hover:shadow-lg transition-all">
                            Ver todo el catálogo
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
                        {products.map((product: any) => (
                            <ProductCard key={`latest-${product.id}`} product={product} user={user} isWholesale={isWholesale} nowMs={nowMs} showPricesWithoutLogin={showPricesWithoutLogin} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── NOVEDADES + MÁS VENDIDOS ── */}
            <section className="py-20 max-w-7xl mx-auto px-6 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    <div className="space-y-10">
                        <div className="flex items-center justify-between border-b pb-6 border-border">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-black tracking-tighter uppercase">Novedades</h2>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lo más reciente en el catálogo</p>
                            </div>
                            <Link href="/catalog?sort=newest" className="px-5 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Ver todo</Link>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {newArrivals.slice(0, 4).map((product: any) => (
                                <ProductCard key={`new-${product.id}`} product={product} user={user} isWholesale={isWholesale} nowMs={nowMs} showPricesWithoutLogin={showPricesWithoutLogin} />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-10">
                        <div className="flex items-center justify-between border-b pb-6 border-border">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-black tracking-tighter uppercase">Más Vendidos</h2>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lo favorito de la comunidad</p>
                            </div>
                            <Link href="/catalog?sort=best_selling" className="px-5 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Explorar</Link>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {bestSellers.map((product: any) => (
                                <ProductCard key={`best-${product.id}`} product={product} user={user} isWholesale={isWholesale} badge="🔥 Hot" nowMs={nowMs} showPricesWithoutLogin={showPricesWithoutLogin} />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── DESTACADOS — Vendedores y Productos ── */}
            {(featured.sellers.length > 0 || featured.products.length > 0) && (
                <section className="py-16 max-w-7xl mx-auto px-6 w-full space-y-12">
                    {featured.sellers.length > 0 && !brand.isSingleVendor && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-500">⭐ Vendedores Destacados</p>
                                    <h2 className="text-3xl font-black tracking-tight uppercase">Fabricantes Verificados</h2>
                                </div>
                                <Link href="/vendors" className="text-xs font-black uppercase tracking-widest hover:underline" style={{ color: "var(--brand-600)" }}>Ver todos →</Link>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {(featured.sellers as any[]).map((seller: any) => (
                                    <Link key={seller.id} href={`/vendor/${seller.sellerSlug || seller.id}`}
                                        className="group p-6 bg-card rounded-3xl border border-border hover:border-amber-300 hover:shadow-xl transition-all hover:-translate-y-1 text-center space-y-3">
                                        <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden border border-border bg-gray-50 flex items-center justify-center">
                                            {seller.logoUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={seller.logoUrl} alt={seller.businessName || seller.name}
                                                    className="w-full h-full object-contain" suppressHydrationWarning />
                                            ) : (
                                                <span className="text-2xl font-black text-gray-400">
                                                    {(seller.businessName || seller.name).charAt(0)}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-black text-sm text-foreground uppercase group-hover:text-amber-600 transition-colors">
                                                {seller.businessName || seller.name}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-bold">{seller._count.ownedProducts} productos</p>
                                        </div>
                                        <span className="inline-block px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-[8px] font-black uppercase tracking-widest rounded-full">
                                            ⭐ Destacado
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                    {featured.products.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "var(--brand-600)" }}>⭐ Productos Destacados</p>
                                    <h2 className="text-3xl font-black tracking-tight uppercase">Selección del Editor</h2>
                                </div>
                                <Link href="/catalog" className="text-xs font-black uppercase tracking-widest hover:underline" style={{ color: "var(--brand-600)" }}>Ver catálogo →</Link>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
                                {(featured.products as any[]).map((product: any) => (
                                    <ProductCard key={`feat-${product.id}`} product={product} user={user} isWholesale={isWholesale} badge="⭐" nowMs={nowMs} showPricesWithoutLogin={showPricesWithoutLogin} />
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* ── BANNER TEMPORADA ── */}
            <section className="py-16 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="relative rounded-[40px] overflow-hidden p-12 md:p-20 text-white" style={{ background: "linear-gradient(to right, var(--brand-600), var(--brand-700))" }}>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="space-y-4 max-w-lg">
                                <p className="text-sm font-black uppercase tracking-[0.3em] opacity-80">Temporada Actual</p>
                                <h2 className="text-5xl font-black tracking-tight">{season.emoji} {season.name}</h2>
                                <p className="text-white/80 font-medium leading-relaxed">
                                    Descubre los modelos más vendidos de esta temporada. Precios de mayoreo, envío rápido a todo México.
                                </p>
                            </div>
                            <Link href="/catalog" className="shrink-0 px-10 py-5 bg-white text-gray-900 rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl">
                                Ver Colección
                            </Link>
                        </div>
                        {/* Decoración */}
                        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/10" />
                        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/5" />
                    </div>
                </div>
            </section>

            <RecentlyViewed />

            {/* ── CTA — oculto en tiendas de un solo vendedor ── */}
            {!brand.isSingleVendor && (
            <section className="py-32 max-w-7xl mx-auto px-6 w-full text-center space-y-12">
                <div className="max-w-3xl mx-auto space-y-6">
                    <h2 className="text-5xl font-black tracking-tight italic uppercase">
                        ¿LISTO PARA ESCALAR TU <span style={{ color: "var(--brand-600)" }}>NEGOCIO?</span>
                    </h2>
                    <p className="text-lg text-gray-500 font-medium leading-relaxed">
                        Ya seas un comprador buscando las mejores tendencias o un fabricante queriendo digitalizar sus ventas mayoristas, {brand.name} es tu aliado.
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-6">
                    <Link href="/register/buyer" className="px-10 py-5 bg-foreground text-background rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl shadow-foreground/20">
                        Crear Cuenta Comprador
                    </Link>
                    <Link href="/register/seller" className="px-10 py-5 bg-white dark:bg-gray-800 border-2 border-border rounded-full text-sm font-black uppercase tracking-widest hover:border-blue-600 transition-all">
                        Registrar mi Tienda
                    </Link>
                </div>
            </section>
            )}
        </div>
        </>
    );
}

import { getVendorProfile, getVendorProducts } from '../actions';
import { getCategories } from '@/app/(marketplace)/actions';
import { getSessionUser } from '@/app/actions/auth';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';

export default async function VendorPage({ 
    params,
    searchParams 
}: { 
    params: { id: string };
    searchParams: { category?: string; sort?: string; subcategory?: string };
}) {
    const resolvedParams = await params;
    const resolvedSearch = await searchParams;
    const vendor = await getVendorProfile(resolvedParams.id);
    if (!vendor) notFound();

    const [products, categories, user] = await Promise.all([
        getVendorProducts(resolvedParams.id, {
            category: resolvedSearch.category,
            subcategory: resolvedSearch.subcategory,
            sort: resolvedSearch.sort,
        }),
        getCategories(),
        getSessionUser(),
    ]);
    const isLoggedIn = !!user;

    const sortOptions = [
        { value: '', label: 'Más Recientes' },
        { value: 'price_asc', label: 'Precio: Menor a Mayor' },
        { value: 'price_desc', label: 'Precio: Mayor a Menor' },
        { value: 'name', label: 'Nombre A-Z' },
    ];

    const memberSince = new Date(vendor.createdAt).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

    return (
        <div className="pt-24 pb-20">
            {/* Vendor Header / Banner */}
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 text-white">
                <div className="max-w-7xl mx-auto px-6 py-16">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
                        <div className="w-24 h-24 rounded-3xl overflow-hidden border border-white/20 shadow-2xl shrink-0">
                            {(vendor as any).logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={(vendor as any).logoUrl}
                                    alt={(vendor as any).businessName || (vendor as any).name}
                                    className="w-full h-full object-contain bg-white"
                                    suppressHydrationWarning
                                />
                            ) : (
                                <div className="w-full h-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-4xl font-black">
                                    {(vendor.businessName || vendor.name).charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 space-y-2">
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                                {(vendor as any).businessName || (vendor as any).name}
                            </h1>
                            {(vendor as any).businessName && (vendor as any).businessName !== (vendor as any).name && (
                                <p className="text-white/60 font-bold text-sm uppercase tracking-widest">{(vendor as any).name}</p>
                            )}
                            <div className="flex flex-wrap gap-4 pt-2">
                                <span className="px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-black uppercase tracking-widest">
                                    📦 {(vendor as any)._count.ownedProducts} Productos
                                </span>
                                <span className="px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-black uppercase tracking-widest">
                                    📅 Miembro desde {memberSince}
                                </span>
                                <span className="px-4 py-1.5 bg-emerald-500/20 backdrop-blur-sm rounded-full text-xs font-black uppercase tracking-widest text-emerald-300">
                                    ✓ Vendedor Verificado
                                </span>
                                {((vendor as any).whatsapp || (vendor as any).phone) && (
                                    <a 
                                        href={`https://wa.me/${((vendor as any).whatsapp || (vendor as any).phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola, vi tu tienda en Moda Zapotlanejo y me interesa conocer más sobre tus productos.`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-1.5 bg-green-500/20 backdrop-blur-sm rounded-full text-xs font-black uppercase tracking-widest text-green-400 hover:bg-green-500 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        📱 WhatsApp
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row gap-12">
                    {/* Sidebar */}
                    <aside className="w-full md:w-64 space-y-8 shrink-0">
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Categorías</h3>
                            <div className="flex flex-col gap-1">
                                <Link 
                                    href={`/vendor/${resolvedParams.id}`}
                                    className={`text-sm font-bold py-2 px-4 rounded-xl transition-all ${!resolvedSearch.category ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
                                >
                                    Todos los productos
                                </Link>
                                {categories.map((cat: any) => (
                                    <Link 
                                        key={cat.id}
                                        href={`/vendor/${resolvedParams.id}?category=${cat.slug}`}
                                        className={`text-sm font-bold py-2 px-4 rounded-xl transition-all ${resolvedSearch.category === cat.slug ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
                                    >
                                        {cat.name}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Ordenar por</h3>
                            <div className="flex flex-col gap-1">
                                {sortOptions.map(opt => (
                                    <Link 
                                        key={opt.value}
                                        href={`/vendor/${resolvedParams.id}?${new URLSearchParams({ ...(resolvedSearch.category ? { category: resolvedSearch.category } : {}), ...(opt.value ? { sort: opt.value } : {}) }).toString()}`}
                                        className={`text-sm font-bold py-2 px-4 rounded-xl transition-all ${(resolvedSearch.sort || '') === opt.value ? 'bg-foreground text-background' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
                                    >
                                        {opt.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </aside>

                    {/* Product Grid */}
                    <div className="flex-1 space-y-8">
                        <div className="flex justify-between items-center border-b border-border pb-6">
                            <h2 className="text-2xl font-black text-foreground">
                                Productos
                                <span className="ml-4 text-sm font-bold text-gray-400 uppercase tracking-widest">{products.length} Resultados</span>
                            </h2>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                            {products.map((product: any) => (
                                <Link key={product.id} href={`/catalog/${product.id}`} className="group space-y-4">
                                    <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-gray-200 dark:bg-gray-800 relative shadow-sm group-hover:shadow-xl transition-all group-hover:-translate-y-2">
                                        {product.images?.[0] ? (
                                            <Image 
                                                src={product.images[0]}
                                                alt={product.name}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">Sin Imagen</div>
                                        )}
                                        <div className="absolute top-4 left-4">
                                            <span className="px-3 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">
                                                {product.brand?.name || 'Genérico'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-sm tracking-tight group-hover:text-blue-600 transition-colors uppercase">{product.name}</h4>
                                        {isLoggedIn ? (
                                            <p className="text-blue-600 font-black text-lg">${product.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                        ) : (
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Inicia sesión para ver precio</p>
                                        )}
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{product.category?.name} • {product.subcategory?.name}</p>
                                        {product.variants?.length > 0 && (
                                            <p className="text-[10px] font-bold text-gray-400">
                                                {Array.from(new Set(product.variants.map((v: any) => v.color).filter(Boolean))).length} colores · {Array.from(new Set(product.variants.map((v: any) => v.size).filter(Boolean))).length} tallas
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            ))}
                            {products.length === 0 && (
                                <div className="col-span-full py-24 text-center space-y-4">
                                    <div className="text-6xl text-gray-200 dark:text-gray-800 font-black tracking-tighter">📦</div>
                                    <p className="font-bold text-gray-500 uppercase tracking-widest text-xs">Este vendedor aún no tiene productos en esta categoría</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

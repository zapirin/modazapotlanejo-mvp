import { getMyWishlist, updateWishlistNotifications } from '@/app/actions/wishlist';
import { getSessionUser } from '@/app/actions/auth';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import WishlistRemoveButton from './WishlistRemoveButton';

export default async function WishlistPage() {
    const user = await getSessionUser();
    if (!user) redirect('/login');

    const items = await getMyWishlist();

    return (
        <div className="pt-24 pb-20">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="space-y-2 mb-12">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground uppercase">❤️ Mi Lista de Deseos</h1>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                        {items.length} producto{items.length !== 1 ? 's' : ''} guardado{items.length !== 1 ? 's' : ''}
                        {" · "}
                        <span className="text-emerald-600">Recibirás avisos si baja el precio o vuelve a haber stock</span>
                    </p>
                </div>

                {items.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <div className="text-8xl">💝</div>
                        <p className="font-bold text-gray-500 uppercase tracking-widest text-xs">Tu lista de deseos está vacía</p>
                        <Link href="/catalog" className="inline-block px-8 py-3 bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
                            Explorar Catálogo
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-12">
                        {items.map((item: any) => {
                            const currentPrice = item.product.price;
                            const lastPrice = item.lastKnownPrice;
                            const priceDropped = lastPrice && currentPrice < lastPrice;
                            const priceDiff = lastPrice ? lastPrice - currentPrice : 0;
                            const currentStock = item.product.variants?.reduce((s: number, v: any) => s + (v.stock || 0), 0) ?? 0;
                            const backInStock = (item.lastKnownStock === 0) && currentStock > 0;

                            return (
                                <div key={item.id} className="group space-y-4 relative">
                                    <WishlistRemoveButton productId={item.productId} />
                                    <Link href={`/catalog/${item.productId}`}>
                                        <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-gray-200 dark:bg-gray-800 relative shadow-sm group-hover:shadow-xl transition-all group-hover:-translate-y-2">
                                            {item.product.images?.[0] ? (
                                                <Image src={item.product.images[0]} alt={item.product.name} fill className="object-cover" suppressHydrationWarning />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">Sin Imagen</div>
                                            )}
                                            <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                                                {backInStock && (
                                                    <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg animate-pulse">
                                                        ✅ Volvió a stock
                                                    </span>
                                                )}
                                                {priceDropped && (
                                                    <span className="px-3 py-1 bg-red-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">
                                                        📉 Bajó -${priceDiff.toFixed(0)}
                                                    </span>
                                                )}
                                                {currentStock === 0 && (
                                                    <span className="px-3 py-1 bg-gray-800/80 text-white rounded-full text-[8px] font-black uppercase tracking-widest">
                                                        Sin stock
                                                    </span>
                                                )}
                                                <span className="px-3 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">
                                                    {item.product.brand?.name || 'Genérico'}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="space-y-1">
                                        <Link href={`/catalog/${item.productId}`}>
                                            <h4 className="font-bold text-sm tracking-tight group-hover:text-blue-600 transition-colors uppercase">{item.product.name}</h4>
                                        </Link>
                                        <div className="flex items-center gap-2">
                                            <p className={`font-black text-lg ${priceDropped ? 'text-red-500' : 'text-blue-600'}`}>
                                                ${currentPrice?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </p>
                                            {priceDropped && (
                                                <p className="text-gray-400 font-bold text-sm line-through">${lastPrice?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                            )}
                                        </div>
                                        {item.product.seller && (
                                            <Link href={`/vendor/${item.product.seller.id}`} className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors">
                                                🏭 {item.product.seller.businessName || item.product.seller.name}
                                            </Link>
                                        )}
                                        {/* Toggles de notificación */}
                                        <form className="pt-2 flex flex-col gap-1.5">
                                            <label className="flex items-center gap-2 cursor-pointer group/n">
                                                <input type="checkbox" defaultChecked={item.notifyOnPriceDown}
                                                    className="w-3.5 h-3.5 accent-blue-600 rounded"
                                                    onChange={async (e) => {
                                                        'use server';
                                                        await updateWishlistNotifications(item.id, { notifyOnPriceDown: e.target.checked });
                                                    }} />
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider group-hover/n:text-blue-500 transition-colors">
                                                    📉 Avisar si baja precio
                                                </span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer group/n">
                                                <input type="checkbox" defaultChecked={item.notifyOnRestock}
                                                    className="w-3.5 h-3.5 accent-blue-600 rounded"
                                                    onChange={async (e) => {
                                                        'use server';
                                                        await updateWishlistNotifications(item.id, { notifyOnRestock: e.target.checked });
                                                    }} />
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider group-hover/n:text-blue-500 transition-colors">
                                                    📦 Avisar si vuelve a haber stock
                                                </span>
                                            </label>
                                        </form>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

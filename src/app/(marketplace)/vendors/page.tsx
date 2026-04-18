import { getVendors } from '../vendor/actions';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Vendedores y Fabricantes — Zapotlanejo',
    description: 'Conoce todos los vendedores y fabricantes de ropa mayoreo registrados. Boutiques, distribuidoras y fabricantes de Zapotlanejo, Jalisco y todo México.',
    keywords: ['vendedores ropa mayoreo', 'fabricantes Zapotlanejo', 'distribuidoras ropa', 'boutiques México', 'mayoristas moda'],
    openGraph: {
        title: 'Vendedores y Fabricantes — Marketplace',
        description: 'Conoce todos los vendedores y fabricantes de ropa mayoreo registrados en el marketplace.',
        type: 'website',
        locale: 'es_MX',
    },
    twitter: { card: 'summary', title: 'Vendedores — Marketplace Mayoreo Zapotlanejo' },
};

export default async function VendorsPage() {
    const vendors = await getVendors();

    return (
        <div className="pt-24 pb-20">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="space-y-2 mb-12">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground uppercase">Vendedores</h1>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{vendors.length} Vendedores verificados en el marketplace</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {vendors.map((vendor: any) => (
                        <Link 
                            key={vendor.id}
                            href={`/vendor/${vendor.sellerSlug || vendor.id}`}
                            className="group p-8 bg-white dark:bg-gray-900 rounded-3xl border border-border hover:border-blue-200 dark:hover:border-blue-900/50 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1"
                        >
                            <div className="flex items-start gap-5">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                                    {vendor.logoUrl && !vendor.logoUrl.startsWith('data:') ? (
                                        <Image src={vendor.logoUrl} alt={vendor.businessName || vendor.name}
                                            width={64} height={64} className="w-full h-full object-contain bg-white" />
                                    ) : vendor.logoUrl?.startsWith('data:') ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={vendor.logoUrl} alt={vendor.businessName || vendor.name}
                                            className="w-full h-full object-contain bg-white" loading="lazy" suppressHydrationWarning />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-2xl font-black text-white">
                                            {(vendor.businessName || vendor.name).charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2 flex-1">
                                    <h3 className="text-lg font-black text-foreground uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                                        {vendor.businessName || vendor.name}
                                    </h3>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500">
                                            📦 {vendor._count.ownedProducts} Productos
                                        </span>
                                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                            ✓ Verificado
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-gray-400 pt-1">
                                        Miembro desde {new Date(vendor.createdAt).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                    {vendors.length === 0 && (
                        <div className="col-span-full py-24 text-center space-y-4">
                            <div className="text-6xl text-gray-200 dark:text-gray-800 font-black">🏭</div>
                            <p className="font-bold text-gray-500 uppercase tracking-widest text-xs">Aún no hay vendedores registrados</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

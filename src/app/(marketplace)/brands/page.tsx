import Link from 'next/link';
import { getBrands } from '../actions';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = getBrandConfig(host);
    const isModa = host.includes('modazapotlanejo');
    const isZona = host.includes('zonadelvestir');

    const title = isModa
        ? 'Marcas de Ropa Mayoreo — Zapotlanejo'
        : isZona
        ? 'Marcas de Moda Mayorista — Zona del Vestir'
        : `Marcas — ${brand.name}`;

    const description = isModa
        ? 'Descubre las mejores marcas de ropa al mayoreo de Zapotlanejo, Jalisco. Jeans, blusas, vestidos y más de fabricantes locales.'
        : isZona
        ? 'Explora las marcas de moda mayorista disponibles en Zona del Vestir. Los mejores fabricantes textiles de México.'
        : `Todas las marcas disponibles en ${brand.name}. Moda de calidad con los mejores precios.`;

    return {
        title,
        description,
        keywords: ['marcas ropa mayoreo', 'fabricantes ropa Zapotlanejo', 'marcas jeans México', brand.name, 'moda mayorista'],
        openGraph: { title: `${title} | ${brand.name}`, description, type: 'website', locale: 'es_MX' },
        twitter: { card: 'summary', title: `${title} | ${brand.name}`, description },
    };
}

export default async function BrandsPage() {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brandConfig = getBrandConfig(host);
    const sellerId = brandConfig.sellerId || undefined;
    const brands = await getBrands(sellerId);

    return (
        <div className="max-w-7xl mx-auto px-6 py-24 min-h-[70vh]">
            <div className="space-y-4 mb-20 text-center">
                <h1 className="text-6xl font-black tracking-tighter uppercase italic">Nuestras Marcas</h1>
                <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs">Fabricantes directos de Zapotlanejo y la región</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {brands.map((brand: any) => (
                    <Link 
                        key={brand.id} 
                        href={`/catalog?brand=${brand.id}`}
                        className="group p-10 rounded-[32px] bg-white dark:bg-gray-950 border border-border flex flex-col items-center justify-center text-center transition-all hover:border-blue-600 hover:shadow-xl hover:-translate-y-1"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-border flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:border-blue-600 transition-all">
                            <span className="text-2xl font-black italic text-foreground group-hover:text-white transition-colors">
                                {brand.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <h4 className="font-black text-lg text-foreground uppercase tracking-tight mb-2">{brand.name}</h4>
                        <div className="px-3 py-1 bg-gray-100 dark:bg-gray-900 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-500">
                            {brand._count.products} Modelos
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

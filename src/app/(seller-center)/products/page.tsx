import React from 'react';
import Link from 'next/link';
import { getInventory } from './new/actions';
import ProductCardButtons from './ProductCardButtons';
import GenerateSKUsButton from './GenerateSKUsButton';

export default async function ProductsPage({ searchParams = {} }: { searchParams?: any }) {
    const products = await getInventory();
    const limitError = (searchParams as any)?.error === 'limit_reached';
    const limitNum = (searchParams as any)?.limit;

    const publishedCount = products.filter(p => p.isOnline || p.isPOS).length;
    const draftCount = products.filter(p => !p.isOnline && !p.isPOS).length;
    const missingSkuCount = products.filter(p => !p.sku).length;

    return (
        <div className="max-w-6xl mx-auto py-8">
            {limitError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
                    <span className="text-red-500 text-xl">🚫</span>
                    <div>
                        <p className="font-black text-red-700">Límite de productos alcanzado</p>
                        <p className="text-sm text-red-600">{limitNum ? `Tu plan permite máximo ${limitNum} productos.` : 'Tu plan no permite crear más productos.'} Contacta al administrador para aumentar tu límite.</p>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mis Productos (Catálogo)</h1>
                    <p className="text-gray-500 mt-1">Gestiona los productos que ven tus clientes mayoristas y minoristas.</p>
                </div>
                <div className="flex items-center gap-3">
                    <GenerateSKUsButton missingCount={missingSkuCount} />
                    <Link href="/products/new" className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-md flex items-center gap-2">
                        <span className="text-xl leading-none">+</span> Crear Nuevo Producto
                    </Link>
                </div>
            </div>

            {/* Pestañas (Tabs) rápidas */}
            <div className="border-b border-gray-200 mb-6 flex gap-6">
                <button className="pb-3 border-b-2 border-blue-600 text-blue-600 font-semibold px-2">Todos ({products.length})</button>
                <button className="pb-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 px-2">Publicados ({publishedCount})</button>
                <button className="pb-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 px-2">Borradores ({draftCount})</button>
            </div>

            {/* Grid de Productos */}
            {products.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <span className="text-5xl mb-4 block">📦</span>
                    <h3 className="text-lg font-bold text-gray-900">Aún no tienes productos</h3>
                    <p className="text-gray-500 mt-2 mb-6">Comienza a agregar tu catálogo para vender en línea y punto de venta.</p>
                    <Link href="/products/new" className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 inline-block">
                        Crear mi primer producto
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => {
                        const isDraft = !product.isOnline && !product.isPOS;
                        const statusClass = isDraft 
                            ? "bg-yellow-100 text-yellow-800" 
                            : "bg-green-100 text-green-700";
                        const statusText = isDraft ? "Borrador" : "Activo";

                        return (
                            <div key={product.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition ${isDraft ? 'opacity-80' : ''}`}>
                                <div className="h-48 bg-gray-100 flex flex-col items-center justify-center text-gray-400 border-b border-gray-100 relative overflow-hidden">
                                    {product.images && product.images.length > 0 ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            suppressHydrationWarning
                                        />
                                    ) : (
                                        <>
                                            <span className="text-4xl mb-2">📸</span>
                                            <span className="text-xs">Sin foto</span>
                                        </>
                                    )}
                                </div>
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-900 line-clamp-1">{product.name}</h3>
                                        <span className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap ml-2 ${statusClass}`}>{statusText}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-4">
                                        {product.sku ? (
                                            <span className="text-xs font-mono font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md tracking-wider">{product.sku}</span>
                                        ) : (
                                            <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">Sin SKU</span>
                                        )}
                                        <span className="text-xs text-gray-400">{product.category?.name || 'General'}</span>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-3 space-y-2 mb-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Menudeo:</span>
                                            <span className="font-bold text-gray-900">${product.price.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className={`${product.wholesalePrice ? 'text-blue-700' : 'text-gray-500'} font-medium`}>
                                                {product.sellByPackage && product.packageSize ? `Corrida (${product.packageSize} pz):` : 'Mayoreo:'}
                                            </span>
                                            <span className={`${product.wholesalePrice ? 'font-bold text-blue-800' : 'text-gray-400 italic text-xs'}`}>
                                                {product.wholesalePrice ? `$${product.wholesalePrice.toFixed(2)}` : 'No configurado'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {isDraft ? (
                                            <Link href={`/products/${product.id}/edit`} className="flex-1 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-center">
                                                Continuar Edición
                                            </Link>
                                        ) : (
                                            <ProductCardButtons productId={product.id} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

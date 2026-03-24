import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCategories } from '../actions';

export default async function CategoriesPage() {
    const categories = await getCategories();

    return (
        <div className="max-w-7xl mx-auto px-6 py-24 min-h-[70vh]">
            <div className="space-y-4 mb-20 text-center animate-in fade-in slide-in-from-top-4 duration-700">
                <h1 className="text-6xl font-black tracking-tighter uppercase italic text-foreground">Categorías</h1>
                <p className="text-blue-600 font-bold uppercase tracking-[0.3em] text-xs">Explora todo nuestro universo de moda</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {categories.map((category: any, idx: number) => {
                    const gradients = [
                        'from-rose-500 to-orange-500',
                        'from-blue-500 to-indigo-500',
                        'from-emerald-500 to-teal-500',
                        'from-violet-500 to-purple-500',
                    ];
                    const gradient = gradients[idx % gradients.length];

                    return (
                        <div 
                            key={category.id}
                            className="space-y-4 animate-in fade-in zoom-in-95 duration-700"
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            <Link 
                                href={`/catalog?category=${category.slug}`}
                                className="group relative h-[350px] rounded-[40px] overflow-hidden bg-gray-100 dark:bg-gray-900 border border-border shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl block"
                            >
                                {category.image ? (
                                    <Image 
                                        src={category.image}
                                        alt={category.name}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-20 group-hover:opacity-40 transition-opacity`}></div>
                                )}

                                <div className="absolute inset-x-0 bottom-0 p-10 z-10">
                                    <h4 className="text-3xl font-black text-white drop-shadow-lg group-hover:-translate-y-2 transition-transform duration-500 leading-none mb-2 uppercase">{category.name}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">{category._count?.products || 0} Productos</span>
                                        <div className="w-4 h-[1px] bg-white"></div>
                                    </div>
                                </div>
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                            </Link>
                            
                            {/* Subcategories */}
                            {category.subcategories?.length > 0 && (
                                <div className="flex flex-wrap gap-2 px-2">
                                    {category.subcategories.map((sub: any) => (
                                        <Link
                                            key={sub.id}
                                            href={`/catalog?category=${category.slug}&subcategory=${sub.slug}`}
                                            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-border rounded-full text-[10px] font-bold text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:hover:border-blue-800 transition-all"
                                        >
                                            {sub.name}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

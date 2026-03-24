"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRecentlyViewed } from '@/lib/RecentlyViewedContext';

export default function RecentlyViewed() {
    const { items } = useRecentlyViewed();

    if (items.length === 0) return null;

    return (
        <section className="py-24 max-w-7xl mx-auto px-6 w-full">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
                <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">Para ti</h3>
                    <h2 className="text-4xl font-black tracking-tight uppercase">VISTO RECIENTEMENTE</h2>
                </div>
            </div>

            <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x">
                {items.map((item) => (
                    <Link 
                        key={item.id} 
                        href={`/catalog/${item.id}`}
                        className="group relative w-48 h-64 shrink-0 rounded-3xl overflow-hidden bg-white dark:bg-gray-800 border border-border snap-start transition-all hover:scale-[1.05] hover:shadow-xl"
                    >
                        {item.image ? (
                            <Image 
                                src={item.image}
                                alt={item.name}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black uppercase tracking-widest text-gray-400">Sin Imagen</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                            <p className="text-white text-[10px] font-black uppercase tracking-tight truncate">{item.name}</p>
                            <p className="text-blue-400 text-xs font-black">${item.price}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}

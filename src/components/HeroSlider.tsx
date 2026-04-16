"use client";

import { useState, useEffect, useCallback } from 'react';

export default function HeroSlider({
    images,
    gradient,
    children,
}: {
    images: string[];
    gradient: string;
    children: React.ReactNode;
}) {
    const [current, setCurrent] = useState(0);
    const [loaded, setLoaded] = useState<Record<number, boolean>>({});

    const total = images.length;

    const next = useCallback(() => {
        setCurrent(prev => (prev + 1) % total);
    }, [total]);

    useEffect(() => {
        if (total <= 1) return;
        const timer = setInterval(next, 5000);
        return () => clearInterval(timer);
    }, [next, total]);

    return (
        <div className="absolute inset-0 z-0">
            {/* Slides */}
            {images.length > 0 ? (
                images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        key={i}
                        src={src}
                        alt=""
                        onLoad={() => setLoaded(prev => ({ ...prev, [i]: true }))}
                        className={`absolute inset-0 w-full h-full object-cover brightness-[0.75] dark:brightness-[0.6] transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0'}`}
                        suppressHydrationWarning
                    />
                ))
            ) : (
                <div className="absolute inset-0" style={{ background: gradient }}>
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #8b5cf6 0%, transparent 40%), radial-gradient(circle at 60% 80%, #ec4899 0%, transparent 35%)' }} />
                </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />

            {/* Dot indicators */}
            {total > 1 && (
                <div className="absolute bottom-28 right-8 z-20 flex items-center gap-2">
                    {images.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrent(i)}
                            className={`rounded-full transition-all duration-300 ${i === current ? 'bg-white w-6 h-2' : 'bg-white/40 w-2 h-2 hover:bg-white/70'}`}
                            aria-label={`Slide ${i + 1}`}
                        />
                    ))}
                </div>
            )}

            {children}
        </div>
    );
}

import React from 'react';

export default function AnnouncementBar({
    enabled,
    text,
    mode,
}: {
    enabled?: boolean;
    text?: string | null;
    mode?: string | null;
}) {
    if (!enabled || !text || !text.trim()) return null;
    const isMarquee = (mode || 'marquee') === 'marquee';

    return (
        <div className="fixed top-0 left-0 right-0 z-[55] bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-700)] text-white text-xs sm:text-sm font-bold tracking-wide shadow-md overflow-hidden h-8 flex items-center">
            {isMarquee ? (
                <div className="announcement-marquee whitespace-nowrap">
                    <span className="px-12">{text}</span>
                    <span className="px-12" aria-hidden="true">{text}</span>
                </div>
            ) : (
                <p className="w-full text-center px-4 truncate">{text}</p>
            )}
        </div>
    );
}

"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface RecentItem {
    id: string;
    name: string;
    price: number;
    image: string;
    category?: string;
}

interface RecentlyViewedContextType {
    items: RecentItem[];
    addItem: (item: RecentItem) => void;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextType>({
    items: [],
    addItem: () => {},
});

export function useRecentlyViewed() {
    return useContext(RecentlyViewedContext);
}

const MAX_ITEMS = 12;
const STORAGE_KEY = 'modazapo_recently_viewed';

export function RecentlyViewedProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<RecentItem[]>([]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setItems(JSON.parse(stored));
        } catch {}
    }, []);

    const addItem = (item: RecentItem) => {
        setItems(prev => {
            const filtered = prev.filter(i => i.id !== item.id);
            const updated = [item, ...filtered].slice(0, MAX_ITEMS);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch {}
            return updated;
        });
    };

    return (
        <RecentlyViewedContext.Provider value={{ items, addItem }}>
            {children}
        </RecentlyViewedContext.Provider>
    );
}

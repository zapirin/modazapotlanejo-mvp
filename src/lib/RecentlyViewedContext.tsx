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
    const [items, setItems] = useState<RecentItem[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const addItem = (item: RecentItem) => {
        setItems(prev => {
            const filtered = prev.filter(i => i.id !== item.id);
            const updated = [item, ...filtered].slice(0, MAX_ITEMS);
            return updated;
        });
    };

    return (
        <RecentlyViewedContext.Provider value={{ items, addItem }}>
            {children}
        </RecentlyViewedContext.Provider>
    );
}

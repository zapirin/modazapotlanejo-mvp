"use server";

import { prisma } from '@/lib/prisma';

export async function getVendorProfile(vendorId: string) {
    try {
        const vendor = await prisma.user.findUnique({
            where: { id: vendorId, role: 'SELLER', isActive: true },
            select: {
                id: true,
                name: true,
                businessName: true,
                createdAt: true,
                logoUrl: true,
                _count: {
                    select: {
                        ownedProducts: { where: { isOnline: true, isActive: true } }
                    }
                }
            }
        });
        return vendor;
    } catch (error) {
        console.error("Error fetching vendor:", error);
        return null;
    }
}

export async function getVendorProducts(vendorId: string, filters?: { 
    category?: string;
    subcategory?: string;
    sort?: string;
}) {
    try {
        const where: any = { sellerId: vendorId, isOnline: true, isActive: true };

        if (filters?.category) {
            where.category = { slug: filters.category };
        }
        if (filters?.subcategory) {
            where.subcategory = { slug: filters.subcategory };
        }

        let orderBy: any = { createdAt: 'desc' };
        if (filters?.sort === 'price_asc') orderBy = { price: 'asc' };
        if (filters?.sort === 'price_desc') orderBy = { price: 'desc' };
        if (filters?.sort === 'name') orderBy = { name: 'asc' };

        return await prisma.product.findMany({
            where,
            orderBy,
            include: {
                brand: true,
                category: true,
                subcategory: true,
                variants: { select: { id: true, color: true, size: true, stock: true } },
            }
        });
    } catch (error) {
        console.error("Error fetching vendor products:", error);
        return [];
    }
}

export async function getVendors() {
    try {
        return await prisma.user.findMany({
            where: { role: 'SELLER', isActive: true },
            select: {
                id: true,
                name: true,
                businessName: true,
                createdAt: true,
                logoUrl: true,
                _count: {
                    select: {
                        ownedProducts: { where: { isOnline: true, isActive: true } }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        console.error("Error fetching vendors:", error);
        return [];
    }
}

import { getSellerCoupons } from '@/app/actions/coupons';
import { getSessionUser } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import CouponsClient from './CouponsClient';
import { prisma } from '@/lib/prisma';

export default async function CouponsPage() {
    const user = await getSessionUser();
    if (!user || !['SELLER', 'ADMIN'].includes(user.role)) redirect('/dashboard');

    const coupons = await getSellerCoupons();
    
    // Fetch products
    const products = await prisma.product.findMany({
        where: { sellerId: user.id },
        select: { id: true, name: true, sku: true },
        orderBy: { name: 'asc' }
    });

    // Fetch categories and subcategories
    const categories = await prisma.category.findMany({
        include: { subcategories: true },
        orderBy: { name: 'asc' }
    });

    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto">
            <CouponsClient 
                initialCoupons={coupons} 
                products={products}
                categories={categories}
            />
        </div>
    );
}

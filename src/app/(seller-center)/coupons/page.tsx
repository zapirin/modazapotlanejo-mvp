import { getSellerCoupons } from '@/app/actions/coupons';
import { getSessionUser } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import CouponsClient from './CouponsClient';

export default async function CouponsPage() {
    const user = await getSessionUser();
    if (!user || !['SELLER', 'ADMIN'].includes(user.role)) redirect('/dashboard');

    const coupons = await getSellerCoupons();

    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto">
            <CouponsClient initialCoupons={coupons} />
        </div>
    );
}

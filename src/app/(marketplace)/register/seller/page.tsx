import { getPlans } from '@/app/actions/marketplace';
import SellerRegistrationForm from './SellerRegistrationForm';
import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import { redirect } from 'next/navigation';

export default async function SellerRegistrationPage() {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = getBrandConfig(host);
    
    // Redirect to home on single-vendor stores (no seller registration allowed)
    if (brand.isSingleVendor) {
        redirect('/');
    }

    const plans = await getPlans();
    return <SellerRegistrationForm plans={plans as any[]} domain={brand.domain} />;
}

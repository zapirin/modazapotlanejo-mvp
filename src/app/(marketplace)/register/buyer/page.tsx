import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import BuyerRegistrationForm from './BuyerRegistrationForm';

export default async function BuyerRegistrationPage() {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = getBrandConfig(host);
    return <BuyerRegistrationForm brandName={brand.name} registeredDomain={brand.isSingleVendor ? brand.domain : undefined} />;
}

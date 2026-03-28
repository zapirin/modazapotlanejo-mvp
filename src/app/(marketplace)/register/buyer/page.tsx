import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import BuyerRegistrationForm from './BuyerRegistrationForm';

export default async function BuyerRegistrationPage() {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    const brand = getBrandConfig(host);
    return <BuyerRegistrationForm brandName={brand.name} />;
}

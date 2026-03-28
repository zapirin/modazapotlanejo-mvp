import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import LoginClient from './LoginClient';

export default async function LoginPage() {
    const headersList = await headers();
    const host = headersList.get('host');
    const brand = getBrandConfig(host);
    return <LoginClient brand={brand} />;
}

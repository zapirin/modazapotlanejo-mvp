import { headers } from 'next/headers';
import { getActiveBrandConfig } from '@/app/(marketplace)/actions';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = await getActiveBrandConfig(host);
    return { title: `${brand.name} — Iniciar Sesión` };
}

export default async function LoginPage() {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = await getActiveBrandConfig(host);

    return <LoginClient brand={brand} />;
}

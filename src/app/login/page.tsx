import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import { getMarketplaceSettings } from '@/app/actions/marketplace';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    const brand = getBrandConfig(host);
    
    // Leer color de marca guardado por el admin (si existe)
    try {
        const settingsRes = await getMarketplaceSettings();
        if (settingsRes.success && settingsRes.data) {
            const brandColors = (settingsRes.data as any).brandColors;
            const savedColor = brandColors?.[brand.domain];
            if (savedColor) brand.primaryColor = savedColor;
        }
    } catch {}

    return <LoginClient brand={brand} />;
}

import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';
import { getMarketplaceSettings } from '@/app/actions/marketplace';
import ForgotPasswordForm from './ForgotPasswordForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = getBrandConfig(host);
    return { title: `${brand.name} — Recuperar Contraseña` };
}

const COLOR_MAP: Record<string, string> = {
    blue: '#2563eb', violet: '#7c3aed', emerald: '#059669',
    amber: '#d97706', rose: '#e11d48', slate: '#475569', kalexa: '#8124E3',
};

export default async function ForgotPasswordPage() {
    const headersList = await headers();
    const host = (headersList.get('host') || '').split(',')[0].trim().replace(/^https?:\/\//, '');
    const brand = getBrandConfig(host);

    try {
        const settingsRes = await getMarketplaceSettings();
        if (settingsRes.success && settingsRes.data) {
            const brandColors = (settingsRes.data as any).brandColors;
            const savedColor = brandColors?.[brand.domain];
            if (savedColor) brand.primaryColor = savedColor;
        }
    } catch {}

    const brandColor = COLOR_MAP[brand.primaryColor] || '#2563eb';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-card rounded-3xl shadow-xl overflow-hidden border border-border">
                <div className="p-8 text-center" style={{ backgroundColor: brandColor }}>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                        {brand.name}
                    </h2>
                    <p className="text-white/80 text-sm font-medium uppercase tracking-wider">Recuperar Contraseña</p>
                </div>
                <div className="p-8">
                    <ForgotPasswordForm />
                </div>
            </div>
        </div>
    );
}

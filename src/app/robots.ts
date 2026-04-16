import { headers } from 'next/headers';
import type { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
    const headersList = await headers();
    const host = (headersList.get('host') || 'modazapotlanejo.com').split(',')[0].trim().replace(/^https?:\/\//, '');
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const siteUrl = `${protocol}://${host}`;

    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/'],
                disallow: [
                    '/dashboard',
                    '/pos',
                    '/inventory',
                    '/products',
                    '/settings',
                    '/admin',
                    '/orders',
                    '/reports',
                    '/api/',
                    '/login',
                    '/acceso',
                    '/coupons',
                    '/cart',
                    '/wishlist',
                ],
            },
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}

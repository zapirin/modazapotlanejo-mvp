import { headers } from 'next/headers';
import { getBrandConfig } from '@/lib/brand';

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
    const headersList = await headers();
    const host = headersList.get('host');
    const brand = getBrandConfig(host);
    
    return (
        <div data-brand={brand.domain} 
             data-brand-name={brand.name}
             data-brand-color={brand.primaryColor}>
            {children}
        </div>
    );
}

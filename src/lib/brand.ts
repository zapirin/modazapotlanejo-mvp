export type BrandConfig = {
    name: string;
    description: string;
    footerDescription: string;
    logo: {
        text: string;
        initial: string;
        url: string;
    };
    domain: string;
};

export const BRANDS: Record<string, BrandConfig> = {
    'modazapotlanejo.com': {
        name: 'Moda Zapotlanejo',
        description: 'El marketplace mayorista líder de Zapotlanejo.',
        footerDescription: 'El marketplace mayorista líder de Zapotlanejo.',
        logo: {
            text: 'MODA ZAPOTLANEJO',
            initial: 'M',
            url: '/logo_modazapo.png'
        },
        domain: 'modazapotlanejo.com'
    },
    'zonadelvestir.com': {
        name: 'Zona del Vestir',
        description: 'Encuentra lo mejor de la capital de la moda en México.',
        footerDescription: 'Líder de la zona del vestir de occidente.',
        logo: {
            text: 'ZONA VESTIR',
            initial: 'Z',
            url: '/logo_zonadelvestir.png'
        },
        domain: 'zonadelvestir.com'
    }
};

export function getBrandConfig(host: string | null): BrandConfig {
    if (!host) return BRANDS['modazapotlanejo.com'];
    
    // Normalize host (remove port and subdomains if necessary)
    const cleanHost = host.split(':')[0].toLowerCase();
    
    if (cleanHost.includes('zonadelvestir')) {
        return BRANDS['zonadelvestir.com'];
    }
    
    // Default to Moda Zapotlanejo
    return BRANDS['modazapotlanejo.com'];
}

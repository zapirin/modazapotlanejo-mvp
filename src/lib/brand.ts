export type BrandConfig = {
    name: string;
    tagline: string;
    description: string;
    footerDescription: string;
    primaryColor: string;
    logo: {
        text: string;
        initial: string;
        url: string;
    };
    domain: string;
    heroImage?: string;
    featuredSellerIds?: string[];
    featuredProductIds?: string[];
    featuredCategories?: string[];
};

export const BRANDS: Record<string, BrandConfig> = {
    'modazapotlanejo.com': {
        name: 'Moda Zapotlanejo',
        tagline: 'Fashion Marketplace',
        description: 'El marketplace mayorista líder de Zapotlanejo.',
        footerDescription: 'El marketplace mayorista líder de Zapotlanejo.',
        primaryColor: 'blue',
        logo: {
            text: 'MODA ZAPOTLANEJO',
            initial: 'M',
            url: '/logo_modazapo.png'
        },
        domain: 'modazapotlanejo.com',
        featuredSellerIds: [],
        featuredProductIds: [],
        featuredCategories: [],
    },
    'zonadelvestir.com': {
        name: 'Zona del Vestir',
        tagline: 'Tu Zona Mayorista',
        description: 'La zona mayorista de moda más grande de México.',
        footerDescription: 'Líder de la zona del vestir de occidente.',
        primaryColor: 'violet',
        logo: {
            text: 'ZONA DEL VESTIR',
            initial: 'Z',
            url: 'https://ynbcslgimrrccqohirzl.supabase.co/storage/v1/object/public/product-images/logo_zonadelvestir.jpg'
        },
        domain: 'zonadelvestir.com',
        featuredSellerIds: [],
        featuredProductIds: [],
        featuredCategories: [],
    }
};

export function getBrandConfig(host: string | null): BrandConfig {
    if (!host) return BRANDS['modazapotlanejo.com'];
    const cleanHost = host.split(':')[0].toLowerCase().replace(/^www\./, '');
    if (cleanHost.includes('zonadelvestir')) return BRANDS['zonadelvestir.com'];
    if (cleanHost.includes('tienda-modazapo') || cleanHost.includes('localhost')) return BRANDS['modazapotlanejo.com'];
    return BRANDS[cleanHost] || BRANDS['modazapotlanejo.com'];
}

// Merge BD data into static brand config
export function mergeBrandWithDB(base: BrandConfig, dbBrand: any): BrandConfig {
    if (!dbBrand) return base;
    return {
        ...base,
        name: dbBrand.name || base.name,
        tagline: dbBrand.tagline || base.tagline,
        description: dbBrand.description || base.description,
        footerDescription: dbBrand.description || base.footerDescription,
        primaryColor: dbBrand.primaryColor || base.primaryColor,
        heroImage: dbBrand.heroImage || base.heroImage,
        featuredSellerIds: dbBrand.featuredSellerIds || base.featuredSellerIds,
        featuredProductIds: dbBrand.featuredProductIds || base.featuredProductIds,
        featuredCategories: dbBrand.featuredCategories || base.featuredCategories,
        logo: {
            ...base.logo,
            url: dbBrand.logoUrl || base.logo.url,
            text: dbBrand.name ? dbBrand.name.toUpperCase() : base.logo.text,
        },
    };
}

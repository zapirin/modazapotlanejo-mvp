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
    heroImages?: string[];
    featuredSellerIds?: string[];
    featuredProductIds?: string[];
    featuredCategories?: string[];
    // Single-vendor store fields
    sellerId?: string;
    isSingleVendor?: boolean;
    excludeCategories?: string[];
    whatsapp?: string;
    socialLinks?: {
        instagram?: string;
        facebook?: string;
        tiktok?: string;
        youtube?: string;
        telegram?: string;
        twitter?: string;
    };
    storeInfo?: {
        address?: string;
        schedule?: string;
        since?: string;
    };
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
            url: '/logo_zonadelvestir.png'
        },
        domain: 'zonadelvestir.com',
        featuredSellerIds: [],
        featuredProductIds: [],
        featuredCategories: [],
    },
    'kalexafashion.com': {
        name: 'Kalexa Fashion',
        tagline: 'Moda que te define',
        description: 'Jeans de moda, blusas y mucho más. Tienda en línea oficial de Kalexa Fashion desde Zapotlanejo.',
        footerDescription: 'Tu destino de moda desde 1996. Envíos a todo México.',
        primaryColor: 'kalexa',
        logo: {
            text: 'KALEXA FASHION',
            initial: 'K',
            url: '/logo_kalexa.png'
        },
        domain: 'kalexafashion.com',
        heroImage: '/kalexa_hero.png',
        sellerId: 'cmn9kxcdu0001lh04fjib51wi',
        isSingleVendor: true,
        excludeCategories: ['Accesorios', 'Calzado'],
        whatsapp: '523339242571',
        socialLinks: {
            instagram: 'https://instagram.com/kalexafashion',
            facebook: 'https://facebook.com/kalexafashion',
            tiktok: 'https://tiktok.com/@kalexafashion',
            youtube: 'https://youtube.com/c/KalexafashionZapotlanejo',
            telegram: 'https://t.me/Kalexafashion',
            twitter: 'https://twitter.com/kalexafashion',
        },
        storeInfo: {
            address: 'Guadalupe Victoria 101, Zapotlanejo, Jalisco',
            schedule: 'Lun-Sáb 9:00am - 7:00pm · Dom 9:00am - 4:00pm',
            since: '1996',
        },
        featuredSellerIds: [],
        featuredProductIds: [],
        featuredCategories: [],
    }
};

export function getBrandConfig(host: string | null): BrandConfig {
    if (!host) return BRANDS['modazapotlanejo.com'];
    const cleanHost = host.split(':')[0].toLowerCase().replace(/^www\./, '');
    if (cleanHost.includes('kalexa')) return BRANDS['kalexafashion.com'];
    if (cleanHost.includes('kalexa.modazapotlanejo')) return BRANDS['kalexafashion.com'];
    if (cleanHost.includes('zonadelvestir')) return BRANDS['zonadelvestir.com'];
    if (cleanHost.includes('tienda-modazapo')) return BRANDS['modazapotlanejo.com'];
    if (cleanHost.includes('localhost')) return BRANDS['kalexafashion.com'];
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

export type BlockType = 'heroSlider' | 'featuredCategories' | 'bestSellers' | 'newArrivals' | 'banner';

export interface BaseBlock {
    id: string;
    type: BlockType;
}

export interface HeroSliderBlock extends BaseBlock {
    type: 'heroSlider';
    images: string[];
    title?: string;
    subtitle?: string;
    description?: string;
    badgeText?: string;
    ctaText?: string;
    ctaLink?: string;
    align?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'center' | 'bottom';
    textSize?: 'normal' | 'compact';
}

export interface FeaturedCategoriesBlock extends BaseBlock {
    type: 'featuredCategories';
    title?: string;
}

export interface BestSellersBlock extends BaseBlock {
    type: 'bestSellers';
    title?: string;
}

export interface NewArrivalsBlock extends BaseBlock {
    type: 'newArrivals';
    title?: string;
}

export interface BannerBlock extends BaseBlock {
    type: 'banner';
    imageUrl: string;
    linkUrl?: string;
    altText?: string;
}

export type LandingBlock = 
    | HeroSliderBlock 
    | FeaturedCategoriesBlock 
    | BestSellersBlock 
    | NewArrivalsBlock 
    | BannerBlock;

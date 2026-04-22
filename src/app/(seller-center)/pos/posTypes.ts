export interface POSVariant {
    id: string;
    productId: string;
    size?: string;
    color?: string;
    price?: number;
    attributes?: Record<string, unknown>;
    product?: POSProduct;
}

export interface POSProduct {
    id: string;
    name: string;
    price: number;
    images?: string[];
    variants: POSVariant[];
}

export interface POSCartItem {
    productId: string;
    variantId: string;
    name: string;
    price: number;
    quantity: number;
    discount: number;
    image?: string | null;
}

export interface POSCategory {
    id: string;
    name: string;
}

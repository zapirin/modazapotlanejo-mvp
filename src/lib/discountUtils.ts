// Utilidades de cálculo de descuentos — no es un Server Action
// Se puede importar tanto en cliente como en servidor

export interface DiscountTier {
    id?: string;
    name?: string;
    autoApplyMarketplace?: boolean | null;
    minQuantity?: number | null;
    discountPercentage?: number | null;
    defaultPriceMinusFixed?: number | null;
}

export function calculateAutoDiscount(
    tiers: DiscountTier[],
    totalQuantity: number,
    subtotal: number
): { tier: DiscountTier; discount: number; finalTotal: number; originalTotal: number } | null {
    if (!tiers || tiers.length === 0 || totalQuantity === 0) return null;

    const eligible = tiers
        .filter(t => {
            // Compatibilidad: si autoApplyMarketplace es null/undefined
            // (niveles creados antes del campo), lo tratamos como false
            if (t.autoApplyMarketplace !== true) return false;
            const min = t.minQuantity ?? 0;
            return min === 0 || totalQuantity >= min;
        })
        .sort((a: DiscountTier, b: DiscountTier) => {
            // El nivel con minQuantity más alto que se cumpla gana
            return (b.minQuantity ?? 0) - (a.minQuantity ?? 0);
        });

    if (eligible.length === 0) return null;

    const tier = eligible[0];
    let discount = 0;

    if (tier.discountPercentage) {
        discount = subtotal * (tier.discountPercentage / 100);
    } else if (tier.defaultPriceMinusFixed) {
        discount = tier.defaultPriceMinusFixed * totalQuantity;
    }

    return {
        tier,
        discount: Math.min(discount, subtotal),
        finalTotal: Math.max(0, subtotal - discount),
        originalTotal: subtotal,
    };
}

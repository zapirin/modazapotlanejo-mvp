// Todo el dinero del proyecto es Float (Sale.total, LayawayPayment.amount,
// Product.cost). Eso obliga a dos cuidados, y este archivo es el único lugar
// donde viven.

/// Redondea a 2 decimales. TODO valor monetario pasa por aquí antes de
/// escribirse a la base.
export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/// Medio centavo: la tolerancia para comparar contra cero. Nunca compares un
/// saldo con `=== 0`: 1000 - 333.33 - 333.33 - 333.34 no da cero exacto, y una
/// nota así no se marcaría como pagada jamás. Usa `saldo <= CENTAVO`.
export const CENTAVO = 0.005;

import { getSessionUser } from "@/app/actions/auth";

// Vive aquí y no en `entries/actions.ts` porque ese archivo es "use server":
// exportar ahí una función async la convierte en un endpoint HTTP público
// que devuelve el `sellerId` — una fuga de seguridad real.

// Quién puede tocar entradas y sobre qué sucursales.
// SELLER: todas las suyas (allowedLocationIds = null significa "sin restricción").
// CASHIER: solo si tiene el permiso, y solo sus sucursales asignadas.
export async function resolveEntryAccess(): Promise<any> {
    const user: any = await getSessionUser();
    if (!user) return { error: 'No autorizado.' };
    if (user.role === 'SELLER') {
        return { user, sellerId: user.id, allowedLocationIds: null };
    }
    if (user.role === 'CASHIER' && user.canRegisterStockEntry) {
        if (!user.managedBySellerId) return { error: 'No autorizado.' };
        return {
            user,
            sellerId: user.managedBySellerId,
            allowedLocationIds: user.allowedLocationIds || [],
        };
    }
    return { error: 'No autorizado.' };
}

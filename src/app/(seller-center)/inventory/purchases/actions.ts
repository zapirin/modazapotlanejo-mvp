"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resolveEntryAccess } from "@/lib/sellerAccess";
import { round2, CENTAVO } from "@/lib/money";
import { createProduct } from "@/app/(seller-center)/products/new/actions";
import { getSessionUser } from "@/app/actions/auth";

// Prefijo para distinguir errores de negocio (mensaje seguro para el usuario)
// de errores internos/de Prisma que no deben mostrarse tal cual.
const ERROR_USUARIO = 'ERR_USR: ';

// Techos duros. La transacción de una nota grande no puede ser infinita: 15
// productos x 8 variantes ya son 120 renglones de inventario.
const MAX_PRODUCTOS_POR_NOTA = 60;
const MAX_RENGLONES_POR_NOTA = 300;
const MAX_VARIANTES_PRODUCTO_NUEVO = 100;

// Plazo típico del dueño para lo que queda a deber, si no se captura otro.
const PLAZO_POR_OMISION = 30;

// Techo del dinero por pieza: arriba de esto es un dedazo, no una compra.
const MAX_COSTO_UNITARIO = 1000000;

// Copiados a propósito de `inventory/entries/actions.ts`: ese archivo es
// "use server" y exportar ahí un helper lo volvería un endpoint HTTP público.

// Mismo criterio de nombre de variante que usa la pantalla de inventario.
function formatVariantLabel(variant: any): string {
    if (variant?.attributes && typeof variant.attributes === 'object') {
        const parts = Object.values(variant.attributes as Record<string, any>);
        if (parts.length > 0) return parts.join(' / ');
    }
    if (variant?.color && variant?.size) return `${variant.color} / ${variant.size}`;
    if (variant?.color) return variant.color;
    if (variant?.size) return variant.size;
    return 'Única';
}

// Ordena las variantes según el orden en que el vendedor definió los valores en
// `variantOptions` (1, 3, 5, 7… / CH, MED, GDE…), no alfabéticamente.
function sortVariantsByOptions(variants: any[], variantOptions: any): any[] {
    const opts: any[] = Array.isArray(variantOptions) ? variantOptions : [];
    if (opts.length === 0) return variants;
    const sortKey = (v: any) => opts.map((opt: any) => {
        const val = v.attributes?.[opt.name]
            ?? (opt.name === 'Color' ? v.color : (opt.name === 'Talla' || opt.name === 'Tamaño') ? v.size : '');
        const idx = (opt.values as string[]).indexOf(val);
        return idx >= 0 ? String(idx).padStart(4, '0') : '9999';
    }).join('-');
    return variants.slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

function folioText(folio: number): string {
    return `C-${String(folio).padStart(6, '0')}`;
}

// Genera las combinaciones de variantes igual que la pantalla de alta de
// producto (`products/new/page.tsx`), en el mismo orden de opciones.
function generateCombinations(options: { name: string; values: string[] }[]): Record<string, string>[] {
    if (options.length === 0) return [];
    let combinations: Record<string, string>[] = [{}];
    for (const option of options) {
        const next: Record<string, string>[] = [];
        for (const combo of combinations) {
            for (const value of option.values) {
                next.push({ ...combo, [option.name]: value });
            }
        }
        combinations = next;
    }
    return combinations.filter(c => Object.keys(c).length === options.length);
}

// Firma estable de una combinación: los valores en el orden de las opciones.
// Evita depender del orden de las llaves del JSON, que ni el navegador ni la
// base garantizan.
function comboSignature(attributes: any, options: { name: string; values: string[] }[]): string {
    const attrs = (attributes && typeof attributes === 'object') ? attributes : {};
    return options.map(o => String(attrs[o.name] ?? '')).join(' ||| ');
}

export async function getPurchaseFormData() {
    const access: any = await resolveEntryAccess();
    if (access.error) {
        return { error: access.error, suppliers: [], locations: [], paymentMethods: [] };
    }

    const locationWhere: any = { sellerId: access.sellerId };
    if (access.allowedLocationIds) locationWhere.id = { in: access.allowedLocationIds };

    const [suppliers, locations, paymentMethods] = await Promise.all([
        (prisma as any).supplier.findMany({
            where: { sellerId: access.sellerId, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
        prisma.storeLocation.findMany({
            where: locationWhere,
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
        prisma.paymentMethod.findMany({
            // Los métodos globales (sellerId: null, el Efectivo universal) los
            // usan todos los vendedores, así que aquí también se ofrecen. Ojo:
            // la pantalla de clientes NO los incluye; no es una inconsistencia
            // que haya que "arreglar" allá, es otra decisión.
            where: { isActive: true, OR: [{ sellerId: access.sellerId }, { sellerId: null }] },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    return { suppliers, locations, paymentMethods };
}

// La búsqueda es SIEMPRE dentro de un proveedor: se ofrecen sus modelos y los
// que todavía no tienen proveedor (esos se le asignan al guardar la nota). Los
// modelos de OTRO proveedor no se ofrecen: es decisión del dueño.
export async function searchProductsForPurchase(query: string, supplierId: string) {
    const vacio = { delProveedor: [] as any[], sinProveedor: [] as any[] };

    const access: any = await resolveEntryAccess();
    if (access.error) return vacio;
    const q = (query || '').trim();
    if (q.length < 2) return vacio;

    // Un id vacío desaparecería del WHERE (Prisma descarta `undefined`) y la
    // búsqueda devolvería el catálogo de cualquier proveedor.
    if (!supplierId) return vacio;
    const supplier: any = await (prisma as any).supplier.findFirst({
        where: { id: supplierId, sellerId: access.sellerId },
        select: { id: true },
    });
    if (!supplier) return vacio;

    const base = {
        sellerId: access.sellerId,
        isActive: true,
        OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { sku: { contains: q, mode: 'insensitive' as const } },
        ],
    };
    const seleccion = { id: true, name: true, sku: true, images: true };
    const orden = { name: 'asc' as const };

    const [delProveedor, sinProveedor] = await Promise.all([
        prisma.product.findMany({
            where: { ...base, supplierId: supplier.id },
            select: seleccion,
            orderBy: orden,
            take: 20,
        }),
        prisma.product.findMany({
            where: { ...base, supplierId: null },
            select: seleccion,
            orderBy: orden,
            take: 20,
        }),
    ]);

    const mapear = (p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: p.images?.[0] || null,
    });

    return {
        delProveedor: delProveedor.map(mapear),
        sinProveedor: sinProveedor.map(mapear),
    };
}

export async function getProductVariantsForPurchase(productId: string, locationId: string) {
    const access: any = await resolveEntryAccess();
    if (access.error) return null;

    const location = await prisma.storeLocation.findFirst({
        where: { id: locationId, sellerId: access.sellerId },
        select: { id: true },
    });
    if (!location) return null;
    if (access.allowedLocationIds && !access.allowedLocationIds.includes(locationId)) return null;

    const product: any = await prisma.product.findFirst({
        // isActive: un modelo en la Papelera no recibe mercancía.
        where: { id: productId, sellerId: access.sellerId, isActive: true },
        select: {
            id: true,
            name: true,
            price: true,
            cost: true,
            variantOptions: true,
            variants: {
                select: {
                    id: true,
                    color: true,
                    size: true,
                    attributes: true,
                    inventoryLevels: {
                        where: { locationId },
                        select: { stock: true },
                    },
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    if (!product) return null;

    return {
        id: product.id,
        name: product.name,
        currentPrice: product.price ?? 0,
        currentCost: product.cost ?? null,
        variants: sortVariantsByOptions(product.variants, product.variantOptions).map((v: any) => ({
            id: v.id,
            label: formatVariantLabel(v),
            currentStock: v.inventoryLevels?.[0]?.stock ?? 0,
        })),
    };
}

export async function createPurchaseNote(input: {
    supplierId: string;
    locationId: string;
    noteDate: string;
    invoiceNumber?: string;
    notes?: string;
    creditDays?: number;
    initialPayment?: { amount: number; paymentMethodId?: string };
    lines: {
        productId?: string;
        newProduct?: { name: string; variantOptions: { name: string; values: string[] }[] };
        unitCost: number;
        salePrice?: number;
        quantities: { variantKey: string; quantity: number }[];
    }[];
}) {
    // Productos dados de alta fuera de la transacción: si la transacción falla,
    // hay que borrarlos (compensación). El sellerId se guarda aparte porque la
    // limpieza vive en el `catch`, fuera del alcance de `access`.
    const createdProductIds: string[] = [];
    let sellerIdDeLaNota: string | null = null;

    try {
        const access: any = await resolveEntryAccess();
        if (access.error) return { success: false, error: access.error };
        sellerIdDeLaNota = access.sellerId;

        // ── 1. Validar TODO antes de crear nada ────────────────────────────
        const lines = input.lines || [];
        if (lines.length === 0) {
            return { success: false, error: 'Agrega al menos un producto a la nota.' };
        }
        if (lines.length > MAX_PRODUCTOS_POR_NOTA) {
            return { success: false, error: `Una nota no puede tener más de ${MAX_PRODUCTOS_POR_NOTA} productos. Divídela en dos notas.` };
        }

        // Prisma DESCARTA las claves `undefined`: con un id vacío, la condición
        // `id` desaparece del WHERE y `findFirst` devolvería el primer proveedor
        // del vendedor. La nota quedaría cargada a quien nadie eligió.
        if (!input.supplierId) return { success: false, error: 'Elige un proveedor.' };
        if (!input.locationId) return { success: false, error: 'Elige la sucursal donde entró la mercancía.' };

        const supplier: any = await (prisma as any).supplier.findFirst({
            where: { id: input.supplierId, sellerId: access.sellerId },
            select: { id: true, name: true, isActive: true },
        });
        if (!supplier) return { success: false, error: 'Proveedor no válido.' };
        if (!supplier.isActive) {
            return { success: false, error: 'Ese proveedor está desactivado. Actívalo antes de registrarle una compra.' };
        }

        const location = await prisma.storeLocation.findFirst({
            where: { id: input.locationId, sellerId: access.sellerId },
            select: { id: true },
        });
        if (!location) return { success: false, error: 'Sucursal no válida.' };
        if (access.allowedLocationIds && !access.allowedLocationIds.includes(input.locationId)) {
            return { success: false, error: 'No tienes acceso a esa sucursal.' };
        }

        const fecha = (input.noteDate || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return { success: false, error: 'La fecha de la nota no es válida.' };
        }
        const [anio, mes, dia] = fecha.split('-').map(Number);
        // Mediodía local: guardar a las 00:00 puede correrse un día al
        // convertirse a UTC y la nota aparecería con la fecha de ayer.
        const noteDate = new Date(anio, mes - 1, dia, 12, 0, 0, 0);
        if (isNaN(noteDate.getTime()) || noteDate.getMonth() !== mes - 1 || noteDate.getDate() !== dia) {
            return { success: false, error: 'La fecha de la nota no es válida.' };
        }
        // Un dedazo de año (2062) crearía una deuda cuyo vencimiento cae fuera de
        // toda caja de antigüedad: nunca se vería como vencida.
        const topeFuturo = new Date();
        topeFuturo.setDate(topeFuturo.getDate() + 7);
        topeFuturo.setHours(23, 59, 59, 999);
        if (noteDate.getTime() > topeFuturo.getTime()) {
            return { success: false, error: 'La fecha de la nota está muy adelantada. Revisa el año que capturaste.' };
        }

        let creditDays: number | null = null;
        if (input.creditDays !== undefined && input.creditDays !== null) {
            const dias = Number(input.creditDays);
            if (!Number.isInteger(dias) || dias > 365) {
                return { success: false, error: 'El plazo debe ser un número entero de días, máximo 365.' };
            }
            // Un plazo de 0 no significa nada: o se captura un plazo real, o no
            // se captura y entra el de omisión.
            if (dias < 1) {
                return { success: false, error: 'El plazo debe ser de al menos 1 día.' };
            }
            creditDays = dias;
        }

        // Validación renglón por renglón (sin tocar la base todavía).
        type LineaValidada = {
            index: number;
            productId?: string;
            newProduct?: { name: string; variantOptions: { name: string; values: string[] }[] };
            unitCost: number;
            salePrice: number | null;
            quantities: { variantKey: string; quantity: number }[];
        };
        const validadas: LineaValidada[] = [];
        let totalRenglones = 0;

        for (let i = 0; i < lines.length; i++) {
            const linea = lines[i];
            const tieneExistente = !!linea.productId;
            const tieneNuevo = !!linea.newProduct;
            if (tieneExistente === tieneNuevo) {
                return { success: false, error: `En el renglón ${i + 1} elige un producto existente o captura uno nuevo, pero no ambos.` };
            }

            const unitCost = Number(linea.unitCost);
            if (!Number.isFinite(unitCost) || unitCost < 0) {
                return { success: false, error: `El costo del renglón ${i + 1} no es válido.` };
            }
            if (unitCost > MAX_COSTO_UNITARIO) {
                return { success: false, error: `El costo del renglón ${i + 1} es demasiado alto. Revisa lo que capturaste.` };
            }

            let salePrice: number | null = null;
            if (linea.salePrice !== undefined && linea.salePrice !== null && String(linea.salePrice) !== '') {
                const precio = Number(linea.salePrice);
                if (!Number.isFinite(precio) || precio < 0 || precio > MAX_COSTO_UNITARIO) {
                    return { success: false, error: `El precio de venta del renglón ${i + 1} no es válido.` };
                }
                salePrice = round2(precio);
            }

            const cantidades = (linea.quantities || [])
                .map(q => ({ variantKey: String(q.variantKey || ''), quantity: Number(q.quantity) }))
                .filter(q => q.quantity !== 0);

            if (cantidades.length === 0) {
                return { success: false, error: `Captura al menos una cantidad mayor que cero en el renglón ${i + 1}.` };
            }
            if (cantidades.some(q => !Number.isInteger(q.quantity) || q.quantity < 0)) {
                return { success: false, error: `Las cantidades del renglón ${i + 1} deben ser números enteros.` };
            }
            if (cantidades.some(q => q.quantity > 100000)) {
                return { success: false, error: `Alguna cantidad del renglón ${i + 1} es demasiado grande. Revisa lo que capturaste.` };
            }
            if (cantidades.some(q => !q.variantKey)) {
                return { success: false, error: `Falta identificar una variante en el renglón ${i + 1}.` };
            }
            if (new Set(cantidades.map(q => q.variantKey)).size !== cantidades.length) {
                return { success: false, error: `Hay una variante repetida en el renglón ${i + 1}.` };
            }

            if (tieneNuevo) {
                const nombre = (linea.newProduct!.name || '').trim();
                if (!nombre) {
                    return { success: false, error: `Falta el nombre del producto nuevo del renglón ${i + 1}.` };
                }
                const opciones = linea.newProduct!.variantOptions || [];
                if (!Array.isArray(opciones) || opciones.length === 0) {
                    return { success: false, error: `Captura las tallas o colores del producto nuevo "${nombre}".` };
                }
                if (opciones.some(o => !o?.name?.trim() || !Array.isArray(o?.values) || o.values.length === 0)) {
                    return { success: false, error: `Las tallas o colores del producto nuevo "${nombre}" están incompletos.` };
                }
                // Sin precio, el modelo nacería vendible en el punto de venta al
                // precio de costo (createProduct deja isPOS en true).
                if (!(salePrice !== null && salePrice > 0)) {
                    return { success: false, error: `Falta el precio de venta de "${nombre}". Un producto nuevo no puede quedar sin precio.` };
                }
                const combos = generateCombinations(opciones);
                if (combos.length === 0) {
                    return { success: false, error: `El producto nuevo "${nombre}" no genera ninguna variante.` };
                }
                if (combos.length > MAX_VARIANTES_PRODUCTO_NUEVO) {
                    return { success: false, error: `El producto nuevo "${nombre}" genera demasiadas combinaciones. Reduce las tallas o los colores.` };
                }
            }

            totalRenglones += cantidades.length;
            validadas.push({
                index: i,
                productId: linea.productId,
                newProduct: linea.newProduct,
                unitCost: round2(unitCost),
                salePrice,
                quantities: cantidades,
            });
        }

        if (totalRenglones > MAX_RENGLONES_POR_NOTA) {
            return { success: false, error: `La nota tiene demasiados renglones (${totalRenglones}). El máximo es ${MAX_RENGLONES_POR_NOTA}: divídela en dos notas.` };
        }

        // I6: el total lo calcula el servidor. Lo que mande el navegador se ignora.
        const total = round2(validadas.reduce((suma, l) => {
            return suma + l.quantities.reduce((s, q) => s + round2(q.quantity * l.unitCost), 0);
        }, 0));

        // I7: el abono inicial no puede exceder el total.
        let abono = 0;
        let paymentMethodId: string | null = null;
        if (input.initialPayment && input.initialPayment.amount !== undefined && input.initialPayment.amount !== null) {
            const monto = Number(input.initialPayment.amount);
            if (!Number.isFinite(monto) || monto < 0) {
                return { success: false, error: 'El abono no es válido.' };
            }
            if (monto > total + CENTAVO) {
                return { success: false, error: 'El abono no puede ser mayor que el total de la nota.' };
            }
            // Con el techo anterior, el mínimo garantiza paidAmount <= total.
            abono = Math.min(round2(monto), total);

            if (abono > 0 && input.initialPayment.paymentMethodId) {
                const metodo = await prisma.paymentMethod.findFirst({
                    // Mismo filtro que getPurchaseFormData: si se ofrece en la
                    // lista, se tiene que poder guardar.
                    where: {
                        id: input.initialPayment.paymentMethodId,
                        isActive: true,
                        OR: [{ sellerId: access.sellerId }, { sellerId: null }],
                    },
                    select: { id: true },
                });
                if (!metodo) return { success: false, error: 'Forma de pago no válida.' };
                paymentMethodId = metodo.id;
            }
        }

        // Productos existentes: que sean del vendedor, estén fuera de la Papelera
        // y sean de este proveedor o de ninguno. La regla de que no se compre un
        // modelo de OTRO proveedor la decidió el dueño, así que vive aquí y no
        // solo en el buscador de la pantalla: un cliente manipulado podría
        // mandar el id de un modelo del proveedor B en una nota del A y le
        // reescribiría el costo y el precio con los de esta remesa. Si alguno no
        // pasa, faltará en el resultado y lo rechaza la comparación de abajo.
        const idsExistentes = Array.from(new Set(validadas.filter(l => l.productId).map(l => l.productId as string)));
        const productosExistentes = new Map<string, any>();
        if (idsExistentes.length > 0) {
            const encontrados: any[] = await prisma.product.findMany({
                where: {
                    id: { in: idsExistentes },
                    sellerId: access.sellerId,
                    isActive: true,
                    OR: [{ supplierId: supplier.id }, { supplierId: null }],
                },
                // supplierId: para asignarle este proveedor a los modelos que
                // todavía no tienen ninguno (los que ya tienen NO se tocan).
                select: { id: true, name: true, supplierId: true },
            });
            for (const p of encontrados) productosExistentes.set(p.id, p);
            if (encontrados.length !== idsExistentes.length) {
                return { success: false, error: 'Algún producto de la nota ya no está disponible o no es tuyo. Vuelve a buscarlo.' };
            }
        }

        // I2 (el invariante de seguridad más importante): toda variante debe
        // pertenecer a un producto del MISMO vendedor. Sin esto se inyecta
        // stock en el catálogo de otra tienda.
        const idsVariantes = Array.from(new Set(
            validadas.filter(l => l.productId).flatMap(l => l.quantities.map(q => q.variantKey))
        ));
        const variantesPorId = new Map<string, any>();
        if (idsVariantes.length > 0) {
            const variantes: any[] = await prisma.variant.findMany({
                where: { id: { in: idsVariantes }, product: { sellerId: access.sellerId } },
                select: { id: true, productId: true, color: true, size: true, attributes: true },
            });
            if (variantes.length !== idsVariantes.length) {
                return { success: false, error: 'Alguna talla o color de la nota no es válido. Vuelve a capturar el renglón.' };
            }
            for (const v of variantes) variantesPorId.set(v.id, v);

            for (const l of validadas) {
                if (!l.productId) continue;
                if (l.quantities.some(q => variantesPorId.get(q.variantKey)?.productId !== l.productId)) {
                    return { success: false, error: `Alguna talla o color del renglón ${l.index + 1} no pertenece a ese producto.` };
                }
            }
        }

        // ── 2. Crear los productos nuevos FUERA de la transacción ──────────
        // `createProduct` genera slugs, valida el límite del plan y no es
        // consciente de transacciones.
        const resueltos: {
            index: number;
            productId: string;
            productName: string;
            unitCost: number;
            salePrice: number | null;
            items: { variantId: string; variantInfo: string; quantity: number }[];
        }[] = [];

        for (const l of validadas) {
            if (l.productId) {
                resueltos.push({
                    index: l.index,
                    productId: l.productId,
                    productName: productosExistentes.get(l.productId).name,
                    unitCost: l.unitCost,
                    salePrice: l.salePrice,
                    items: l.quantities.map(q => ({
                        variantId: q.variantKey,
                        variantInfo: formatVariantLabel(variantesPorId.get(q.variantKey)),
                        quantity: q.quantity,
                    })),
                });
                continue;
            }

            const nombre = l.newProduct!.name.trim();
            const opciones = l.newProduct!.variantOptions;
            const combos = generateCombinations(opciones);

            // Las cantidades del producto nuevo vienen por combinación, con la
            // misma llave que genera la pantalla de alta: JSON de los atributos.
            const cantidadPorFirma = new Map<string, number>();
            for (const q of l.quantities) {
                let atributos: any;
                try {
                    atributos = JSON.parse(q.variantKey);
                } catch {
                    atributos = null;
                }
                if (!atributos || typeof atributos !== 'object') {
                    throw new Error(ERROR_USUARIO + `No se entendió una talla o color del producto nuevo "${nombre}".`);
                }
                const firma = comboSignature(atributos, opciones);
                if (cantidadPorFirma.has(firma)) {
                    throw new Error(ERROR_USUARIO + `Hay una talla o color repetido en el producto nuevo "${nombre}".`);
                }
                cantidadPorFirma.set(firma, q.quantity);
            }
            const firmasValidas = new Set(combos.map(c => comboSignature(c, opciones)));
            for (const firma of cantidadPorFirma.keys()) {
                if (!firmasValidas.has(firma)) {
                    throw new Error(ERROR_USUARIO + `Una talla o color capturado no existe en el producto nuevo "${nombre}".`);
                }
            }

            // El precio de venta es obligatorio para un producto nuevo (validado
            // arriba): nunca se vende al costo por omisión.
            const creado: any = await createProduct({
                name: nombre,
                description: "",
                supplierId: supplier.id,
                basePrice: String(l.salePrice),
                cost: String(l.unitCost),
                isOnline: false,
                images: [],
                variantOptions: opciones,
                variantsData: combos.map(c => ({ attributes: c, stock: 0 })),
            });
            if (!creado?.success || !creado?.productId) {
                console.error(`Error al dar de alta el producto nuevo "${nombre}" desde una compra:`, creado?.error);
                // El motivo real se le dice al dueño (puede ser "llegaste al
                // límite de productos de tu plan", y renombrar no lo arregla).
                // La única excepción es el mensaje crudo de la base
                // ("Error de base de datos: ..."), que no se muestra tal cual.
                const detalle = (creado?.error && !creado.error.startsWith('Error de base de datos:'))
                    ? creado.error
                    : 'Revisa que el nombre no esté repetido en tu catálogo.';
                throw new Error(ERROR_USUARIO + `No se pudo dar de alta "${nombre}". ${detalle}`);
            }
            createdProductIds.push(creado.productId);

            const variantesNuevas: any[] = await prisma.variant.findMany({
                where: { productId: creado.productId },
                select: { id: true, color: true, size: true, attributes: true },
            });
            const porFirma = new Map<string, any>();
            for (const v of variantesNuevas) porFirma.set(comboSignature(v.attributes, opciones), v);

            const items: { variantId: string; variantInfo: string; quantity: number }[] = [];
            for (const [firma, cantidad] of cantidadPorFirma.entries()) {
                const variante = porFirma.get(firma);
                if (!variante) {
                    throw new Error(ERROR_USUARIO + `No se pudieron crear las tallas del producto nuevo "${nombre}".`);
                }
                items.push({
                    variantId: variante.id,
                    variantInfo: formatVariantLabel(variante),
                    quantity: cantidad,
                });
            }

            resueltos.push({
                index: l.index,
                productId: creado.productId,
                productName: nombre,
                unitCost: l.unitCost,
                salePrice: l.salePrice,
                items,
            });
        }

        // Renglones de la nota, con todos los productId ya resueltos.
        const itemsNota = resueltos.flatMap(r => r.items.map(it => ({
            productId: r.productId,
            variantId: it.variantId,
            productName: r.productName,
            variantInfo: it.variantInfo,
            quantity: it.quantity,
            unitCost: r.unitCost,
            lineTotal: round2(it.quantity * r.unitCost),
            lineOrder: r.index,
        })));
        const totalItems = itemsNota.reduce((s, it) => s + it.quantity, 0);

        // Costo promedio ponderado de esta remesa por producto, y precio de
        // venta si se capturó. Un mismo producto capturado en dos renglones se
        // pondera todo junto.
        const actualizacionesProducto = new Map<string, { piezas: number; importe: number; price: number | null }>();
        for (const r of resueltos) {
            const acumulado = actualizacionesProducto.get(r.productId) || { piezas: 0, importe: 0, price: null };
            acumulado.piezas += r.items.reduce((s, it) => s + it.quantity, 0);
            acumulado.importe += r.items.reduce((s, it) => s + round2(it.quantity * r.unitCost), 0);
            if (r.salePrice !== null) acumulado.price = r.salePrice;
            actualizacionesProducto.set(r.productId, acumulado);
        }

        // Los modelos que todavía no tenían proveedor se quedan con el de esta
        // nota. Los que ya tenían uno NO se tocan. Los productos nuevos nacen
        // con el proveedor de la nota desde `createProduct`, así que no entran.
        const productosSinProveedor = new Set(
            Array.from(productosExistentes.values())
                .filter((p: any) => !p.supplierId)
                .map((p: any) => p.id as string)
        );

        // Dinero de la nota, derivado en el servidor.
        const paidAmount = round2(abono);
        let balance = round2(total - paidAmount);
        let paidAt: Date | null = null;
        if (balance <= CENTAVO) {
            // Nunca comparar contra cero exacto: un residuo de coma flotante
            // dejaría la nota "pendiente" para siempre.
            balance = 0;
            // La nota solo puede quedar saldada aquí por el abono inicial, así
            // que se salda en la fecha de la nota, igual que ese abono.
            paidAt = noteDate;
        }
        const paymentType = balance === 0 ? 'CASH' : 'CREDIT';
        // Si quedó saldo y nadie capturó plazo, se aplica el típico de 30 días y
        // se guarda: una nota sin vencimiento no aparecería en ninguna caja de
        // antigüedad de Cuentas por Pagar, justo la pantalla que existe para no
        // perder de vista las deudas.
        let plazoAplicado: number | null = null;
        let dueDate: Date | null = null;
        if (balance > 0) {
            plazoAplicado = (creditDays !== null && creditDays > 0) ? creditDays : PLAZO_POR_OMISION;
            dueDate = new Date(noteDate.getTime());
            dueDate.setDate(dueDate.getDate() + plazoAplicado);
        }

        // ── 3. Una sola transacción, con reintento del folio duplicado ─────
        let folioCreado = 0;
        for (let intento = 1; intento <= 3; intento++) {
            try {
                folioCreado = await prisma.$transaction(async (tx) => {
                    const ultima: any = await (tx as any).purchaseNote.findFirst({
                        where: { sellerId: access.sellerId },
                        orderBy: { folio: 'desc' },
                        select: { folio: true },
                    });
                    const folio = (ultima?.folio ?? 0) + 1;

                    const nota: any = await (tx as any).purchaseNote.create({
                        data: {
                            sellerId: access.sellerId,
                            folio,
                            supplierId: supplier.id,
                            supplierName: supplier.name,
                            invoiceNumber: input.invoiceNumber?.trim() || null,
                            noteDate,
                            locationId: input.locationId,
                            userId: access.user.id,
                            paymentType,
                            creditDays: plazoAplicado,
                            dueDate,
                            total,
                            paidAmount,
                            balance,
                            paidAt,
                            totalItems,
                            notes: input.notes?.trim() || null,
                            items: { create: itemsNota },
                        },
                        select: { id: true },
                    });

                    if (paidAmount > 0) {
                        await (tx as any).supplierPayment.create({
                            data: {
                                sellerId: access.sellerId,
                                supplierId: supplier.id,
                                purchaseNoteId: nota.id,
                                amount: paidAmount,
                                // La fecha de la nota, no la de hoy: una nota
                                // antedatada caería en el mes equivocado.
                                paidAt: noteDate,
                                paymentMethodId,
                                source: 'INITIAL',
                                userId: access.user.id,
                            },
                        });
                    }

                    // Suma al inventario, igual que una entrada de mercancía.
                    for (const it of itemsNota) {
                        await tx.inventoryLevel.upsert({
                            where: {
                                variantId_locationId: {
                                    variantId: it.variantId,
                                    locationId: input.locationId,
                                },
                            },
                            create: {
                                variantId: it.variantId,
                                locationId: input.locationId,
                                stock: it.quantity,
                            },
                            update: { stock: { increment: it.quantity } },
                        });

                        await tx.variant.update({
                            where: { id: it.variantId },
                            data: { stock: { increment: it.quantity } },
                        });
                    }

                    // Los movimientos, en una sola escritura.
                    await tx.inventoryMovement.createMany({
                        data: itemsNota.map(it => ({
                            variantId: it.variantId,
                            locationId: input.locationId,
                            type: 'RESTOCK',
                            quantity: it.quantity,
                            reason: `Compra ${folioText(folio)}. Usuario: ${access.user.name || 'Sistema'}`,
                        })),
                    });

                    // Costo de la remesa y precio de venta capturado.
                    for (const [productId, acumulado] of actualizacionesProducto.entries()) {
                        const costoRemesa = acumulado.piezas > 0 ? round2(acumulado.importe / acumulado.piezas) : 0;
                        // Una remesa de bonificación (costo 0) es legítima, pero no
                        // debe borrar el costo del producto y arruinar los reportes
                        // de utilidad: en ese caso se conserva el que ya tenía.
                        const data: any = {};
                        if (costoRemesa > 0) data.cost = costoRemesa;
                        if (acumulado.price !== null && acumulado.price > 0) data.price = acumulado.price;
                        // Se le queda el proveedor de la nota al modelo que no
                        // tenía ninguno, aunque la remesa haya sido de regalo y
                        // no haya costo ni precio que actualizar.
                        if (productosSinProveedor.has(productId)) data.supplierId = supplier.id;
                        if (Object.keys(data).length === 0) continue;
                        // updateMany para conservar el sellerId dentro del WHERE (I1).
                        await tx.product.updateMany({
                            where: { id: productId, sellerId: access.sellerId },
                            data,
                        });
                    }

                    return folio;
                }, { timeout: 60000, maxWait: 20000 });
                // La transacción se comprometió: los productos nuevos ya tienen
                // renglones de la nota apuntándoles y NO se pueden borrar. Si algo
                // fallara de aquí en adelante, la compensación del `catch` haría
                // más daño que bien (borrado fallido + "no se pudo guardar" sobre
                // una nota que sí existe, y el dueño recapturaría duplicado).
                createdProductIds.length = 0;
                break;
            } catch (error: any) {
                // I5: dos capturas simultáneas pueden pelearse el mismo folio.
                const esFolioDuplicado = error?.code === 'P2002'
                    && String(error?.meta?.target || '').includes('folio');
                if (esFolioDuplicado && intento < 3) continue;
                throw error;
            }
        }

        revalidatePath('/inventory');
        revalidatePath('/inventory/purchases');
        revalidatePath('/products');
        revalidatePath('/pos');
        return { success: true, folio: folioCreado };
    } catch (error: any) {
        console.error('Error al guardar la nota de compra:', error);

        // Compensación best-effort: los productos nuevos se crearon fuera de la
        // transacción, así que el rollback no los borra. Va en su propio
        // try/catch para que un fallo de limpieza no tape el error original.
        if (createdProductIds.length > 0 && sellerIdDeLaNota) {
            try {
                // El sellerId también aquí: es el único WHERE del archivo que borra.
                await prisma.product.deleteMany({
                    where: { id: { in: createdProductIds }, sellerId: sellerIdDeLaNota },
                });
            } catch (limpieza: any) {
                console.error('No se pudieron borrar los productos creados para la nota:', limpieza);
            }
        }

        const msg = String(error?.message || '');
        return {
            success: false,
            error: msg.startsWith(ERROR_USUARIO) ? msg.slice(ERROR_USUARIO.length) : 'No se pudo guardar la nota de compra.',
        };
    }
}

export async function getPurchaseNotes(params: {
    from?: string;
    to?: string;
    supplierId?: string;
    status?: string;
    soloConSaldo?: boolean;
    page?: number;
}) {
    try {
        const access: any = await resolveEntryAccess();
        if (access.error) {
            return { success: false, error: access.error, rows: [], total: 0, page: 1, totalPages: 1 };
        }

        const pageSize = 25;
        const page = Math.max(1, params.page || 1);

        const where: any = { sellerId: access.sellerId };
        if (access.allowedLocationIds) where.locationId = { in: access.allowedLocationIds };
        if (params.status) where.status = params.status;
        if (params.soloConSaldo) {
            // Una nota cancelada no debe nada (al cancelarla se le pone saldo 0),
            // así que "Solo con saldo" es una consulta sobre notas activas.
            where.balance = { gt: CENTAVO };
            where.status = 'ACTIVE';
        }

        // Un proveedor del filtro tiene que ser del vendedor: si no, la nota
        // vacía es la respuesta correcta, no "ignorar el filtro".
        if (params.supplierId) {
            const supplier = await (prisma as any).supplier.findFirst({
                where: { id: params.supplierId, sellerId: access.sellerId },
                select: { id: true },
            });
            if (!supplier) return { success: true, rows: [], total: 0, page, totalPages: 1 };
            where.supplierId = params.supplierId;
        }

        // Fechas locales, no UTC: `new Date('2026-08-17')` cae a medianoche UTC
        // y un filtro "de hoy a hoy" sale vacío. Mismo patrón que getStockEntries.
        if (params.from || params.to) {
            where.noteDate = {};
            if (params.from) {
                const [y, m, d] = params.from.split('-').map(Number);
                where.noteDate.gte = new Date(y, m - 1, d, 0, 0, 0, 0);
            }
            if (params.to) {
                const [y, m, d] = params.to.split('-').map(Number);
                where.noteDate.lte = new Date(y, m - 1, d, 23, 59, 59, 999);
            }
        }

        const [total, notes] = await Promise.all([
            (prisma as any).purchaseNote.count({ where }),
            (prisma as any).purchaseNote.findMany({
                where,
                // Segundo criterio para desempatar: con solo la fecha, dos notas
                // del mismo día pueden repetirse o saltarse entre páginas.
                orderBy: [{ noteDate: 'desc' }, { folio: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    location: { select: { name: true } },
                    user: { select: { name: true } },
                },
            }),
        ]);

        return {
            success: true,
            rows: notes.map((n: any) => ({
                id: n.id,
                folio: folioText(n.folio),
                noteDate: n.noteDate,
                supplierName: n.supplierName,
                invoiceNumber: n.invoiceNumber,
                locationName: n.location?.name || '—',
                userName: n.user?.name || null,
                totalItems: n.totalItems,
                total: n.total,
                paidAmount: n.paidAmount,
                balance: n.balance,
                dueDate: n.dueDate,
                paidAt: n.paidAt,
                paymentType: n.paymentType,
                status: n.status,
                cancelledAt: n.cancelledAt,
                cancelledByName: n.cancelledByName,
            })),
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
    } catch (error: any) {
        console.error('Error al cargar las notas de compra:', error);
        return { success: false, error: 'No se pudieron cargar las notas de compra.', rows: [], total: 0, page: 1, totalPages: 1 };
    }
}

export async function getPurchaseNote(id: string) {
    try {
        const access: any = await resolveEntryAccess();
        if (access.error) return null;
        // Un id vacío borraría la condición del WHERE y traería la primera
        // nota del vendedor: nunca consultar sin id.
        if (!id) return null;

        const where: any = { id, sellerId: access.sellerId };
        if (access.allowedLocationIds) where.locationId = { in: access.allowedLocationIds };

        const note: any = await (prisma as any).purchaseNote.findFirst({
            where,
            include: {
                location: { select: { name: true } },
                user: { select: { name: true } },
                items: { orderBy: { lineOrder: 'asc' } },
                payments: {
                    where: { status: 'ACTIVE' },
                    include: { paymentMethod: { select: { name: true } } },
                    orderBy: { paidAt: 'asc' },
                },
            },
        });
        if (!note) return null;

        return {
            id: note.id,
            folio: folioText(note.folio),
            noteDate: note.noteDate,
            supplierName: note.supplierName,
            invoiceNumber: note.invoiceNumber,
            locationName: note.location?.name || '—',
            userName: note.user?.name || null,
            totalItems: note.totalItems,
            total: note.total,
            paidAmount: note.paidAmount,
            balance: note.balance,
            dueDate: note.dueDate,
            paidAt: note.paidAt,
            paymentType: note.paymentType,
            status: note.status,
            cancelledAt: note.cancelledAt,
            cancelledByName: note.cancelledByName,
            items: note.items.map((it: any) => ({
                productName: it.productName,
                variantInfo: it.variantInfo,
                quantity: it.quantity,
                unitCost: it.unitCost,
                lineTotal: it.lineTotal,
            })),
            payments: note.payments.map((p: any) => ({
                amount: p.amount,
                paidAt: p.paidAt,
                paymentMethodName: p.paymentMethod?.name || null,
                source: p.source,
                notes: p.notes,
            })),
        };
    } catch (error: any) {
        console.error('Error al cargar la nota de compra:', error);
        return null;
    }
}

export async function cancelPurchaseNote(id: string) {
    try {
        const user: any = await getSessionUser();
        if (!user || user.role !== 'SELLER') {
            return { success: false, error: 'Solo el dueño de la tienda puede cancelar una nota de compra.' };
        }
        // Un id vacío borraría la condición del WHERE del candado y cancelaría
        // la primera nota activa del vendedor: nunca operar sin id.
        if (!id) return { success: false, error: 'Nota no encontrada.' };

        await prisma.$transaction(async (tx) => {
            // Candado atómico: sellerId + status ACTIVE + sin abonos MANUALES
            // activos, todo dentro del WHERE. Los abonos INITIAL sí se cancelan
            // junto con la nota (es el dedazo recién capturado); los MANUAL son
            // dinero que ya salió y no tienen nota de crédito, así que bloquean
            // la cancelación.
            const claimed = await (tx as any).purchaseNote.updateMany({
                where: {
                    id, sellerId: user.id, status: 'ACTIVE',
                    payments: { none: { status: 'ACTIVE', source: 'MANUAL' } },
                },
                // Una nota cancelada no le debe nada al proveedor: se le quita el
                // abonado y el saldo junto con el estado. Si no, seguiría saliendo
                // en "Solo con saldo" y el renglón diría "Abonado $500" mientras el
                // detalle, que solo muestra abonos activos, dice "Sin abonos".
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancelledByName: user.name || null,
                    paidAmount: 0,
                    balance: 0,
                    paidAt: null,
                },
            });
            if (claimed.count !== 1) {
                // La misma condición falla por tres motivos distintos: decirle
                // siempre "ya tiene abonos" manda al dueño a buscar abonos que no
                // existen.
                const actual: any = await (tx as any).purchaseNote.findFirst({
                    where: { id, sellerId: user.id },
                    select: { status: true },
                });
                if (!actual) throw new Error(ERROR_USUARIO + 'Esa nota de compra no existe.');
                if (actual.status === 'CANCELLED') throw new Error(ERROR_USUARIO + 'Esta nota ya estaba cancelada.');
                throw new Error(ERROR_USUARIO + 'No se puede cancelar: esta nota ya tiene abonos registrados. Cancela primero los abonos en Cuentas por Pagar.');
            }

            const note: any = await (tx as any).purchaseNote.findFirst({
                where: { id, sellerId: user.id },
                include: { items: true },
            });
            if (!note) throw new Error(ERROR_USUARIO + 'Nota no encontrada.');

            // Primero se revisa TODO: si a un solo renglón no le alcanza, no se
            // toca nada. Nunca se deja stock negativo.
            for (const item of note.items) {
                const level = await tx.inventoryLevel.findUnique({
                    where: {
                        variantId_locationId: {
                            variantId: item.variantId,
                            locationId: note.locationId,
                        },
                    },
                });
                if (!level || level.stock < item.quantity) {
                    throw new Error(ERROR_USUARIO + 'No se puede cancelar: ya se vendieron piezas de esta compra. Corrige con Ajustar Stock.');
                }
            }

            for (const item of note.items) {
                await tx.inventoryLevel.update({
                    where: {
                        variantId_locationId: {
                            variantId: item.variantId,
                            locationId: note.locationId,
                        },
                    },
                    data: { stock: { decrement: item.quantity } },
                });

                await tx.variant.update({
                    where: { id: item.variantId },
                    data: { stock: { decrement: item.quantity } },
                });
            }

            await tx.inventoryMovement.createMany({
                data: note.items.map((item: any) => ({
                    variantId: item.variantId,
                    locationId: note.locationId,
                    type: 'ADJUSTMENT',
                    quantity: -item.quantity,
                    reason: `Cancelación de compra ${folioText(note.folio)}. Usuario: ${user.name || 'Sistema'}`,
                })),
            });

            // Los abonos INITIAL de esta nota se cancelan junto con ella.
            // Product.cost y Product.price NO se revierten: eran una
            // instantánea del momento de la compra y no hay a qué valor
            // "correcto" volver.
            await (tx as any).supplierPayment.updateMany({
                where: { purchaseNoteId: note.id, source: 'INITIAL', status: 'ACTIVE' },
                data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByName: user.name || null },
            });
        }, { timeout: 60000, maxWait: 20000 });

        revalidatePath('/inventory');
        revalidatePath('/inventory/purchases');
        revalidatePath('/pos');
        return { success: true };
    } catch (error: any) {
        console.error('Error al cancelar la nota de compra:', error);
        const msg = String(error?.message || '');
        return { success: false, error: msg.startsWith(ERROR_USUARIO) ? msg.slice(ERROR_USUARIO.length) : 'No se pudo cancelar la nota de compra.' };
    }
}

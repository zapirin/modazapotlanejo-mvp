"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resolveEntryAccess } from "@/lib/sellerAccess";
import { round2, CENTAVO } from "@/lib/money";
import { createProduct } from "@/app/(seller-center)/products/new/actions";

// Prefijo para distinguir errores de negocio (mensaje seguro para el usuario)
// de errores internos/de Prisma que no deben mostrarse tal cual.
const ERROR_USUARIO = 'ERR_USR: ';

// Techos duros. La transacción de una nota grande no puede ser infinita: 15
// productos x 8 variantes ya son 120 renglones de inventario.
const MAX_PRODUCTOS_POR_NOTA = 60;
const MAX_RENGLONES_POR_NOTA = 300;
const MAX_VARIANTES_PRODUCTO_NUEVO = 100;

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
            where: { sellerId: access.sellerId, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    return { suppliers, locations, paymentMethods };
}

export async function searchProductsForPurchase(query: string) {
    const access: any = await resolveEntryAccess();
    if (access.error) return [];
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const products = await prisma.product.findMany({
        where: {
            sellerId: access.sellerId,
            isActive: true,
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
            ],
        },
        select: {
            id: true,
            name: true,
            sku: true,
            images: true,
            supplier: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
        take: 20,
    });

    return products.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: p.images?.[0] || null,
        supplierName: p.supplier?.name || null,
    }));
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
    // hay que borrarlos (compensación).
    const createdProductIds: string[] = [];

    try {
        const access: any = await resolveEntryAccess();
        if (access.error) return { success: false, error: access.error };

        // ── 1. Validar TODO antes de crear nada ────────────────────────────
        const lines = input.lines || [];
        if (lines.length === 0) {
            return { success: false, error: 'Agrega al menos un producto a la nota.' };
        }
        if (lines.length > MAX_PRODUCTOS_POR_NOTA) {
            return { success: false, error: `Una nota no puede tener más de ${MAX_PRODUCTOS_POR_NOTA} productos. Divídela en dos notas.` };
        }

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

        let creditDays: number | null = null;
        if (input.creditDays !== undefined && input.creditDays !== null) {
            const dias = Number(input.creditDays);
            if (!Number.isInteger(dias) || dias < 0 || dias > 365) {
                return { success: false, error: 'El plazo debe ser un número entero de días entre 0 y 365.' };
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

            let salePrice: number | null = null;
            if (linea.salePrice !== undefined && linea.salePrice !== null && String(linea.salePrice) !== '') {
                const precio = Number(linea.salePrice);
                if (!Number.isFinite(precio) || precio < 0) {
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
                    where: { id: input.initialPayment.paymentMethodId, sellerId: access.sellerId, isActive: true },
                    select: { id: true },
                });
                if (!metodo) return { success: false, error: 'Forma de pago no válida.' };
                paymentMethodId = metodo.id;
            }
        }

        // Productos existentes: que sean del vendedor y estén fuera de la Papelera.
        const idsExistentes = Array.from(new Set(validadas.filter(l => l.productId).map(l => l.productId as string)));
        const productosExistentes = new Map<string, any>();
        if (idsExistentes.length > 0) {
            const encontrados: any[] = await prisma.product.findMany({
                where: { id: { in: idsExistentes }, sellerId: access.sellerId, isActive: true },
                select: { id: true, name: true },
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

            const precioBase = l.salePrice !== null ? l.salePrice : l.unitCost;
            const creado: any = await createProduct({
                name: nombre,
                description: "",
                supplierId: supplier.id,
                basePrice: String(precioBase),
                cost: String(l.unitCost),
                isOnline: false,
                images: [],
                variantOptions: opciones,
                variantsData: combos.map(c => ({ attributes: c, stock: 0 })),
            });
            if (!creado?.success || !creado?.productId) {
                throw new Error(ERROR_USUARIO + (creado?.error || `No se pudo dar de alta el producto nuevo "${nombre}".`));
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

        // Dinero de la nota, derivado en el servidor.
        const paidAmount = round2(abono);
        let balance = round2(total - paidAmount);
        let paidAt: Date | null = null;
        if (balance <= CENTAVO) {
            // Nunca comparar contra cero exacto: un residuo de coma flotante
            // dejaría la nota "pendiente" para siempre.
            balance = 0;
            paidAt = new Date();
        }
        const paymentType = balance === 0 ? 'CASH' : 'CREDIT';
        let dueDate: Date | null = null;
        if (balance > 0 && creditDays !== null) {
            dueDate = new Date(noteDate.getTime());
            dueDate.setDate(dueDate.getDate() + creditDays);
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
                            creditDays: balance > 0 ? creditDays : null,
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
                                paidAt: new Date(),
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
                        const data: any = {
                            cost: acumulado.piezas > 0 ? round2(acumulado.importe / acumulado.piezas) : 0,
                        };
                        if (acumulado.price !== null) data.price = acumulado.price;
                        // updateMany para conservar el sellerId dentro del WHERE (I1).
                        await tx.product.updateMany({
                            where: { id: productId, sellerId: access.sellerId },
                            data,
                        });
                    }

                    return folio;
                }, { timeout: 60000, maxWait: 20000 });
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
        if (createdProductIds.length > 0) {
            try {
                await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
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

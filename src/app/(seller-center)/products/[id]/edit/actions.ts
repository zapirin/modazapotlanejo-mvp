"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/app/actions/auth";
import { postProductToSocialMedia } from "@/lib/socialMedia";

// Mismas reglas de slug que products/new/actions.ts
function makeSlug(text: string): string {
    return text.toLowerCase().trim()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
        .substring(0, 60).replace(/-+$/, '') || 'producto';
}

async function uniqueProductSlug(base: string): Promise<string> {
    let slug = base, counter = 1;
    while (await (prisma.product as any).findUnique({ where: { slug } })) {
        slug = `${base}-${counter++}`;
    }
    return slug;
}

export async function getProductForEdit(productId: string) {
    try {
        const user = await getSessionUser();
        if (!user) return null;
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                variants: { include: { inventoryLevels: true } },
                tags: true
            }
        });
        if (!product) return null;
        if (user.role !== 'ADMIN') {
            let effectiveId = user.id;
            if (user.role === 'CASHIER') {
                const cashier = await (prisma.user as any).findUnique({
                    where: { id: user.id },
                    select: { managedBySellerId: true }
                });
                effectiveId = cashier?.managedBySellerId || user.id;
            }
            if (product.sellerId !== effectiveId) return null;
        }
        return product;
    } catch (error) {
        console.error("Error fetching product for edit:", error);
        return null;
    }
}

export async function updateProduct(productId: string, data: any) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado" };

        // sellerId (para permisos), isOnline (para detectar si esta edición
        // pasa el producto de "fuera de línea" a "en línea" y así saber si
        // corresponde publicarlo en redes sociales) y slug (para regenerarlo
        // si el producto aún está oculto y cambió de nombre).
        const existingProduct = await prisma.product.findUnique({
            where: { id: productId },
            select: { sellerId: true, isOnline: true, slug: true }
        });
        if (!existingProduct) return { success: false, error: "Producto no encontrado" };

        if (user.role !== 'ADMIN') {
            let effectiveId = user.id;
            if (user.role === 'CASHIER') {
                const cashier = await (prisma.user as any).findUnique({
                    where: { id: user.id },
                    select: { managedBySellerId: true }
                });
                effectiveId = cashier?.managedBySellerId || user.id;
            }
            if (existingProduct.sellerId !== effectiveId) {
                return { success: false, error: "No tienes permiso para modificar este producto" };
            }
        }

        const price = parseFloat(data.basePrice);
        const wPrice = data.wholesalePrice ? parseFloat(data.wholesalePrice) : null;
        const costPrice = data.cost ? parseFloat(data.cost) : null;
        const pSize = data.packageSize ? parseInt(data.packageSize) : null;

        // El link (slug) se regenera a partir del nombre SOLO si el producto
        // sigue oculto: al no haber estado nunca en línea, no hay ningún enlace
        // publicado (Facebook, Instagram, Google) que se pueda romper. Esto
        // limpia los slugs heredados al duplicar, donde la copia arrastraba el
        // nombre del producto original. Un producto ya en línea conserva su
        // link aunque se le cambie el nombre.
        let regeneratedSlug: string | null = null;
        if (!existingProduct.isOnline && data.name) {
            const base = makeSlug(data.name);
            if (base !== existingProduct.slug) {
                regeneratedSlug = await uniqueProductSlug(base);
            }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Update Product Model
            await tx.product.update({
                where: { id: productId },
                data: {
                    name: data.name,
                    ...(regeneratedSlug ? { slug: regeneratedSlug } : {}),
                    description: data.description || "",
                    price: price,
                    wholesalePrice: wPrice,
                    cost: costPrice,
                    wholesaleComposition: data.wholesaleComposition ? JSON.parse(JSON.stringify(data.wholesaleComposition)) : null,
                    sellByPackage: data.sellByPackage || false,
                    disableRetailPrice: data.disableRetailPrice || false,
                    packageSize: pSize,
                    variantOptions: data.variantOptions ? JSON.parse(JSON.stringify(data.variantOptions)) : null,
                    brandId: data.brandId || null,
                    supplierId: data.supplierId || null,
                    categoryId: data.categoryId || null,
                    subcategoryId: data.subcategoryId || null,
                    isOnline: data.isOnline !== undefined ? data.isOnline : true,
                    isPOS: data.isPOS !== undefined ? data.isPOS : true,
                    onlinePriceLocationId: data.onlinePriceLocationId || null,
                    onlineStockLocationIds: data.onlineStockLocationIds || [],
                    sku: data.sku || null,
                    images: data.images || [],
                    tags: data.tagIds ? {
                        set: data.tagIds.map((id: string) => ({ id }))
                    } : undefined,
                }
            });

            // 2. Synchronize Variants if variantsData is provided
            if (data.variantsData && Array.isArray(data.variantsData)) {
                // Get current variants
                const currentVariants = await tx.variant.findMany({
                    where: { productId }
                });

                const touchedVariantIds = new Set<string>();

                for (const vData of data.variantsData) {
                    const attrs = vData.attributes || {};
                    const color = vData.color || (attrs.Color || attrs.color || null);
                    const size = vData.size || (attrs.Talla || attrs.talla || attrs.Size || attrs.size || attrs.Tamaño || attrs.tamaño || null);
                    
                    // Find existing by exact attributes match (simple JSON string comparison for this project's scope)
                    const existing = currentVariants.find(curr => 
                        JSON.stringify(curr.attributes) === JSON.stringify(attrs)
                    );

                    let variantId: string;
                    if (existing) {
                        await tx.variant.update({
                            where: { id: existing.id },
                            data: { stock: vData.stock, color, size, price: vData.price || null }
                        });
                        variantId = existing.id;
                        touchedVariantIds.add(existing.id);
                    } else {
                        const created = await tx.variant.create({
                            data: { productId, attributes: attrs, stock: vData.stock, color, size, price: vData.price || null }
                        });
                        variantId = created.id;
                        touchedVariantIds.add(created.id);
                    }

                    // Guardar stock y precio por sucursal si viene locationStock
                    if (vData.inventoryLevels && vData.inventoryLevels.length > 0) {
                        for (const level of vData.inventoryLevels) {
                            const existingLevel = await tx.inventoryLevel.findFirst({
                                where: { variantId, locationId: level.locationId }
                            });
                            if (existingLevel) {
                                await tx.inventoryLevel.update({
                                    where: { id: existingLevel.id },
                                    data: { stock: level.quantity, price: level.price || null }
                                });
                            } else {
                                await tx.inventoryLevel.create({
                                    data: { id: "il-" + variantId + "-" + level.locationId, variantId, locationId: level.locationId, stock: level.quantity, price: level.price || null, updatedAt: new Date() }
                                });
                            }
                        }
                    }
                }

                // Delete variants that were NOT touched (removed from options)
                const toDelete = currentVariants.filter(curr => !touchedVariantIds.has(curr.id));
                if (toDelete.length > 0) {
                    const toDeleteIds = toDelete.map(d => d.id);
                    // Borrar dependencias antes de borrar variantes
                    await tx.inventoryMovement.deleteMany({
                        where: { variantId: { in: toDeleteIds } }
                    });
                    await tx.inventoryLevel.deleteMany({
                        where: { variantId: { in: toDeleteIds } }
                    });
                    await tx.variant.deleteMany({
                        where: { id: { in: toDeleteIds } }
                    });
                }
            }
        });

        // Publicar en redes sociales si esta edición pasó el producto de
        // "fuera de línea" a "en línea" (solo Kalexa, best-effort, no bloquea).
        // Cubre tanto duplicados (que nacen fuera de línea) como productos
        // existentes que se reactivan. No se dispara si ya estaba en línea.
        try {
            const isNowOnline = data.isOnline !== undefined ? data.isOnline : true;
            if (!existingProduct.isOnline && isNowOnline) {
                const saved = await prisma.product.findUnique({ where: { id: productId } });
                if (saved) postProductToSocialMedia(saved).catch(console.error);
            }
        } catch (socialError) {
            console.error("[Social] Error verificando publicación pendiente:", socialError);
        }

        revalidatePath("/inventory");
        revalidatePath("/pos");
        revalidatePath(`/products/${productId}/edit`);
        return { success: true };
    } catch (error: any) {
        console.error("Error updating product:", error);
        return { success: false, error: "No se pudo actualizar el producto." };
    }
}

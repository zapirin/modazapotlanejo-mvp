"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getProductForEdit(productId: string) {
    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                variants: { include: { inventoryLevels: true } },
                tags: true
            }
        });
        return product;
    } catch (error) {
        console.error("Error fetching product for edit:", error);
        return null;
    }
}

export async function updateProduct(productId: string, data: any) {
    try {
        const price = parseFloat(data.basePrice);
        const wPrice = data.wholesalePrice ? parseFloat(data.wholesalePrice) : null;
        const costPrice = data.cost ? parseFloat(data.cost) : null;
        const pSize = data.packageSize ? parseInt(data.packageSize) : null;

        await prisma.$transaction(async (tx) => {
            // 1. Update Product Model
            await tx.product.update({
                where: { id: productId },
                data: {
                    name: data.name,
                    description: data.description || "",
                    price: price,
                    wholesalePrice: wPrice,
                    cost: costPrice,
                    wholesaleComposition: data.wholesaleComposition ? JSON.parse(JSON.stringify(data.wholesaleComposition)) : null,
                    sellByPackage: data.sellByPackage || false,
                    packageSize: pSize,
                    variantOptions: data.variantOptions ? JSON.parse(JSON.stringify(data.variantOptions)) : null,
                    brandId: data.brandId || null,
                    supplierId: data.supplierId || null,
                    categoryId: data.categoryId || null,
                    subcategoryId: data.subcategoryId || null,
                    isOnline: data.isOnline !== undefined ? data.isOnline : true,
                    isPOS: data.isPOS !== undefined ? data.isPOS : true,
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
                            data: { stock: vData.stock, color, size }
                        });
                        variantId = existing.id;
                        touchedVariantIds.add(existing.id);
                    } else {
                        const created = await tx.variant.create({
                            data: { productId, attributes: attrs, stock: vData.stock, color, size }
                        });
                        variantId = created.id;
                        touchedVariantIds.add(created.id);
                    }

                    // Guardar stock por sucursal si viene locationStock
                    if (vData.locationStock && vData.locationStock.length > 0) {
                        for (const level of vData.locationStock) {
                            const existing = await tx.inventoryLevel.findFirst({
                                where: { variantId, locationId: level.locationId }
                            });
                            if (existing) {
                                await tx.inventoryLevel.update({
                                    where: { id: existing.id },
                                    data: { stock: level.stock }
                                });
                            } else {
                                await tx.inventoryLevel.create({
                                    data: { id: "il-" + variantId + "-" + level.locationId, variantId, locationId: level.locationId, stock: level.stock, updatedAt: new Date() }
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

        revalidatePath("/inventory");
        revalidatePath("/pos");
        revalidatePath(`/products/${productId}/edit`);
        return { success: true };
    } catch (error: any) {
        console.error("Error updating product:", error);
        return { success: false, error: "No se pudo actualizar el producto." };
    }
}

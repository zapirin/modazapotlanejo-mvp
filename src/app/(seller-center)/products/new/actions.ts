"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from '@/generated/client';
import { getSessionUser } from '@/app/actions/auth';
import { sendLowInventoryAlert } from "@/lib/email/templates";

// ---------------------------------------------------------------------------
// HELPER: Resolver el sellerId efectivo para cajeros
// Un cajero usa los productos/configs de su vendedor (managedBySellerId)
// ---------------------------------------------------------------------------
async function getEffectiveSellerId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.role === 'ADMIN') return null; // ADMIN ve todo
    if (user.role === 'CASHIER') {
        // El cajero usa el sellerId de su vendedor
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true }
        });
        return cashier?.managedBySellerId || null;
    }
    return user.id; // SELLER, MANAGER usan su propio id
}

export async function createProduct(data: {
    name: string;
    description: string;
    brandId?: string;
    supplierId?: string;
    categoryId?: string;
    subcategoryId?: string;
    basePrice: string;
    wholesalePrice?: string;
    cost?: string;
    wholesaleComposition?: any;
    sellByPackage?: boolean;
    packageSize?: string;
    isOnline?: boolean;
    isPOS?: boolean;
    images: string[];
    tagIds?: string[];
    // New Dynamic Variants
    variantOptions?: any;
    variantsData?: { attributes: any; stock: number; color?: string; size?: string; inventoryLevels?: { locationId: string; quantity: number }[] }[];
    sku?: string | null;
    // Legacy
    colors?: string[];
    sizes?: string[];
    inventory?: Record<string, Record<string, string | number>>;
}) {
    console.log("Creating product with data:", { ...data, images: data.images.length });
    try {
        const user = await getSessionUser();
        if (!data.name || !data.basePrice) {
            return { success: false, error: "El nombre y el precio base son obligatorios." };
        }

        // Verificar límite de productos del plan
        if (user && user.role !== 'ADMIN') {
            const sellerData = await (prisma.user as any).findUnique({
                where: { id: user.id },
                select: { maxProducts: true }
            });
            if (sellerData?.maxProducts !== null && sellerData?.maxProducts !== undefined) {
                const currentCount = await prisma.product.count({
                    where: { sellerId: user.id, isActive: true }
                });
                if (currentCount >= sellerData.maxProducts) {
                    return { success: false, error: `Has alcanzado el límite de ${sellerData.maxProducts} productos de tu plan. Contacta al administrador para aumentar tu límite.` };
                }
            }
        }

        const price = parseFloat(data.basePrice);
        const wPrice = data.wholesalePrice ? parseFloat(data.wholesalePrice) : null;
        const pSize = data.packageSize ? parseInt(data.packageSize) : null;

        if (isNaN(price)) {
            return { success: false, error: "El precio base debe ser un número válido." };
        }

        const existingProduct = await prisma.product.findFirst({
            where: {
                name: { equals: data.name.trim(), mode: 'insensitive' },
                isActive: true
            }
        });

        if (existingProduct) {
            return { success: false, error: "Ya existe un modelo activo con este mismo nombre." };
        }

        // Prepare variants data
        let variantsToCreate: any[] = [];
        if (data.variantsData && data.variantsData.length > 0) {
            variantsToCreate = data.variantsData.map(v => ({
                attributes: v.attributes || Prisma.JsonNull,
                stock: v.stock || 0,
                color: v.color || (v.attributes?.Color || v.attributes?.color || null),
                size: v.size || (v.attributes?.Talla || v.attributes?.talla || v.attributes?.Size || v.attributes?.size || null),
                inventoryLevels: v.inventoryLevels && v.inventoryLevels.length > 0 ? {
                    create: v.inventoryLevels.map(lvl => ({
                        locationId: lvl.locationId,
                        stock: lvl.quantity
                    }))
                } : undefined,
            }));
        } else if (data.colors && data.sizes && data.inventory) {
            // Legacy fallback
            variantsToCreate = (data.colors || []).flatMap((color) =>
                (data.sizes || []).map((size) => ({
                    color: color,
                    size: size,
                    attributes: { Color: color, Talla: size },
                    stock: parseInt((data.inventory?.[color]?.[size] || "0").toString()) || 0,
                }))
            );
        }

        const costPrice = data.cost ? parseFloat(data.cost) : null;

        // 1. Create the product
        const product = await (prisma.product as any).create({
            data: {
                name: data.name,
                description: data.description || "",
                price: price,
                wholesalePrice: wPrice,
                cost: costPrice,
                wholesaleComposition: data.wholesaleComposition ? JSON.parse(JSON.stringify(data.wholesaleComposition)) : Prisma.JsonNull,
                sellByPackage: data.sellByPackage || false,
                packageSize: pSize,

                variantOptions: data.variantOptions ? JSON.parse(JSON.stringify(data.variantOptions)) : Prisma.JsonNull,

                brandId: data.brandId || null,
                supplierId: data.supplierId || null,
                categoryId: data.categoryId || null,
                subcategoryId: data.subcategoryId || null,

                isOnline: data.isOnline !== undefined ? data.isOnline : true,
                isPOS: data.isPOS !== undefined ? data.isPOS : true,

                sku: (data as any).sku || null,
                images: data.images || [],
                sellerId: user?.id,
                variants: {
                    create: variantsToCreate,
                },
                tags: data.tagIds && data.tagIds.length > 0 ? {
                    connect: data.tagIds.map(id => ({ id }))
                } : undefined,
            },
        });

        console.log("Product created successfully:", product.id);
        revalidatePath("/inventory");
        revalidatePath("/pos");
        return { success: true, productId: product.id };
    } catch (error: any) {
        console.error("Prisma Error Details:", error);
        return { success: false, error: `Error de base de datos: ${error.message || 'Desconocido'}` };
    }
}

export async function duplicateProduct(productId: string) {
    try {
        const user = await getSessionUser();
        const original = await (prisma.product as any).findUnique({
            where: { id: productId },
            include: {
                variants: true,
                tags: true,
            }
        });

        if (!original) return { success: false, error: "Producto no encontrado" };

        const duplicated = await (prisma.product as any).create({
            data: {
                name: `${original.name} (COPIA)`,
                description: original.description,
                price: original.price,
                wholesalePrice: original.wholesalePrice,
                cost: original.cost,
                sellByPackage: original.sellByPackage,
                packageSize: original.packageSize,
                wholesaleComposition: original.wholesaleComposition,
                brandId: original.brandId,
                supplierId: original.supplierId,
                sellerId: user?.id,
                categoryId: original.categoryId,
                subcategoryId: original.subcategoryId,
                isOnline: original.isOnline,
                isPOS: original.isPOS,
                isActive: original.isActive,
                images: original.images || [],
                sku: null,
                variantOptions: original.variantOptions,
                variants: {
                    create: (original.variants as any[]).map((v: any) => ({
                        attributes: v.attributes || {},
                        color: v.color,
                        size: v.size,
                        sku: null,
                        stock: 0
                    }))
                },
                tags: {
                    connect: (original.tags as any[]).map((t: any) => ({ id: t.id }))
                }
            }
        });

        revalidatePath("/products");
        revalidatePath("/inventory");
        return { success: true, productId: duplicated.id };
    } catch (error: any) {
        console.error("Error duplicating product:", error);
        return { success: false, error: error.message };
    }
}


export async function getInventory() {
    try {
        const user = await getSessionUser();
        const effectiveSellerId = await getEffectiveSellerId(user);
        const sellerFilter = user?.role === 'ADMIN' ? {} : { sellerId: effectiveSellerId };

        const products = await prisma.product.findMany({
            where: { 
                isActive: true,
                ...sellerFilter
            },
            include: {
                variants: {
                    include: {
                        inventoryLevels: true
                    }
                },
                category: true,
                subcategory: true,
                brand: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return products;
    } catch (error) {
        console.error("Error fetching inventory:", error);
        return [];
    }
}

export async function getStoreLocations() {
    try {
        const user = await getSessionUser();
        const effectiveSellerId = await getEffectiveSellerId(user);
        
        const locations = await prisma.storeLocation.findMany({
            where: { sellerId: effectiveSellerId },
            orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
        });
        
        // Auto-crear "Matriz" si el vendedor no tiene sucursales para no romper inventario
        if (locations.length === 0 && effectiveSellerId) {
            const matriz = await prisma.storeLocation.create({
                data: {
                    name: 'Matriz',
                    sellerId: effectiveSellerId,
                    isWebStore: true
                }
            });
            return [matriz];
        }

        return locations;
    } catch (e) {
        console.error("Error getStoreLocations:", e);
        return [];
    }
}

export async function createStoreLocation(name: string) {
    try {
        const user = await getSessionUser();
        const effectiveSellerId = await getEffectiveSellerId(user);
        if (!effectiveSellerId) throw new Error("Accediendo como visitante sin permisos.");

        const location = await prisma.storeLocation.create({
            data: {
                name,
                sellerId: effectiveSellerId,
                isWebStore: false
            }
        });
        
        return { success: true, location };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function searchProducts(query: string) {
    try {
        const user = await getSessionUser();
        const effectiveSellerId = await getEffectiveSellerId(user);
        const sellerFilter = user?.role === 'ADMIN' ? {} : { sellerId: effectiveSellerId };

        // Búsqueda desde 1 carácter — el POS controla el mínimo en la UI
        if (!query || query.length === 0) return [];

        const products = await prisma.product.findMany({
            where: {
                isActive: true,
                ...sellerFilter,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { sku: { contains: query, mode: 'insensitive' } },
                    { variants: { some: { sku: { contains: query, mode: 'insensitive' } } } }
                ]
            },
            include: {
                variants: {
                    orderBy: { createdAt: 'asc' }
                },
                category: true,
            },
            take: 20
        });
        return products;
    } catch (error) {
        console.error("Error searching products:", error);
        return [];
    }
}

export async function getProductsByCategory(categoryId: string) {
    try {
        const user = await getSessionUser();
        const effectiveSellerId = await getEffectiveSellerId(user);
        const sellerFilter = user?.role === 'ADMIN' ? {} : { sellerId: effectiveSellerId };

        const products = await prisma.product.findMany({
            where: {
                categoryId: categoryId,
                isActive: true,
                ...sellerFilter
            },
            include: {
                variants: {
                    orderBy: { createdAt: 'asc' }
                },
                category: true,
            },
            orderBy: { name: 'asc' }
        });
        return products;
    } catch (error) {
        console.error("Error fetching products by category:", error);
        return [];
    }
}

export async function suspendSale(data: {
    cart: any[];
    subtotal: number;
    total: number;
    discount: number;
    amountPaid?: number;
    balance?: number;
    priceTierId?: string | null;
    clientId?: string | null;
    notes?: string | null;
}) {
    try {
        const user = await getSessionUser();
        const locationId = user?.locationId || null;
        const sellerId = await getEffectiveSellerId(user);

        // Intentar con notes primero; si la columna aún no existe en BD, reintentar sin ella
        let sale: any;
        try {
            sale = await prisma.sale.create({
                data: {
                    total: data.total,
                    subtotal: data.subtotal,
                    discount: data.discount,
                    priceTierId: data.priceTierId || null,
                    clientId: data.clientId || null,
                    locationId: locationId,
                    sellerId: sellerId,
                    status: "SUSPENDED",
                    amountPaid: data.amountPaid || 0,
                    balance: data.balance ?? data.total,
                    notes: data.notes || null,
                    items: {
                        create: data.cart.map(item => ({
                            variantId: item.variantId,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                } as any
            });
        } catch (notesErr: any) {
            // Si falla por el campo notes (columna no migrada aún), reintentar sin él
            if (notesErr.message?.includes('notes') || notesErr.code === 'P2009') {
                sale = await prisma.sale.create({
                    data: {
                        total: data.total,
                        subtotal: data.subtotal,
                        discount: data.discount,
                        priceTierId: data.priceTierId || null,
                        clientId: data.clientId || null,
                        locationId: locationId,
                        sellerId: sellerId,
                        status: "SUSPENDED",
                        amountPaid: data.amountPaid || 0,
                        balance: data.balance ?? data.total,
                        items: {
                            create: data.cart.map(item => ({
                                variantId: item.variantId,
                                quantity: item.quantity,
                                price: item.price
                            }))
                        }
                    }
                });
            } else {
                throw notesErr;
            }
        }

        revalidatePath("/pos");
        return { success: true, saleId: sale.id };
    } catch (error: any) {
        console.error("Suspend Sale Error:", error);
        return { success: false, error: `Error al suspender: ${error?.message || error?.code || JSON.stringify(error)}` };
    }
}

export async function createLayaway(data: {
    cart: any[];
    total: number;
    subtotal: number;
    discount: number;
    initialPayment: number;
    paymentMethodName: string;
    dueDate: Date;
    priceTierId?: string | null;
    cashSessionId?: string | null;
}) {
    try {
        const user = await getSessionUser();
        const locationId = user?.locationId || null;
        const sellerId = user?.id || null;

        let paymentMethodId = null;
        if (data.paymentMethodName) {
            const pm = await prisma.paymentMethod.findFirst({
                where: { name: data.paymentMethodName, isActive: true }
            });
            if (pm) paymentMethodId = pm.id;
        }

        const sale = await prisma.$transaction(async (tx) => {
            const createdSale = await tx.sale.create({
                data: {
                    total: data.total,
                    subtotal: data.subtotal,
                    discount: data.discount,
                    priceTierId: data.priceTierId || null,
                    locationId: locationId,
                    sellerId: sellerId,
                    status: "LAYAWAY",
                    amountPaid: data.initialPayment,
                    balance: data.total - data.initialPayment,
                    dueDate: data.dueDate,
                    paymentMethodId: paymentMethodId,
                    cashSessionId: data.cashSessionId || null,
                    items: {
                        create: data.cart.map(item => ({
                            variantId: item.variantId,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    },
                    layawayPayments: {
                        create: {
                            amount: data.initialPayment,
                            paymentMethodId: paymentMethodId,
                            cashSessionId: data.cashSessionId || null
                        }
                    }
                }
            });

            // Update inventory and create movements (Items are reserved/out of stock on layaway)
            for (const item of data.cart) {
                await tx.inventoryMovement.create({
                    data: {
                        variantId: item.variantId,
                        type: "SALE",
                        quantity: -item.quantity,
                        reason: `Layaway ID: ${createdSale.id}`,
                        locationId: locationId
                    }
                });

                await tx.variant.update({
                    where: { id: item.variantId },
                    data: {
                        stock: {
                            decrement: item.quantity
                        }
                    }
                });
            }

            return createdSale;
        });

        revalidatePath("/pos");
        revalidatePath("/inventory");
        return { success: true, saleId: sale.id };
    } catch (error: any) {
        console.error("Create Layaway Error:", error);
        return { success: false, error: 'Ocurrió un error al crear el apartado.' };
    }
}

export async function addLayawayPayment(saleId: string, amount: number, paymentMethodName: string, cashSessionId?: string | null) {
    try {
        let paymentMethodId = null;
        if (paymentMethodName) {
            const pm = await prisma.paymentMethod.findFirst({
                where: { name: paymentMethodName, isActive: true }
            });
            if (pm) paymentMethodId = pm.id;
        }

        const updatedSale = await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findUnique({ where: { id: saleId } });
            if (!sale) throw new Error("Venta no encontrada");
            if (sale.status !== "LAYAWAY") throw new Error("La venta no está en modo apartado");
            if (amount <= 0 || amount > sale.balance) throw new Error("Monto de abono inválido");

            const newBalance = sale.balance - amount;
            const newAmountPaid = sale.amountPaid + amount;
            const newStatus = newBalance <= 0 ? "COMPLETED" : "LAYAWAY";

            await tx.layawayPayment.create({
                data: {
                    saleId: sale.id,
                    amount: amount,
                    paymentMethodId: paymentMethodId,
                    cashSessionId: cashSessionId || null
                }
            });

            return await tx.sale.update({
                where: { id: sale.id },
                data: {
                    balance: newBalance,
                    amountPaid: newAmountPaid,
                    status: newStatus
                }
            });
        });

        revalidatePath("/dashboard");
        revalidatePath("/pos");
        return { success: true, newBalance: updatedSale.balance, status: updatedSale.status };
    } catch (error: any) {
        console.error("Add Layaway Payment Error:", error);
        return { success: false, error: error.message || 'Ocurrió un error al registrar el abono.' };
    }
}

export async function processSale(data: {
    cart: {
        variantId: string;
        quantity: number;
        price: number;
    }[];
    total: number;
    subtotal: number;
    discount: number;
    paymentMethodName: string;
    clientId?: string | null;
    priceTierId?: string | null;
    isReturn?: boolean;
    cashSessionId?: string | null;
    amountPaid?: number;
}) {
    try {
        const user = await getSessionUser();
        const locationId = user?.locationId || null;

        // Owner logic — resolver el vendedor correcto para todos los roles:
        // SELLER → su propio id
        // CASHIER de "Mi Equipo" → managedBySellerId
        // CASHIER/MANAGER con locationId → sellerId de la locación
        // ADMIN → null (venta global)
        let ownerId = await getEffectiveSellerId(user);
        if (!ownerId && locationId) {
            const loc = await prisma.storeLocation.findUnique({
                where: { id: locationId },
                select: { sellerId: true }
            });
            if (loc?.sellerId) ownerId = loc.sellerId;
        }

        // Buyer matching logic
        let matchedBuyerId = null;
        if (data.clientId) {
            const client = await prisma.client.findUnique({ where: { id: data.clientId } });
            if (client?.email) {
                const buyerUser = await prisma.user.findFirst({
                    where: { email: client.email, role: 'BUYER' }
                });
                if (buyerUser) matchedBuyerId = buyerUser.id;
            }
        }

        // Find payment method ID from name
        let paymentMethodId = null;
        if (data.paymentMethodName) {
            const pm = await prisma.paymentMethod.findFirst({
                where: { name: data.paymentMethodName, isActive: true }
            });
            if (pm) paymentMethodId = pm.id;
        }

        // Inside a transaction
        const sale = await prisma.$transaction(async (tx) => {
            const isStoreCredit = data.paymentMethodName === 'Crédito de Tienda';
            if (isStoreCredit && !data.clientId) {
                throw new Error("Debe seleccionar un cliente para procesar una venta a crédito.");
            }

            let finalStatus = "COMPLETED";
            if (data.isReturn) finalStatus = "REFUNDED";
            else if (isStoreCredit) finalStatus = "STORE_CREDIT";

            const createdSale = await tx.sale.create({
                data: {
                    total: data.total,
                    subtotal: data.subtotal,
                    discount: data.discount,
                    paymentMethodId: paymentMethodId,
                    clientId: data.clientId || null,
                    buyerId: matchedBuyerId,
                    priceTierId: data.priceTierId || null,
                    cashSessionId: data.cashSessionId || null,
                    locationId: locationId,
                    sellerId: ownerId,
                    status: finalStatus,
                    items: {
                        create: data.cart.map(item => ({
                            variantId: item.variantId,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                }
            });

            const lowStockItems: any[] = [];
            for (const item of data.cart) {
                // Determine inventory movement type
                let movementType = "SALE";
                if (data.isReturn || item.quantity < 0) {
                    movementType = "RETURN";
                }

                await tx.inventoryMovement.create({
                    data: {
                        variantId: item.variantId,
                        type: movementType,
                        quantity: -item.quantity, // Sale (-), Return (+)
                        reason: `Sale ID: ${createdSale.id}`,
                        locationId: locationId
                    }
                });

                const updatedVariant = await tx.variant.update({
                    where: { id: item.variantId },
                    data: {
                        stock: {
                            decrement: item.quantity
                        }
                    },
                    include: { product: true }
                });

                if (updatedVariant.stock <= 5 && !data.isReturn && item.quantity > 0) {
                    lowStockItems.push({
                        productName: updatedVariant.product.name,
                        variantName: `${updatedVariant.color || ''} ${updatedVariant.size || ''}`.trim(),
                        stock: updatedVariant.stock
                    });
                }
            }

            if (lowStockItems.length > 0) {
                const seller = await tx.user.findUnique({
                    where: { id: ownerId! },
                    select: { email: true, name: true }
                });
                if (seller?.email) {
                    await sendLowInventoryAlert({
                        sellerEmail: seller.email,
                        sellerName: seller.name || 'Vendedor',
                        items: lowStockItems
                    });
                }
            }

            if (data.paymentMethodName === 'Crédito de Tienda' && data.clientId) {
                // If the sale is a return on store credit, maybe we *add* credit, 
                // but normally standard sales decrement storeCredit (increased debt).
                const amountDiff = data.isReturn ? data.total : -data.total;
                await tx.client.update({
                    where: { id: data.clientId },
                    data: {
                        storeCredit: {
                            increment: amountDiff
                        }
                    }
                });
            }

            // Fetch the updated sale with database generated defaults
            return await tx.sale.findUnique({
                where: { id: createdSale.id }
            });
        });

        revalidatePath("/pos");
        revalidatePath("/inventory");
        return { success: true, saleId: sale!.id };
    } catch (error: any) {
        console.error("Sale Processing Error:", error);
        return { success: false, error: 'Ocurrió un error al procesar la venta.' };
    }
}

export async function addStoreAccountPayment(clientId: string, amount: number, paymentMethodName: string, cashSessionId?: string | null) {
    try {
        let paymentMethodId = null;
        if (paymentMethodName) {
            const pm = await prisma.paymentMethod.findFirst({
                where: { name: paymentMethodName, isActive: true }
            });
            if (pm) paymentMethodId = pm.id;
        }

        const client = await prisma.$transaction(async (tx) => {
            await tx.storeAccountPayment.create({
                data: {
                    clientId,
                    amount,
                    type: "PAYMENT",
                    paymentMethodId,
                    cashSessionId: cashSessionId || null,
                    notes: `Abono mediante ${paymentMethodName}`
                }
            });

            return await tx.client.update({
                where: { id: clientId },
                data: {
                    storeCredit: {
                        increment: amount
                    }
                }
            });
        });

        // Add a cash movement directly to the active session since it's an outside income
        if (cashSessionId) {
            await prisma.cashMovement.create({
                data: {
                    sessionId: cashSessionId,
                    type: "IN",
                    amount: amount,
                    reason: `Abono de Cuenta: Cliente ${client.name}`
                }
            });
        }

        revalidatePath("/dashboard");
        revalidatePath("/pos");
        return { success: true, newBalance: client.storeCredit };
    } catch (error: any) {
        console.error("Store Account Payment Error:", error);
        return { success: false, error: error.message || 'Ocurrió un error al registrar el abono corporativo.' };
    }
}

export async function deleteSale(saleId: string) {
    try {
        const user = await getSessionUser();
        // Option to verify if the user has permission to delete (like being the seller of the sale)

        const result = await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findUnique({
                where: { id: saleId },
                include: { items: true, layawayPayments: true }
            });

            if (!sale) throw new Error("Venta no encontrada.");
            if (sale.status === "CANCELLED") throw new Error("La venta ya está cancelada.");

            // 1. Revert Inventory
            for (const item of sale.items) {
                // If it was a sale, we increment stock to revert it. If it was a return, we decrement it.
                const revertQty = sale.status === "REFUNDED" ? -item.quantity : item.quantity;
                
                await tx.inventoryMovement.create({
                    data: {
                        variantId: item.variantId,
                        type: "ADJUSTMENT",
                        quantity: revertQty,
                        reason: `Cancelación Venta ID: ${sale.id}`,
                        locationId: sale.locationId
                    }
                });

                await tx.variant.update({
                    where: { id: item.variantId },
                    data: { stock: { increment: revertQty } }
                });
            }

            // 2. Revert Store Credit if applicable
            if (sale.status === "STORE_CREDIT" && sale.clientId) {
                await tx.client.update({
                    where: { id: sale.clientId },
                    data: { storeCredit: { increment: sale.total } } // they 'owe' less now
                });
            }

            // 3. Mark as cancelled
            const updatedSale = await tx.sale.update({
                where: { id: saleId },
                data: { status: "CANCELLED" }
            });

            return updatedSale;
        });

        revalidatePath("/dashboard");
        revalidatePath("/pos");
        revalidatePath("/inventory");
        return { success: true };
    } catch (error: any) {
        console.error("Delete Sale Error:", error);
        return { success: false, error: error.message || "Ocurrió un error al cancelar la venta." };
    }
}

export async function getSaleById(saleId: string) {
    try {
        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: {
                items: { include: { variant: { include: { product: true } } } },
                client: true,
                paymentMethod: true,
                priceTier: true
            }
        });
        return sale;
    } catch (error) {
        console.error("Error fetching sale:", error);
        return null;
    }
}

export async function updateSale(saleId: string, data: {
    cart: any[];
    subtotal: number;
    total: number;
    discount: number;
    paymentMethodName: string;
    clientId?: string | null;
    priceTierId?: string | null;
    isReturn?: boolean;
}) {
    try {
        const user = await getSessionUser();
        const sellerId = user?.id || null; // Could override if an admin is editing, but typical is maintaining.

        let paymentMethodId = null;
        if (data.paymentMethodName) {
            const pm = await prisma.paymentMethod.findFirst({
                where: { name: data.paymentMethodName, isActive: true }
            });
            if (pm) paymentMethodId = pm.id;
        }

        const isStoreCredit = data.paymentMethodName === 'Crédito de Tienda';
        if (isStoreCredit && !data.clientId) {
            throw new Error("Debe seleccionar un cliente para procesar una venta a crédito.");
        }

        const result = await prisma.$transaction(async (tx) => {
            const oldSale = await tx.sale.findUnique({
                where: { id: saleId },
                include: { items: true }
            });
            
            if (!oldSale) throw new Error("Venta no encontrada.");

            // 1. Revert Old Items Inventory
            for (const item of oldSale.items) {
                const revertQty = oldSale.status === "REFUNDED" ? -item.quantity : item.quantity;
                await tx.inventoryMovement.create({
                    data: {
                        variantId: item.variantId,
                        type: "ADJUSTMENT",
                        quantity: revertQty,
                        reason: `Reversión por Edición Venta ID: ${oldSale.id}`,
                        locationId: oldSale.locationId
                    }
                });
                await tx.variant.update({
                    where: { id: item.variantId },
                    data: { stock: { increment: revertQty } }
                });
            }

            // 2. Clear Old Items
            await tx.saleItem.deleteMany({
                where: { saleId: saleId }
            });

            // 3. Revert Old Store Credit logic if it was a credit
            if (oldSale.status === "STORE_CREDIT" && oldSale.clientId) {
                 // A STORE_CREDIT sale meant they owed us money.
                 // We revert that by decrementing what they owe (incrementing conceptually, wait).
                 // Actually they bought something on credit, so `storeCredit` goes UP (debt).
                 // Reverting it means `storeCredit` goes DOWN.
                 await tx.client.update({
                     where: { id: oldSale.clientId },
                     data: { storeCredit: { decrement: oldSale.total } } 
                 });
            }

            // 4. Determine New Status & Apply changes
            let finalStatus = "COMPLETED";
            if (data.isReturn) finalStatus = "REFUNDED";
            else if (isStoreCredit) finalStatus = "STORE_CREDIT";
            else if (oldSale.status === "LAYAWAY" || oldSale.status === "SUSPENDED" || oldSale.status === "CANCELLED") {
                // If the user decides to edit a layaway or suspended and transform it
                // Usually an edit maintains type, but let's assume it becomes a normal sale or takes new explicit type
                finalStatus = oldSale.status; 
            }

            // 5. Update Sale properties and replace Items
            const updatedSale = await tx.sale.update({
                where: { id: saleId },
                data: {
                    total: data.total,
                    subtotal: data.subtotal,
                    discount: data.discount,
                    paymentMethodId: paymentMethodId,
                    clientId: data.clientId || null,
                    priceTierId: data.priceTierId || null,
                    status: finalStatus,
                    items: {
                        create: data.cart.map(item => ({
                            variantId: item.variantId,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                }
            });

            // 6. Deduct New Items from Inventory
            for (const item of data.cart) {
                let movementType = "SALE";
                if (data.isReturn || item.quantity < 0) movementType = "RETURN";

                await tx.inventoryMovement.create({
                    data: {
                        variantId: item.variantId,
                        type: movementType,
                        quantity: -item.quantity, // Sale (-), Return (+)
                        reason: `Edición Venta ID: ${updatedSale.id}`,
                        locationId: oldSale.locationId
                    }
                });

                await tx.variant.update({
                    where: { id: item.variantId },
                    data: { stock: { decrement: item.quantity } }
                });
            }

            // 7. Apply New Store Credit if needed
            if (isStoreCredit && data.clientId) {
                const amountDiff = data.isReturn ? data.total : -data.total;
                await tx.client.update({
                    where: { id: data.clientId },
                    data: { storeCredit: { increment: amountDiff } }
                });
            }
            
            return await tx.sale.findUnique({
                where: { id: updatedSale.id }
            });
        });

        revalidatePath("/pos");
        revalidatePath("/dashboard");
        revalidatePath("/inventory");
        return { success: true, saleId: result!.id, receiptNumber: (result as any).receiptNumber };
    } catch (error: any) {
        console.error("Sale Update Processing Error:", error);
        return { success: false, error: error.message || 'Ocurrió un error al actualizar la venta.' };
    }
}

export async function bulkCreateProducts(products: any[]) {
    console.log(`Bulk creating ${products.length} products`);
    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
    };

    for (const data of products) {
        try {
            const res = await createProduct(data);
            if (res.success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push(`${data.name}: ${res.error}`);
            }
        } catch (error: any) {
            results.failed++;
            results.errors.push(`${data.name}: Error inesperado`);
        }
    }

    revalidatePath("/inventory");
    revalidatePath("/pos");
    return results;
}

export async function getSuspendedSales() {
    try {
        const user = await getSessionUser();
        const locationId = user?.locationId || null;

        const sellerId = await getEffectiveSellerId(user);

        const sales = await (prisma.sale as any).findMany({
            where: {
                status: "SUSPENDED",
                locationId: locationId,
                sellerId: sellerId
            },
            include: {
                client: true,
                items: {
                    include: {
                        variant: {
                            include: {
                                product: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return sales;
    } catch (error: any) {
        console.error("Fetch Suspended Sales Error:", error);
        return [];
    }
}

export async function deleteSuspendedSale(saleId: string) {
    try {
        const user = await getSessionUser();
        // Solo SELLER y ADMIN pueden eliminar ventas suspendidas
        if (!user || user.role === 'CASHIER') {
            return { success: false, error: 'No autorizado' };
        }
        await prisma.sale.delete({
            where: { id: saleId }
        });
        revalidatePath("/pos");
        return { success: true };
    } catch (error: any) {
        console.error("Delete Suspended Sale Error:", error);
        return { success: false };
    }
}

// Payment Methods
export async function getPaymentMethods() {
    try {
        const user = await getSessionUser();
        if (!user) return [];

        // Formas de pago del vendedor + siempre incluir Efectivo global
        const effectiveSellerId = await getEffectiveSellerId(user);
        const sellerMethods = await prisma.paymentMethod.findMany({
            where: {
                isActive: true,
                sellerId: user.role === 'ADMIN' ? undefined : effectiveSellerId
            },
            orderBy: { createdAt: 'asc' }
        });

        // Garantizar que Efectivo aparezca siempre (es universal, sin sellerId)
        let globalEfectivo = await prisma.paymentMethod.findFirst({
            where: { type: 'CASH', sellerId: null, isActive: true }
        });

        if (!globalEfectivo) {
            globalEfectivo = await prisma.paymentMethod.create({
                data: { name: 'Efectivo', type: 'CASH', isActive: true, sellerId: null }
            });
        }

        // Combinar: Efectivo global primero, luego métodos propios del vendedor que NO sean CASH
        // (CASH ya está cubierto por globalEfectivo — no duplicar)
        const sellerCustomMethods = sellerMethods.filter(m => m.type !== 'CASH');

        return [globalEfectivo, ...sellerCustomMethods];
    } catch (error) {
        console.error('Error en getPaymentMethods:', error);
        return [];
    }
}

// Price Tiers
export async function getPriceTiers() {
    try {
        const user = await getSessionUser();
        if (!user) return [];
        const effectiveSellerId = await getEffectiveSellerId(user);
        const where = user.role === 'ADMIN' ? {} : { sellerId: effectiveSellerId };
        return await prisma.priceTier.findMany({
            where,
            orderBy: { order: 'asc' }
        });
    } catch (error) {
        return [];
    }
}

// Price Tiers CRUD
export async function createPriceTier(data: {
    name: string;
    discountPercentage?: number | null;
    defaultPriceMinusFixed?: number | null;
    minQuantity?: number;
    autoApplyMarketplace?: boolean;
    autoApplyPOS?: boolean;
    manualPOS?: boolean;
}) {
    try {
        const user = await getSessionUser();
        const tier = await (prisma.priceTier as any).create({
            data: {
                name: data.name,
                discountPercentage: data.discountPercentage ?? null,
                defaultPriceMinusFixed: data.defaultPriceMinusFixed ?? null,
                minQuantity: data.minQuantity ?? 0,
                autoApplyMarketplace: data.autoApplyMarketplace ?? false,
                autoApplyPOS: data.autoApplyPOS ?? false,
                manualPOS: data.manualPOS ?? true,
                sellerId: user?.id || null,
            }
        });
        revalidatePath("/pos");
        revalidatePath("/settings/price-tiers");
        return { success: true, tier };
    } catch (error) {
        console.error("createPriceTier error:", error);
        return { success: false };
    }
}

export async function updatePriceTier(id: string, data: Partial<{
    autoApplyMarketplace: boolean;
    autoApplyPOS: boolean;
    manualPOS: boolean;
    minQuantity: number;
    discountPercentage: number | null;
    defaultPriceMinusFixed: number | null;
}>) {
    try {
        await (prisma.priceTier as any).update({
            where: { id },
            data
        });
        revalidatePath("/pos");
        revalidatePath("/settings/price-tiers");
        return { success: true };
    } catch (error) {
        console.error("updatePriceTier error:", error);
        return { success: false };
    }
}

export async function updatePriceTierOrder(orderedIds: string[]) {
    try {
        for (let i = 0; i < orderedIds.length; i++) {
            await prisma.priceTier.update({
                where: { id: orderedIds[i] },
                data: { order: i }
            });
        }
        revalidatePath("/pos");
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

export async function deletePriceTier(id: string) {
    try {
        await prisma.priceTier.delete({ where: { id } });
        revalidatePath("/pos");
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

// Payment Methods CRUD
export async function createPaymentMethod(data: { name: string, type: string }) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false };
        // No permitir crear Efectivo duplicado (es global)
        if (data.type === 'CASH') {
            return { success: false, error: 'El método de Efectivo es global y no puede duplicarse. Usa otro tipo.' };
        }
        const method = await prisma.paymentMethod.create({
            data: {
                name: data.name,
                type: data.type,
                sellerId: user.id  // Vinculado al vendedor
            }
        });
        revalidatePath('/pos');
        revalidatePath('/settings/payment-methods');
        return { success: true, method };
    } catch (error) {
        return { success: false };
    }
}

export async function deletePaymentMethod(id: string) {
    try {
        const method = await prisma.paymentMethod.findUnique({ where: { id } });
        if (!method) return { success: false, error: 'Método no encontrado' };
        // No permitir borrar el Efectivo global
        if (method.type === 'CASH' && method.sellerId === null) {
            return { success: false, error: 'El Efectivo es universal y no puede eliminarse.' };
        }
        await prisma.paymentMethod.delete({ where: { id } });
        revalidatePath('/pos');
        revalidatePath('/settings/payment-methods');
        return { success: true };
    } catch (error) {
        console.error('Error al eliminar método de pago:', error);
        return { success: false, error: 'Error al eliminar el registro.' };
    }
}

export async function getCategories() {
    try {
        const categories = await prisma.category.findMany({
            include: { subcategories: true },
            orderBy: { name: 'asc' }
        });
        const seen = new Set();
        return categories.filter(cat => {
            if (seen.has(cat.name)) return false;
            seen.add(cat.name);
            return true;
        });
    } catch (error) {
        return [];
    }
}

// Solo devuelve categorías en las que el vendedor tiene productos activos
// Se usa en el catálogo del POS (MOSTRAR/OCULTAR CATÁLOGO)
export async function getPOSCategories() {
    try {
        const user = await getSessionUser();
        if (!user) return [];
        const effectiveSellerId = await getEffectiveSellerId(user);
        const sellerFilter = user.role === 'ADMIN' ? {} : { sellerId: effectiveSellerId };

        // Obtener categoryIds únicos de los productos del vendedor
        const products = await prisma.product.findMany({
            where: { isActive: true, ...sellerFilter },
            select: { categoryId: true },
        });

        const categoryIds = [...new Set(
            products.map(p => p.categoryId).filter(Boolean)
        )] as string[];

        if (categoryIds.length === 0) return [];

        const categories = await prisma.category.findMany({
            where: { id: { in: categoryIds } },
            include: { subcategories: true },
            orderBy: { name: 'asc' }
        });

        return categories;
    } catch (error) {
        console.error('getPOSCategories error:', error);
        return [];
    }
}

export async function getBrands() {
    try {
        return await prisma.brand.findMany({
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        return [];
    }
}

export async function createBrand(name: string) {
    try {
        if (!name.trim()) return { success: false, error: "El nombre no puede estar vacío" };
        const existing = await prisma.brand.findFirst({
            where: { name: { equals: name.trim(), mode: 'insensitive' } }
        });
        if (existing) return { success: true, brand: existing };
        
        const brand = await prisma.brand.create({
            data: { name: name.trim() }
        });
        return { success: true, brand };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function createSubcategory(name: string, categorySlug: string) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') return { success: false, error: "No tienes permisos para realizar esta acción" };

        if (!name.trim() || !categorySlug) return { success: false, error: "Nombre y Categoría requeridos" };
        
        let category = await prisma.category.findUnique({ where: { slug: categorySlug } });
        if (!category) {
            category = await prisma.category.create({
                data: { name: categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1), slug: categorySlug }
            });
        }

        const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const existing = await prisma.subcategory.findFirst({
            where: { slug, categoryId: category.id }
        });
        
        if (existing) return { success: true, subcategory: existing };

        const subcategory = await prisma.subcategory.create({
            data: {
                name: name.trim(),
                slug,
                categoryId: category.id
            }
        });
        return { success: true, subcategory };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteProduct(productId: string) {
    try {
        await prisma.product.update({
            where: { id: productId },
            data: { isActive: false }
        });
        revalidatePath("/inventory");
        revalidatePath("/pos");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting product:", error);
        return { success: false, error: "No se pudo eliminar el producto, puede tener ventas activas ligadas." };
    }
}

export async function getSuppliers() {
    try {
        const user = await getSessionUser();
        return await (prisma as any).supplier.findMany({
            where: { sellerId: user?.id || null, isActive: true },
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        return [];
    }
}

export async function createSupplier(name: string) {
    try {
        const user = await getSessionUser();
        if (!name.trim()) return { success: false, error: "El nombre del proveedor no puede estar vacío" };
        
        const existing = await (prisma as any).supplier.findFirst({
            where: { name: { equals: name.trim(), mode: 'insensitive' } }
        });
        
        if (existing) return { success: true, supplier: existing };
        
        const supplier = await (prisma as any).supplier.create({
            data: { 
                name: name.trim(),
                sellerId: user?.id || null
            }
        });
        
        revalidatePath("/inventory");
        return { success: true, supplier };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ---------------------------------------------------------------------------
// GENERACIÓN MASIVA DE SKUs PARA PRODUCTOS EXISTENTES
// ---------------------------------------------------------------------------

export async function generateMissingSKUs() {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: 'No autorizado', updated: 0 };

        const effectiveSellerId = await getEffectiveSellerId(user);
        const whereClause: any = {
            isActive: true,
            OR: [{ sku: null }, { sku: '' }]
        };
        if (user.role !== 'ADMIN') whereClause.sellerId = effectiveSellerId;

        const products = await prisma.product.findMany({
            where: whereClause,
            include: {
                category: true,
                brand: true,
                subcategory: true,
            }
        });

        let updated = 0;
        const usedSKUs = new Set<string>();

        // Cargar SKUs ya existentes para evitar duplicados
        const existing = await prisma.product.findMany({
            where: { sku: { not: null } },
            select: { sku: true }
        });
        existing.forEach(p => p.sku && usedSKUs.add(p.sku));

        for (const product of products) {
            const catCode = (product.category?.name || 'XX')
                .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '').slice(0, 2);

            const subcatCode = (product.subcategory?.name || '')
                .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '').slice(0, 2);

            const brandCode = (product.brand?.name || '')
                .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '').slice(0, 2);

            const modelNumber = product.name.replace(/[^0-9]/g, '').slice(0, 6);

            let baseSku = `${catCode}${subcatCode}${brandCode}${modelNumber}`.slice(0, 20);
            if (!baseSku) baseSku = `PROD${product.id.slice(-6).toUpperCase()}`;

            // Asegurar unicidad
            let finalSku = baseSku;
            let counter = 1;
            while (usedSKUs.has(finalSku)) {
                finalSku = `${baseSku}${counter++}`;
            }
            usedSKUs.add(finalSku);

            await prisma.product.update({
                where: { id: product.id },
                data: { sku: finalSku }
            });
            updated++;
        }

        revalidatePath('/products');
        revalidatePath('/inventory');
        return { success: true, updated };
    } catch (error: any) {
        console.error('generateMissingSKUs error:', error);
        return { success: false, error: error.message, updated: 0 };
    }
}

export async function updateSaleNotes(saleId: string, notes: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: 'No autorizado' };
        const effectiveSellerId = await getEffectiveSellerId(user);
        // Verificar que la venta pertenece al vendedor
        const sale = await prisma.sale.findFirst({
            where: { id: saleId, sellerId: effectiveSellerId }
        });
        if (!sale) return { success: false, error: 'Venta no encontrada' };
        await prisma.sale.update({
            where: { id: saleId },
            data: { notes }
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

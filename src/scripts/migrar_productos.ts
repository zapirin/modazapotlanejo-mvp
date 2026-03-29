import { PrismaClient } from '../generated/client';
import * as xlsx from 'xlsx';

const prisma = new PrismaClient();

function mapCategory(legacyCategory: string | undefined): string {
    if (!legacyCategory) return 'DAMAS';
    const upper = legacyCategory.toUpperCase();
    if (upper.includes('CABALLERO') || upper.includes('HOMBRE')) return 'CABALLEROS';
    if (upper.includes('NIÑ') || upper.includes('CHICO') || upper.includes('BEB')) return 'NIÑOS';
    if (upper.includes('ACCESORIO') || upper.includes('LENTE') || upper.includes('BOLSA')) return 'ACCESORIOS';
    if (upper.includes('CALZADO') || upper.includes('ZAPATO') || upper.includes('TENIS')) return 'CALZADO';
    return 'DAMAS';
}

async function main() {
    console.log("Iniciando fusión inteligente de items_export.xlsx (Catálogo) y inventory_list.xlsx (Stock)...");
    
    // 1. Obtener al vendedor Kalexa
    const seller = await prisma.user.findUnique({
        where: { email: 'kalexa.fashion@gmail.com' }
    });
    if (!seller) throw new Error("No se encontró al vendedor 'kalexa.fashion@gmail.com'.");

    const categoriesList = await prisma.category.findMany();
    const categoriesMap = new Map();
    for (const cat of categoriesList) categoriesMap.set(cat.name, cat.id);
    
    // 2. Cargar Excel #1: Catálogo (Descripciones, Precios)
    const itemsWb = xlsx.readFile('/Users/juandelatorredelreal/Downloads/items_export.xlsx');
    const itemsData: any[] = xlsx.utils.sheet_to_json(itemsWb.Sheets[itemsWb.SheetNames[0]]);
    
    const itemsMap = new Map<string, any>();
    for (const row of itemsData) {
        if (row['Id del artículo']) {
            itemsMap.set(String(row['Id del artículo']), {
                ...row,
                stockReal: 0 // Valor inicial para posteriormente rellenarlo con Excel #2
            });
        }
    }
    console.log(` -> Excel #1 (Catálogo) procesado en memoria: ${itemsMap.size} identificadores leídos.`);

    // 3. Cargar Excel #2: Inventario (Cantidades Reales)
    const invWb = xlsx.readFile('/Users/juandelatorredelreal/Downloads/inventory_list.xlsx');
    const invData: any[] = xlsx.utils.sheet_to_json(invWb.Sheets[invWb.SheetNames[0]]);
    
    let inventariosAsignados = 0;
    for (const row of invData) {
        if (row['Id del artículo']) {
            const legacyId = String(row['Id del artículo']);
            const item = itemsMap.get(legacyId);
            if (item) {
                // Rellenar existencias combinando el dato del Archivo #2 al Archivo #1
                item.stockReal = Number(row['Cantidad']) || 0;
                inventariosAsignados++;
            }
        }
    }
    console.log(` -> Excel #2 (Inventario) procesado: ${inventariosAsignados} existencias asignadas a los modelos base.`);

    // 4. Transformar a estructura "Prisma" identificando Maestros vs Variantes
    const masterObjMap = new Map<string, any>();
    const seenSkus = new Set<string>();

    //   4.1 Primera Vulta: Solo Productos Maestros (IDs sin símbolo #)
    for (const item of itemsMap.values()) {
        const legacyId = String(item['Id del artículo']);
        
        if (!legacyId.includes('#')) {
            const categoryId = categoriesMap.get(mapCategory(item['Categoría'])) || null;
            const newProductId = `mig-prod-${legacyId}`;
            
            let safeSku = item['Número de artículo'] ? String(item['Número de artículo']).trim() : `UNKNOWN-${legacyId}`;
            // Prevenir SKU duplicados alterándolos ligeramente
            if (seenSkus.has(safeSku)) {
                safeSku = `${safeSku}-COPY-${legacyId}`;
            }
            if (seenSkus.has(safeSku)) { // Segunda comprobación
                safeSku = `${safeSku}-${Math.floor(Math.random() * 100)}`;
            }
            seenSkus.add(safeSku);

            masterObjMap.set(legacyId, {
                id: newProductId,
                name: String(item['Nombre']).trim(),
                description: (item['descripción larga'] || item['Descripción'] || "").trim() || null,
                price: Number(item['Precio de venta']) || 0,
                cost: Number(item['Costo']) || null,
                sku: safeSku,
                sellerId: seller.id,
                categoryId: categoryId,
                isActive: true,
                isOnline: true,
                isPOS: true,
                // Campos temporales para agrupación
                _sizesSet: new Set<string>(),
                _totalStock: item.stockReal || 0,
                variantOptions: [],
                variantsToInsert: []
            });
        }
    }

    //   4.2 Segunda Vuelta: Variantes/Tallas (IDs CON símbolo #)
    let variantsSequentialId = 1;
    for (const item of itemsMap.values()) {
        const legacyId = String(item['Id del artículo']);
        
        if (legacyId.includes('#')) {
            const masterLegacyId = legacyId.split('#')[0];
            const variantSubId = legacyId.split('#')[1];
            const master = masterObjMap.get(masterLegacyId);
            const stock = item.stockReal || 0;

            // ¡FILTRO ESTRICTO DE STOCK PARA LA TALLA! (> 0)
            if (master && stock > 0) {
                const variationStr = item['Variación'] || item['Nombre'];
                let parsedSize = variationStr ? String(variationStr).replace(/talla/i, '').replace(':', '').trim() : "Única";
                
                master._sizesSet.add(parsedSize);
                master._totalStock += stock;

                let varSku = `${master.sku}-${variantSubId}`;
                if (seenSkus.has(varSku)) {
                    varSku = `${varSku}-V${variantsSequentialId}`;
                }
                seenSkus.add(varSku);

                master.variantsToInsert.push({
                    id: `mig-var-${variantsSequentialId++}`,
                    productId: master.id,
                    size: parsedSize,
                    sku: varSku,
                    stock: stock
                });
            }
        }
    }

    // 5. Filtración final de Maestros sin stock y generación del Menú JSON
    const dbProducts = [];
    const dbVariants = [];

    for (const master of masterObjMap.values()) {
        // ¡FILTRO ESTRICTO DE STOCK PARA EL MAESTRO! (> 0)
        if (master._totalStock > 0) {
            
            // Si tiene tallas agrupadas, generamos el variantOptions JSON
            if (master._sizesSet.size > 0) {
                master.variantOptions = [{
                    name: "Tamaño",
                    values: Array.from(master._sizesSet)
                }];
            } else {
                master.variantOptions = null;
            }

            dbVariants.push(...master.variantsToInsert);

            // Borramos los apuntadores de memoria cruda que Prisma rechazaría
            delete master._sizesSet;
            delete master._totalStock;
            delete master.variantsToInsert;

            dbProducts.push(master);
        }
    }

    console.log(`\n¡Cruce Inteligente Concluido!`);
    console.log(`Se insertarán en BD: ${dbProducts.length} Modelos y ${dbVariants.length} Tallas específicas que pasaron el filtro (> 0 stock).\n`);

    if (dbProducts.length === 0) {
        console.warn("ALERTA: El inventario procesado es de 0 en todos los campos. Terminando de manera segura.");
        return;
    }

    console.log("Desalojando posibles iteraciones viejas de la base de datos...");
    await prisma.variant.deleteMany({ where: { id: { startsWith: 'mig-var-' } } });
    await prisma.product.deleteMany({ where: { id: { startsWith: 'mig-prod-' } } });

    console.log(`Guardando nuevos Modelos agrupados (En lotes de 500 para optimización)...`);
    const chunkSize = 500;
    for (let i = 0; i < dbProducts.length; i += chunkSize) {
        const chunk = dbProducts.slice(i, i + chunkSize);
        await prisma.product.createMany({ data: chunk });
    }

    console.log(`Guardando Inventarios y Tallas de Modelos...`);
    for (let i = 0; i < dbVariants.length; i += chunkSize) {
        const chunk = dbVariants.slice(i, i + chunkSize);
        await prisma.variant.createMany({ data: chunk });
    }

    console.log("¡Todo migrado y configurado estéticamente con éxito!");
}

main().catch(e => {
    console.error("Fallo durante la migración unificada:", e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});

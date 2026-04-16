import { PrismaClient } from '../generated/client';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Configuración de MySQL ( kale_pos )
const mysqlConfig = {
    host: '127.0.0.1',
    user: 'root',
    password: 'hSZ6XCn3tF8w3M',
    database: 'kale_pos'
};

const UPLOADS_DIR = '/var/www/modazapo/uploads';

async function main() {
    console.log("Iniciando extracción de imágenes desde MySQL BLOBs...");

    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const connection = await mysql.createConnection(mysqlConfig);

    try {
        // 1. Obtener la relación de items e imágenes
        // phppos_item_images vincula item_id con image_id
        // phppos_app_files contiene el binario (file_data) y el nombre (file_name)
        const [rows]: any = await connection.execute(`
            SELECT 
                ii.item_id, 
                ii.image_id, 
                af.file_name, 
                af.file_data 
            FROM phppos_item_images ii
            JOIN phppos_app_files af ON ii.image_id = af.file_id
            WHERE ii.item_id IS NOT NULL
        `);

        console.log(`Encontradas ${rows.length} imágenes vinculadas en POS.`);

        // Agrupar imágenes por item_id para actualización masiva en Prisma
        const itemImageMap = new Map<number, string[]>();

        for (const row of rows) {
            const itemId = row.item_id;
            const imageId = row.image_id;
            const originalName = row.file_name || 'image.jpg';
            const extension = path.extname(originalName) || '.jpg';
            
            // Generar nombre de archivo único para evitar colisiones
            const fileName = `mig-prod-${itemId}-${imageId}${extension}`;
            const filePath = path.join(UPLOADS_DIR, fileName);

            // Guardar el BLOB como archivo físico
            if (row.file_data) {
                fs.writeFileSync(filePath, row.file_data);
                
                // Guardar la ruta relativa para el Marketplace
                const webPath = `/uploads/${fileName}`;
                
                if (!itemImageMap.has(itemId)) {
                    itemImageMap.set(itemId, []);
                }
                itemImageMap.get(itemId)?.push(webPath);
            }
        }

        console.log(`Archivos físicos guardados: ${itemImageMap.size} productos procesados.`);

        // 2. Actualizar Prisma (Marketplace)
        console.log("Actualizando base de datos PostgreSQL con las nuevas rutas de imágenes...");
        
        let updatedCount = 0;
        for (const [itemId, imagePaths] of itemImageMap.entries()) {
            const productSlug = `mig-prod-${itemId}`;
            
            // Verificar si el producto existe antes de actualizar
            const product = await prisma.product.findUnique({
                where: { id: productSlug }
            });

            if (product) {
                await prisma.product.update({
                    where: { id: productSlug },
                    data: { images: imagePaths }
                });
                updatedCount++;
            }
        }

        console.log(`¡Migración completada! ${updatedCount} productos actualizados con éxito.`);

    } catch (error) {
        console.error("Error durante la migración de imágenes:", error);
    } finally {
        await connection.end();
        await prisma.$disconnect();
    }
}

main();

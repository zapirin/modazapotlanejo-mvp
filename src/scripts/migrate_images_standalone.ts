import { PrismaClient } from '../generated/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_BASE = '/uploads';

async function downloadAndSaveImage(imageUrl: string, filename: string): Promise<string | null> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) return null;

        const buffer = Buffer.from(await response.arrayBuffer());
        const dir = path.join(UPLOAD_DIR, 'product-images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, buffer);

        return `${PUBLIC_BASE}/product-images/${filename}`;
    } catch (e) {
        console.error('Download error:', e);
        return null;
    }
}

async function saveBase64Image(base64: string, filename: string): Promise<string | null> {
    try {
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const dir = path.join(UPLOAD_DIR, 'product-images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, buffer);

        return `${PUBLIC_BASE}/product-images/${filename}`;
    } catch (e) {
        console.error('Save error:', e);
        return null;
    }
}

async function main() {
    console.log("Iniciando migración de imágenes de Supabase a Local...");

    const products = await prisma.product.findMany({
        select: { id: true, name: true, images: true }
    });

    console.log(`Encontrados ${products.length} productos.`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of products) {
        if (!product.images || product.images.length === 0) {
            skipped++;
            continue;
        }

        const newImages: string[] = [];
        let changed = false;

        for (let i = 0; i < product.images.length; i++) {
            const img = product.images[i];

            if (img.startsWith('data:')) {
                const filename = `${product.id}-${i}-${Date.now()}.jpg`;
                const url = await saveBase64Image(img, filename);
                if (url) {
                    newImages.push(url);
                    changed = true;
                } else {
                    newImages.push(img);
                    errors++;
                }
            } else if (img.includes('supabase.co')) {
                const ext = img.split('.').pop()?.split('?')[0] || 'jpg';
                const filename = `${product.id}-${i}-${Date.now()}.${ext}`;
                const url = await downloadAndSaveImage(img, filename);
                if (url) {
                    newImages.push(url);
                    changed = true;
                } else {
                    newImages.push(img);
                    errors++;
                }
            } else {
                newImages.push(img);
            }
        }

        if (changed) {
            await prisma.product.update({
                where: { id: product.id },
                data: { images: newImages }
            });
            migrated++;
            if (migrated % 10 === 0) console.log(`Migrados ${migrated} productos...`);
        } else {
            skipped++;
        }
    }

    console.log(`\nMigración finalizada:`);
    console.log(`- Productos migrados: ${migrated}`);
    console.log(`- Productos saltados (ya locales o sin imágenes): ${skipped}`);
    console.log(`- Errores: ${errors}`);
}

main().catch(e => {
    console.error("Fallo durante la migración:", e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/app/actions/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_BASE = process.env.NEXT_PUBLIC_UPLOAD_URL || '/uploads';

async function downloadAndSaveImage(imageUrl: string, filename: string): Promise<string | null> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) return null;

        const buffer = Buffer.from(await response.arrayBuffer());
        const dir = path.join(UPLOAD_DIR, 'product-images');
        await mkdir(dir, { recursive: true });

        const filePath = path.join(dir, filename);
        await writeFile(filePath, buffer);

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
        await mkdir(dir, { recursive: true });

        const filePath = path.join(dir, filename);
        await writeFile(filePath, buffer);

        return `${PUBLIC_BASE}/product-images/${filename}`;
    } catch (e) {
        console.error('Save error:', e);
        return null;
    }
}

export async function POST(request: Request) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const products = await prisma.product.findMany({
            select: { id: true, name: true, images: true }
        });

        const results = { total: products.length, migrated: 0, skipped: 0, errors: 0, details: [] as any[] };

        for (const product of products) {
            if (!product.images || product.images.length === 0) { results.skipped++; continue; }

            const newImages: string[] = [];
            let changed = false;

            for (let i = 0; i < product.images.length; i++) {
                const img = product.images[i];

                if (img.startsWith('data:')) {
                    // Base64 → guardar a disco
                    const filename = `${product.id}-${i}-${Date.now()}.jpg`;
                    const url = await saveBase64Image(img, filename);
                    if (url) { newImages.push(url); changed = true; }
                    else { newImages.push(img); results.errors++; }

                } else if (img.includes('supabase.co')) {
                    // URL de Supabase → descargar y guardar localmente
                    const ext = img.split('.').pop()?.split('?')[0] || 'jpg';
                    const filename = `${product.id}-${i}-${Date.now()}.${ext}`;
                    const url = await downloadAndSaveImage(img, filename);
                    if (url) { newImages.push(url); changed = true; }
                    else { newImages.push(img); results.errors++; }

                } else {
                    // Ya es URL local u otra — conservar
                    newImages.push(img);
                }
            }

            if (changed) {
                await prisma.product.update({ where: { id: product.id }, data: { images: newImages } });
                results.migrated++;
                results.details.push({ name: product.name, urls: newImages });
            } else {
                results.skipped++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `✅ ${results.migrated} migrados · ${results.skipped} sin cambios · ${results.errors} errores`,
            results
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

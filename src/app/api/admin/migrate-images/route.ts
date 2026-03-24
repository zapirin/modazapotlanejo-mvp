import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/app/actions/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'product-images';

async function uploadToStorage(base64: string, filename: string): Promise<string | null> {
    try {
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeMatch = base64.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`;
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': mimeType,
                'x-upsert': 'true',
            },
            body: buffer,
        });

        if (!response.ok) {
            console.error(`Upload error for ${filename}:`, await response.text());
            return null;
        }

        return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
    } catch (e) {
        console.error('Upload exception:', e);
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
                if (!img.startsWith('data:')) { newImages.push(img); continue; }

                const filename = `${product.id}-${i}-${Date.now()}.jpg`;
                const url = await uploadToStorage(img, filename);

                if (url) { newImages.push(url); changed = true; }
                else { newImages.push(img); results.errors++; }
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

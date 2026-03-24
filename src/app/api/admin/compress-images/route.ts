import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/app/actions/auth';

const MAX_PER_RUN = 50;

async function compressBase64Server(base64DataUrl: string): Promise<string> {
    if (!base64DataUrl?.startsWith('data:')) return base64DataUrl;
    try {
        const [header, b64] = base64DataUrl.split(',');
        if (!b64) return base64DataUrl;
        const sharpModule = await import('sharp').catch(() => null);
        if (!sharpModule) return base64DataUrl;
        const sharp = sharpModule.default;
        const buffer = Buffer.from(b64, 'base64');
        const compressed = await sharp(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 72, progressive: true })
            .toBuffer();
        return `data:image/jpeg;base64,${compressed.toString('base64')}`;
    } catch { return base64DataUrl; }
}

export async function POST(req: Request) {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const offset = body.offset ?? 0;

    let processed = 0, compressed = 0, savedKB = 0, errors = 0;

    const products = await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, images: true },
        skip: offset, take: MAX_PER_RUN,
    });

    for (const product of products) {
        const images = (product.images as string[]) || [];
        if (!images.some(img => img?.startsWith('data:'))) continue;
        processed++;
        try {
            const newImages = await Promise.all(images.map(async (img) => {
                if (!img?.startsWith('data:')) return img;
                const origKB = Math.round((img.length * 0.75) / 1024);
                const comp = await compressBase64Server(img);
                const newKB = Math.round((comp.length * 0.75) / 1024);
                savedKB += origKB - newKB;
                compressed++;
                return comp;
            }));
            await prisma.product.update({ where: { id: product.id }, data: { images: newImages } });
        } catch { errors++; }
    }

    // Logos de vendedores
    const sellers = await (prisma.user as any).findMany({
        where: { role: 'SELLER', logoUrl: { not: null } },
        select: { id: true, logoUrl: true },
    });
    for (const s of sellers) {
        if (!s.logoUrl?.startsWith('data:')) continue;
        try {
            const origKB = Math.round((s.logoUrl.length * 0.75) / 1024);
            const comp = await compressBase64Server(s.logoUrl);
            savedKB += origKB - Math.round((comp.length * 0.75) / 1024);
            await (prisma.user as any).update({ where: { id: s.id }, data: { logoUrl: comp } });
            compressed++;
        } catch {}
    }

    const hasMore = products.length === MAX_PER_RUN;
    return NextResponse.json({
        success: true, processed, compressed,
        savedKB: Math.round(savedKB),
        savedMB: (savedKB / 1024).toFixed(1),
        errors, hasMore,
        nextOffset: offset + MAX_PER_RUN,
        message: `${compressed} imágenes comprimidas · ${(savedKB/1024).toFixed(1)}MB ahorrados${hasMore ? ' · hay más, continúa con nextOffset' : ' · ¡completado!'}`,
    });
}

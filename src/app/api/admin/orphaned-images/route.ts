import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/app/actions/auth';
import { readdir, stat, unlink } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const SUBFOLDER = 'product-images';

async function getOrphanedFiles(): Promise<{ filename: string; sizeKB: number }[]> {
    const dir = path.join(UPLOAD_DIR, SUBFOLDER);

    // 1. Leer todos los archivos en disco
    let files: string[] = [];
    try {
        files = await readdir(dir);
    } catch {
        return []; // Carpeta no existe aún
    }

    // 2. Obtener todas las URLs referenciadas en productos
    const products = await prisma.product.findMany({
        select: { images: true },
    });
    const referencedUrls = new Set<string>();
    for (const p of products) {
        for (const img of (p.images as string[]) || []) {
            if (img && !img.startsWith('data:')) {
                // Extraer solo el nombre de archivo de la URL
                const filename = img.split('/').pop();
                if (filename) referencedUrls.add(filename);
            }
        }
    }

    // 3. También revisar logos de vendedores
    const sellers = await (prisma.user as any).findMany({
        where: { role: 'SELLER', logoUrl: { not: null } },
        select: { logoUrl: true },
    });
    for (const s of sellers) {
        if (s.logoUrl && !s.logoUrl.startsWith('data:')) {
            const filename = s.logoUrl.split('/').pop();
            if (filename) referencedUrls.add(filename);
        }
    }

    // 4. Encontrar huérfanos
    const orphans: { filename: string; sizeKB: number }[] = [];
    for (const file of files) {
        if (!referencedUrls.has(file)) {
            try {
                const fileStat = await stat(path.join(dir, file));
                orphans.push({ filename: file, sizeKB: Math.round(fileStat.size / 1024) });
            } catch {
                // Ignorar si no se puede leer
            }
        }
    }

    return orphans;
}

// GET — escanear y devolver resumen
export async function GET() {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const orphans = await getOrphanedFiles();
    const totalKB = orphans.reduce((sum, f) => sum + f.sizeKB, 0);

    return NextResponse.json({
        count: orphans.length,
        totalKB,
        totalMB: (totalKB / 1024).toFixed(1),
        files: orphans,
    });
}

// DELETE — eliminar todos los huérfanos
export async function DELETE() {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const orphans = await getOrphanedFiles();
    const dir = path.join(UPLOAD_DIR, SUBFOLDER);

    let deleted = 0;
    let freedKB = 0;
    let errors = 0;

    for (const { filename, sizeKB } of orphans) {
        try {
            await unlink(path.join(dir, filename));
            deleted++;
            freedKB += sizeKB;
        } catch {
            errors++;
        }
    }

    return NextResponse.json({
        success: true,
        deleted,
        errors,
        freedKB,
        freedMB: (freedKB / 1024).toFixed(1),
    });
}

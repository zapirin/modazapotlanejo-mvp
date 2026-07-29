import { NextResponse } from 'next/server';
import { getSessionUser } from '@/app/actions/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Directorio de uploads — en producción usa variable de entorno
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_BASE = process.env.NEXT_PUBLIC_UPLOAD_URL || '/uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// MIME types permitidos → extensión segura
const ALLOWED_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

// Magic numbers (primeros bytes) para detectar el tipo real del archivo
function detectMimeType(buf: Buffer): string | null {
    if (buf.length < 12) return null;
    // JPEG: FF D8 FF
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
    // GIF: 47 49 46 38
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
    // WebP: RIFF....WEBP
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
        && buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
    return null;
}

export async function POST(request: Request) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const contentType = request.headers.get('content-type') || '';

        let fileBuffer: Buffer;

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            if (!file) {
                return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 });
            }

            const bytes = await file.arrayBuffer();
            fileBuffer = Buffer.from(bytes);
        } else {
            const body = await request.json();
            const { base64 } = body;

            if (!base64) {
                return NextResponse.json({ error: 'No se envió imagen' }, { status: 400 });
            }

            const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
            if (!matches) {
                return NextResponse.json({ error: 'Formato base64 inválido' }, { status: 400 });
            }

            fileBuffer = Buffer.from(matches[2], 'base64');
        }

        // Validar tamaño
        if (fileBuffer.length > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'La imagen excede el tamaño máximo de 10 MB.' }, { status: 413 });
        }

        // Detectar tipo MIME real del buffer (magic numbers)
        const detectedMime = detectMimeType(fileBuffer);
        if (!detectedMime || !ALLOWED_MIME[detectedMime]) {
            return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo se aceptan JPG, PNG, WebP y GIF.' }, { status: 415 });
        }

        const ext = ALLOWED_MIME[detectedMime];

        // Generar nombre único
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 8);
        const filename = `${timestamp}_${random}.${ext}`;
        const subfolder = 'product-images';

        // Crear directorio si no existe
        const dir = path.join(UPLOAD_DIR, subfolder);
        await mkdir(dir, { recursive: true });

        // Guardar archivo
        const filePath = path.join(dir, filename);
        await writeFile(filePath, fileBuffer);

        // URL pública
        const publicUrl = `${PUBLIC_BASE}/${subfolder}/${filename}`;

        return NextResponse.json({
            success: true,
            url: publicUrl,
            size: fileBuffer.length,
        });
    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/app/actions/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Directorio de uploads — en producción usa variable de entorno
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_BASE = process.env.NEXT_PUBLIC_UPLOAD_URL || '/uploads';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const contentType = request.headers.get('content-type') || '';

        let fileBuffer: Buffer;
        let mimeType: string;
        let originalName: string;

        if (contentType.includes('multipart/form-data')) {
            // FormData upload
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            if (!file) {
                return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 });
            }

            const bytes = await file.arrayBuffer();
            fileBuffer = Buffer.from(bytes);
            mimeType = file.type || 'image/jpeg';
            originalName = file.name || 'upload';
        } else {
            // JSON con base64
            const body = await request.json();
            const { base64, folder } = body;

            if (!base64) {
                return NextResponse.json({ error: 'No se envió imagen' }, { status: 400 });
            }

            // Extraer datos del base64
            const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
            if (!matches) {
                return NextResponse.json({ error: 'Formato base64 inválido' }, { status: 400 });
            }

            mimeType = matches[1];
            fileBuffer = Buffer.from(matches[2], 'base64');
            originalName = folder || 'products';
        }

        // Generar nombre único
        const ext = mimeType.split('/')[1] || 'jpg';
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

// Límite de tamaño
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

/**
 * Utilidad de imágenes con compresión y soporte Supabase Storage
 * 
 * Estrategia:
 * - Imágenes nuevas → Supabase Storage (CDN, sin egress de BD)
 * - Fallback → base64 comprimido (80-90% menos peso)
 */

// ── COMPRESIÓN ────────────────────────────────────────────────────────────────

export interface CompressOptions {
    maxWidth?: number;   // default 1200px
    maxHeight?: number;  // default 1200px
    quality?: number;    // 0-1, default 0.75
    maxKB?: number;      // tamaño máximo en KB, default 300
}

/**
 * Comprime una imagen en el navegador usando Canvas.
 * Retorna un Data URL JPEG comprimido.
 */
export function compressImage(
    file: File,
    opts: CompressOptions = {}
): Promise<string> {
    const {
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 0.75,
        maxKB = 300,
    } = opts;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calcular nuevas dimensiones manteniendo proporción
            let { width, height } = img;
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);

            // Comprimir iterativamente hasta alcanzar maxKB
            let q = quality;
            let dataUrl = canvas.toDataURL('image/jpeg', q);
            while (dataUrl.length > maxKB * 1024 * 1.37 && q > 0.3) {
                q -= 0.05;
                dataUrl = canvas.toDataURL('image/jpeg', q);
            }

            resolve(dataUrl);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo cargar la imagen'));
        };

        img.src = url;
    });
}

/**
 * Estima el tamaño en KB de un base64 string
 */
export function estimateBase64SizeKB(base64: string): number {
    const b64 = base64.split(',')[1] || base64;
    return Math.round((b64.length * 0.75) / 1024);
}

// ── SUPABASE STORAGE ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const BUCKET = 'product-images';

/**
 * Sube una imagen a Supabase Storage y devuelve la URL pública.
 * Si falla, devuelve null (el caller puede hacer fallback a base64).
 */
export async function uploadToStorage(
    base64DataUrl: string,
    folder = 'products'
): Promise<string | null> {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

        // Convertir base64 a Blob
        const [header, b64] = base64DataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        const binary = atob(b64);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        const blob = new Blob([arr], { type: mime });

        // Nombre único
        const ext = mime.split('/')[1] || 'jpg';
        const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        // Upload via REST API (no requiere Service Key para buckets públicos)
        const res = await fetch(
            `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': mime,
                    'x-upsert': 'true',
                },
                body: blob,
            }
        );

        if (!res.ok) return null;

        return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
    } catch {
        return null;
    }
}

/**
 * Función principal: comprime + intenta subir a Storage.
 * Si Storage falla, devuelve base64 comprimido (fallback).
 */
export async function processImage(
    file: File,
    folder = 'products'
): Promise<{ url: string; isStorage: boolean; sizeKB: number }> {
    const compressed = await compressImage(file);
    const sizeKB = estimateBase64SizeKB(compressed);

    const storageUrl = await uploadToStorage(compressed, folder);
    if (storageUrl) {
        return { url: storageUrl, isStorage: true, sizeKB };
    }

    return { url: compressed, isStorage: false, sizeKB };
}

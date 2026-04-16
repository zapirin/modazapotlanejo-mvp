/**
 * Utilidad de imágenes con compresión y upload local al VPS
 * 
 * Estrategia:
 * - Compresión en el navegador (Canvas)
 * - Upload via /api/upload (almacenamiento local en disco)
 * - Fallback → base64 comprimido
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

// ── UPLOAD LOCAL (VPS) ─────────────────────────────────────────────────────────

/**
 * Sube una imagen al servidor local via /api/upload y devuelve la URL pública.
 * Si falla, devuelve null (el caller puede hacer fallback a base64).
 */
export async function uploadToStorage(
    base64DataUrl: string,
    folder = 'products'
): Promise<string | null> {
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64: base64DataUrl, folder }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        return data.url || null;
    } catch {
        return null;
    }
}

/**
 * Función principal: comprime + intenta subir al servidor.
 * Si falla, devuelve base64 comprimido (fallback).
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

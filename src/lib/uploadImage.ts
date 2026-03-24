// Utilidad para subir imágenes
// Convierte a base64 Data URL para almacenamiento simple
// En producción se puede cambiar a Supabase Storage o Cloudinary

export async function uploadImageToBase64(file: File): Promise<string> {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
}

// Valida que el archivo sea una imagen válida
export function validateImageFile(file: File): { valid: boolean; error?: string } {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
        return { valid: false, error: 'Formato no permitido. Usa JPG, PNG, WebP, GIF o SVG.' };
    }
    if (file.size > maxSize) {
        return { valid: false, error: 'El archivo es muy grande. Máximo 5MB.' };
    }
    return { valid: true };
}

// ---------------------------------------------------------------------------
// AUTO-PUBLICACIÓN EN REDES SOCIALES (Facebook + Instagram) — Meta Graph API
// Solo para el tenant de Kalexa Fashion (BrandConfig de kalexafashion.com).
// Best-effort: cualquier error se loguea y NUNCA afecta la creación del producto.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma';
import path from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';

// ⚠️ IMPORTANTE — RENOVACIÓN MANUAL DEL TOKEN ⚠️
// FB_ACCESS_TOKEN es un token de larga duración de Meta que EXPIRA ~60 días
// después de generarse. Hay que renovarlo manualmente (generar uno nuevo en
// Meta y reemplazarlo en el .env del servidor) ANTES de esa fecha, o las
// publicaciones dejarán de salir. Cuando expire, el error quedará registrado
// en los logs de PM2 — la tienda y la creación de productos NO se ven afectadas.
const FB_PAGE_ID = process.env.FB_PAGE_ID || '';
const IG_USER_ID = process.env.IG_USER_ID || '';
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || '';

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const KALEXA_DOMAIN = 'kalexafashion.com';
const PUBLIC_SITE = `https://${KALEXA_DOMAIN}`;

// Misma configuración que la ruta de uploads (src/app/api/upload/route.ts)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_BASE = process.env.NEXT_PUBLIC_UPLOAD_URL || '/uploads';

function isConfigured(): boolean {
    return Boolean(FB_PAGE_ID && IG_USER_ID && FB_ACCESS_TOKEN);
}

// ---------------------------------------------------------------------------
// IMAGEN: resolver la primera imagen del producto a una URL pública en JPG
// (Instagram solo acepta JPG oficialmente). El archivo original del producto
// NUNCA se modifica — si hace falta convertir, se guarda una copia aparte
// en /uploads/social/.
// ---------------------------------------------------------------------------

async function convertToJpgAndSave(buffer: Buffer, productId: string): Promise<string | null> {
    // Import dinámico de sharp, mismo patrón que api/admin/compress-images
    const sharpModule = await import('sharp').catch(() => null);
    if (!sharpModule) {
        console.warn('[Social] sharp no disponible — no se puede convertir la imagen a JPG');
        return null;
    }
    const sharp = sharpModule.default;
    const jpgBuffer = await sharp(buffer)
        .flatten({ background: '#ffffff' }) // fondo blanco para PNG con transparencia
        .jpeg({ quality: 90 })
        .toBuffer();

    const dir = path.join(UPLOAD_DIR, 'social');
    await mkdir(dir, { recursive: true });
    const filename = `${productId}_${Date.now()}.jpg`;
    await writeFile(path.join(dir, filename), jpgBuffer);
    return `${PUBLIC_SITE}${PUBLIC_BASE}/social/${filename}`;
}

async function resolveJpgImageUrl(image: string, productId: string): Promise<string | null> {
    try {
        const isJpg = /\.jpe?g(\?.*)?$/i.test(image);

        // Caso 1: imagen base64 embebida (productos antiguos) → decodificar y convertir
        if (image.startsWith('data:')) {
            const matches = image.match(/^data:image\/\w+;base64,(.+)$/);
            if (!matches) return null;
            return await convertToJpgAndSave(Buffer.from(matches[1], 'base64'), productId);
        }

        // Caso 2: URL absoluta externa
        if (image.startsWith('http')) {
            if (isJpg) return image;
            const res = await fetch(image);
            if (!res.ok) return null;
            return await convertToJpgAndSave(Buffer.from(await res.arrayBuffer()), productId);
        }

        // Caso 3: ruta relativa local (/uploads/...) — el caso normal
        if (isJpg) return `${PUBLIC_SITE}${image}`;
        const relativePath = image.startsWith(PUBLIC_BASE)
            ? image.slice(PUBLIC_BASE.length)
            : image;
        const buffer = await readFile(path.join(UPLOAD_DIR, relativePath));
        return await convertToJpgAndSave(buffer, productId);
    } catch (error) {
        console.error('[Social] Error preparando imagen:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

// ---------------------------------------------------------------------------
// PUBLICAR EN FACEBOOK — POST /{page-id}/photos
// ---------------------------------------------------------------------------

async function postToFacebook(imageUrl: string, caption: string): Promise<boolean> {
    try {
        const res = await fetch(`${GRAPH_API}/${FB_PAGE_ID}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: imageUrl,
                message: caption,
                access_token: FB_ACCESS_TOKEN,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('[Social] Facebook error:', JSON.stringify(data?.error || data));
            return false;
        }
        console.log('[Social] Publicado en Facebook, id:', data?.post_id || data?.id);
        return true;
    } catch (error) {
        console.error('[Social] Facebook error de conexión:', error instanceof Error ? error.message : String(error));
        return false;
    }
}

// ---------------------------------------------------------------------------
// PUBLICAR EN INSTAGRAM — flujo de 2 pasos:
// POST /{ig-user-id}/media (crear contenedor) → esperar status_code FINISHED
// → POST /{ig-user-id}/media_publish
// ---------------------------------------------------------------------------

async function postToInstagram(imageUrl: string, caption: string): Promise<boolean> {
    try {
        // Paso 1 — crear el contenedor
        const createRes = await fetch(`${GRAPH_API}/${IG_USER_ID}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_url: imageUrl,
                caption,
                access_token: FB_ACCESS_TOKEN,
            }),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData?.id) {
            console.error('[Social] Instagram error al crear contenedor:', JSON.stringify(createData?.error || createData));
            return false;
        }
        const containerId = createData.id;

        // Paso 2 — esperar a que Meta procese la imagen (poll de status_code)
        let finished = false;
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const stRes = await fetch(`${GRAPH_API}/${containerId}?fields=status_code&access_token=${FB_ACCESS_TOKEN}`);
            const stData = await stRes.json();
            if (stData?.status_code === 'FINISHED') { finished = true; break; }
            if (stData?.status_code === 'ERROR') {
                console.error('[Social] Instagram: el contenedor terminó en ERROR:', JSON.stringify(stData));
                return false;
            }
        }
        if (!finished) {
            console.error('[Social] Instagram: timeout esperando que Meta procesara la imagen');
            return false;
        }

        // Paso 3 — publicar el contenedor
        const pubRes = await fetch(`${GRAPH_API}/${IG_USER_ID}/media_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: containerId,
                access_token: FB_ACCESS_TOKEN,
            }),
        });
        const pubData = await pubRes.json();
        if (!pubRes.ok) {
            console.error('[Social] Instagram error al publicar:', JSON.stringify(pubData?.error || pubData));
            return false;
        }
        console.log('[Social] Publicado en Instagram, id:', pubData?.id);
        return true;
    } catch (error) {
        console.error('[Social] Instagram error de conexión:', error instanceof Error ? error.message : String(error));
        return false;
    }
}

// ---------------------------------------------------------------------------
// FUNCIÓN PRINCIPAL — llamar tras crear/duplicar un producto (fire-and-forget)
// ---------------------------------------------------------------------------

export async function postProductToSocialMedia(product: {
    id: string;
    name: string;
    slug?: string | null;
    price: number;
    images?: string[] | null;
    sellerId?: string | null;
    isOnline?: boolean;
}) {
    try {
        // Solo productos visibles en la tienda en línea
        if (!product.isOnline) return;
        if (!product.sellerId) return;

        if (!isConfigured()) {
            console.warn('[Social] FB_PAGE_ID / IG_USER_ID / FB_ACCESS_TOKEN no configurados — se omite la publicación');
            return;
        }

        // Solo el tenant de Kalexa Fashion (BrandConfig liga el dominio con su sellerId)
        const kalexa = await prisma.brandConfig.findUnique({
            where: { domain: KALEXA_DOMAIN },
            select: { sellerId: true, isActive: true },
        });
        if (!kalexa?.isActive || !kalexa.sellerId || kalexa.sellerId !== product.sellerId) return;

        const firstImage = product.images?.[0];
        if (!firstImage) {
            console.warn('[Social] Producto sin imagen, no se publica:', product.id);
            return;
        }

        const imageUrl = await resolveJpgImageUrl(firstImage, product.id);
        if (!imageUrl) {
            console.warn('[Social] No se pudo preparar la imagen para redes:', product.id);
            return;
        }

        const priceText = Number.isInteger(product.price) ? `${product.price}` : product.price.toFixed(2);
        const link = `${PUBLIC_SITE}/catalog/${product.slug || product.id}`;
        const caption = `${product.name} — $${priceText} MXN. Disponible aquí: ${link}`;

        console.log('[Social] Publicando producto en redes:', product.id, imageUrl);
        const fbOk = await postToFacebook(imageUrl, caption);
        const igOk = await postToInstagram(imageUrl, caption);
        console.log(`[Social] Resultado — Facebook: ${fbOk ? 'OK' : 'FALLÓ'}, Instagram: ${igOk ? 'OK' : 'FALLÓ'}`);
    } catch (error) {
        console.error('[Social] Error publicando en redes (no afecta al producto):', error instanceof Error ? error.message : String(error));
    }
}

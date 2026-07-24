// ---------------------------------------------------------------------------
// AUTO-PUBLICACIÓN EN REDES SOCIALES (Facebook + Instagram) — Meta Graph API
// Solo para el tenant de Kalexa Fashion (BrandConfig de kalexafashion.com).
// Best-effort: cualquier error se loguea y NUNCA afecta la creación del producto.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma';
import path from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';

// ⚠️ IMPORTANTE — SOBRE EL TOKEN (FB_ACCESS_TOKEN) ⚠️
// Es un token de PÁGINA de larga duración (obtenido a partir de un token de
// usuario de larga duración vía /me/accounts). Meta lo describe como "sin
// expiración" mientras no se cambie la contraseña de Facebook ni se revoque
// el acceso de la app "Kalexa Fashion Auto Post". Aun así, revisar de vez en
// cuando (cada varios meses) que las publicaciones sigan saliendo. Si algún
// día deja de funcionar, el error queda registrado en los logs de PM2 — la
// tienda y la creación de productos NUNCA se ven afectadas.
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
// IMAGEN: resolver la primera imagen del producto a una URL pública en JPG,
// lista para Instagram. El archivo original del producto NUNCA se modifica —
// siempre se guarda una copia aparte en /uploads/social/.
//
// Instagram exige que la relación ancho/alto esté entre 4:5 (0.8) y 1.91:1.
// Las fotos de ropa de cuerpo completo suelen ser más altas que eso (ej. una
// foto de 662×1200 da una relación de 0.55), así que se agregan franjas
// blancas a los lados (o arriba/abajo si fuera muy panorámica) para cumplir
// la regla — la foto original nunca se recorta ni se deforma.
// ---------------------------------------------------------------------------

const IG_MIN_RATIO = 0.8;  // 4:5 — límite documentado por Meta
const IG_MAX_RATIO = 1.91; // 1.91:1 — límite documentado por Meta
// Al rellenar con franjas, apuntamos un poco adentro del límite (no exacto)
// para evitar rechazos por redondeo en el límite exacto.
const IG_TARGET_MIN_RATIO = 0.82;
const IG_TARGET_MAX_RATIO = 1.88;

async function loadImageBuffer(image: string): Promise<Buffer | null> {
    if (image.startsWith('data:')) {
        const matches = image.match(/^data:image\/\w+;base64,(.+)$/);
        return matches ? Buffer.from(matches[1], 'base64') : null;
    }
    if (image.startsWith('http')) {
        const res = await fetch(image);
        return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    // Ruta relativa local (/uploads/...) — el caso normal
    const relativePath = image.startsWith(PUBLIC_BASE) ? image.slice(PUBLIC_BASE.length) : image;
    return await readFile(path.join(UPLOAD_DIR, relativePath));
}

async function resolveJpgImageUrl(image: string, productId: string): Promise<string | null> {
    try {
        const buffer = await loadImageBuffer(image);
        if (!buffer) return null;

        // Import dinámico de sharp, mismo patrón que api/admin/compress-images
        const sharpModule = await import('sharp').catch(() => null);
        if (!sharpModule) {
            console.warn('[Social] sharp no disponible — no se puede preparar la imagen');
            return null;
        }
        const sharp = sharpModule.default;

        const metadata = await sharp(buffer).metadata();
        const width = metadata.width || 0;
        const height = metadata.height || 0;
        if (!width || !height) return null;

        const ratio = width / height;
        let pipeline = sharp(buffer);

        if (ratio < IG_MIN_RATIO) {
            // Muy alta/angosta: agrandar el lienzo a los lados con franjas blancas
            pipeline = pipeline.resize({
                width: Math.ceil(height * IG_TARGET_MIN_RATIO),
                height,
                fit: 'contain',
                background: '#ffffff',
            });
        } else if (ratio > IG_MAX_RATIO) {
            // Muy ancha/baja: agrandar el lienzo arriba/abajo con franjas blancas
            pipeline = pipeline.resize({
                width,
                height: Math.ceil(width / IG_TARGET_MAX_RATIO),
                fit: 'contain',
                background: '#ffffff',
            });
        }

        const jpgBuffer = await pipeline
            .flatten({ background: '#ffffff' }) // fondo blanco para PNG con transparencia
            .jpeg({ quality: 90 })
            .toBuffer();

        const dir = path.join(UPLOAD_DIR, 'social');
        await mkdir(dir, { recursive: true });
        const filename = `${productId}_${Date.now()}.jpg`;
        await writeFile(path.join(dir, filename), jpgBuffer);
        return `${PUBLIC_SITE}${PUBLIC_BASE}/social/${filename}`;
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

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/app/actions/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const { images, productName, customPrompt } = await request.json();

        if (!images || images.length === 0) {
            return NextResponse.json({ error: 'Se requiere al menos una imagen.' }, { status: 400 });
        }

        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

        const settings = await prisma.storeSettings.findUnique({
            where: { sellerId: user.id }
        });

        const aiProvider = settings?.aiProvider || '';
        const aiApiKey = settings?.aiApiKey || '';

        if (!aiApiKey || !aiProvider) {
            return NextResponse.json({ error: 'No tienes un proveedor de IA configurado. Ve a Configuración > General para agregarlo.' }, { status: 400 });
        }

        const basePrompt = productName
            ? `Eres un experto en moda mayorista de Zapotlanejo. Basándote en las imágenes del producto "${productName}", genera una descripción detallada y atractiva en español. Menciona el tipo de prenda, materiales, fit, colores y detalles visuales. No menciones tallas ni precios. Máximo 3 oraciones cortas y directas.`
            : 'Eres un experto en moda mayorista de Zapotlanejo. Basándote en las imágenes, genera una descripción detallada y atractiva en español. Menciona el tipo de prenda, materiales, fit, colores y detalles visuales. No menciones tallas ni precios. Máximo 3 oraciones cortas y directas.';
        const prompt = customPrompt ? `${basePrompt} Instrucción adicional: ${customPrompt}` : basePrompt;

        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'modazapotlanejo.com';
        const proto = request.headers.get('x-forwarded-proto') || 'https';
        const baseUrl = `${proto}://${host}`;

        let description = '';

        if (aiProvider === 'openai') {
            const imageContents = images.slice(0, 3).map((img: string) => {
                const url = img.startsWith('/uploads') ? `${baseUrl}${img}` : img.startsWith('http') ? img : `data:image/jpeg;base64,${img.includes(',') ? img.split(',')[1] : img}`;
                return { type: 'image_url', image_url: { url } };
            });

            const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: [...imageContents, { type: 'text', text: prompt }] }],
                    max_tokens: 300
                })
            });
            const openaiData = await openaiRes.json();
            console.error('OpenAI response:', JSON.stringify(openaiData).slice(0, 300));
            description = openaiData.choices?.[0]?.message?.content || '';

        } else if (aiProvider === 'gemini') {
            const imageParts = images.slice(0, 3).map((img: string) => {
                if (img.startsWith('http') || img.startsWith('/uploads')) {
                    const url = img.startsWith('/uploads') ? `${baseUrl}${img}` : img;
                    return { fileData: { fileUri: url, mimeType: 'image/jpeg' } };
                }
                const base64 = img.includes(',') ? img.split(',')[1] : img;
                return { inlineData: { data: base64, mimeType: 'image/jpeg' } };
            });

            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${aiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [...imageParts, { text: prompt }] }] })
                }
            );
            const geminiData = await geminiRes.json();
            console.error('Gemini response:', JSON.stringify(geminiData).slice(0, 300));
            description = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        } else if (aiProvider === 'anthropic') {
            const imageContents = (await Promise.all(images.slice(0, 3).map(async (img: string) => {
                if (img.startsWith('http') || img.startsWith('/uploads')) {
                    const url = img.startsWith('/uploads') ? `${baseUrl}${img}` : img;
                    try {
                        const imgRes = await fetch(url);
                        const buffer = await imgRes.arrayBuffer();
                        const base64 = Buffer.from(buffer).toString('base64');
                        const ct = imgRes.headers.get('content-type') || 'image/jpeg';
                        const mimeType = ct.split(';')[0] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
                        return { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };
                    } catch { return null; }
                }
                const base64 = img.includes(',') ? img.split(',')[1] : img;
                return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } };
            }))).filter(Boolean);

            const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': aiApiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({
                    model: 'claude-opus-4-6',
                    max_tokens: 300,
                    messages: [{ role: 'user', content: [...imageContents, { type: 'text', text: prompt }] }]
                })
            });
            const anthropicData = await anthropicRes.json();
            console.error('Anthropic response:', JSON.stringify(anthropicData).slice(0, 500));
            if (anthropicData.error) {
                return NextResponse.json({ error: `Anthropic: ${anthropicData.error.message || JSON.stringify(anthropicData.error)}` }, { status: 400 });
            }
            description = anthropicData.content?.[0]?.text || '';
        }

        if (!description) {
            return NextResponse.json({ error: 'No se pudo generar la descripción. Verifica tu API Key.' }, { status: 500 });
        }

        return NextResponse.json({ description });

    } catch (error: any) {
        console.error('Error generating description:', error);
        return NextResponse.json({ error: 'Error al generar la descripción.' }, { status: 500 });
    }
}

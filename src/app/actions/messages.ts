"use server";

import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/app/actions/auth';

/**
 * Filtra el contenido de un mensaje para detectar información de contacto prohibida.
 * Devuelve un objeto con un booleano indicando si es válido y el mensaje de error si no lo es.
 */
export async function validateMessageContent(content: string) {
    // Regex para detectar teléfonos (varios formatos como 3312345678, 33-12-34-56-78, (33) 1234, etc.)
    const phoneRegex = /(\+?\d{1,4}[\s-]?)?(\(?\d{3}\)?[\s-]?)?[\d\s-]{7,15}/g;
    
    // Regex para emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    // Regex para URLs y redes sociales comunes
    const urlRegex = /(https?:\/\/)?(www\.)?(facebook|fb|instagram|ig|tiktok|twitter|tw|whatsapp|wa\.me|youtube)\.[a-z.]{2,}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
    
    // Nombres de usuario/ID de redes sociales comunes
    const socialPatterns = /(@[a-zA-Z0-9_.]+)|(facebook\.com\/|instagram\.com\/|tiktok\.com\/|wa\.me\/)/gi;

    // Detectar direcciones (palabras clave comunes de calles, números, códigos postales)
    // Buscamos patrones como "Calle", "Ave", "Av.", "Col.", "C.P.", "Num", etc.
    const addressPatterns = /\b(calle|avenida|av\.|colonia|col\.|fraccionamiento|fracc\.|cp|c\.p\.|numero|num\.|no\.|apartado|sector)\b/gi;

    const hasPhone = phoneRegex.test(content);
    const hasEmail = emailRegex.test(content);
    const hasUrl = urlRegex.test(content);
    const hasSocial = socialPatterns.test(content);
    const hasAddress = addressPatterns.test(content);

    if (hasPhone || hasEmail || hasUrl || hasSocial || hasAddress) {
        let detected = [];
        if (hasPhone) detected.push('números de teléfono');
        if (hasEmail) detected.push('correos electrónicos');
        if (hasUrl || hasSocial) detected.push('redes sociales');
        if (hasAddress) detected.push('direcciones físicas');

        return {
            valid: false,
            error: `Por seguridad, no está permitido compartir ${detected.join(', ')}. Mantén la comunicación aquí para protegerte de posibles estafas por fuera.`
        };
    }

    return { valid: true };
}

export async function sendMessage(receiverId: string, content: string) {
    const user = await getSessionUser();
    if (!user) return { error: 'Debes iniciar sesión' };
    if (!content.trim()) return { error: 'El mensaje no puede estar vacío' };

    // Validar contenido para evitar intercambio de datos de contacto
    const validation = await validateMessageContent(content);
    if (!validation.valid) {
        return { error: validation.error };
    }

    const message = await prisma.message.create({
        data: {
            senderId: user.id,
            receiverId,
            content: content.trim(),
        }
    });

    return { success: true, message };
}

export async function getConversations() {
    const user = await getSessionUser();
    if (!user) return [];

    // Get all messages where user is sender or receiver, grouped by the other party
    const messages = await prisma.message.findMany({
        where: {
            OR: [
                { senderId: user.id },
                { receiverId: user.id },
            ]
        },
        include: {
            sender: { select: { id: true, name: true, businessName: true, role: true } },
            receiver: { select: { id: true, name: true, businessName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Group by conversation partner
    const conversationMap = new Map<string, any>();
    for (const msg of messages) {
        const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
        if (!conversationMap.has(partnerId)) {
            const partner = msg.senderId === user.id ? msg.receiver : msg.sender;
            conversationMap.set(partnerId, {
                partnerId,
                partnerName: partner.businessName || partner.name,
                partnerRole: partner.role,
                lastMessage: msg.content,
                lastMessageAt: msg.createdAt,
                unreadCount: 0,
            });
        }
        if (msg.receiverId === user.id && !msg.isRead) {
            const conv = conversationMap.get(partnerId)!;
            conv.unreadCount++;
        }
    }

    return Array.from(conversationMap.values());
}

export async function getMessagesWith(partnerId: string) {
    const user = await getSessionUser();
    if (!user) return [];

    // Mark as read
    await prisma.message.updateMany({
        where: { senderId: partnerId, receiverId: user.id, isRead: false },
        data: { isRead: true }
    });

    return prisma.message.findMany({
        where: {
            OR: [
                { senderId: user.id, receiverId: partnerId },
                { senderId: partnerId, receiverId: user.id },
            ]
        },
        include: {
            sender: { select: { id: true, name: true, businessName: true } },
        },
        orderBy: { createdAt: 'asc' },
    });
}

export async function getUnreadCount() {
    const user = await getSessionUser();
    if (!user) return 0;

    return prisma.message.count({
        where: { receiverId: user.id, isRead: false }
    });
}

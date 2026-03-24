import { getSessionUser } from '@/app/actions/auth';
import { getConversations } from '@/app/actions/messages';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import MessagesClient from './MessagesClient';

export default async function MessagesPage({
    searchParams,
}: {
    searchParams: any;
}) {
    const user = await getSessionUser();
    if (!user) redirect('/login');
    
    const params = await searchParams;
    const conversations = await getConversations();

    // Para vendedores: inyectar al admin como contacto disponible si no hay conversación con él
    let adminContact: any = null;
    if (user.role === 'SELLER' || user.role === 'CASHIER') {
        const admin = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            select: { id: true, name: true, businessName: true, role: true }
        });
        if (admin) {
            const alreadyTalking = conversations.some(c => c.partnerId === admin.id);
            if (!alreadyTalking) {
                adminContact = {
                    partnerId: admin.id,
                    partnerName: admin.businessName || admin.name || 'Administrador',
                    partnerRole: 'ADMIN',
                    lastMessage: 'Iniciar conversación con el administrador',
                    lastMessageAt: null,
                    unreadCount: 0,
                    isAdminContact: true,
                };
            }
        }
    }

    // Para admin: también ver todos los vendedores como contactos disponibles
    let sellerContacts: any[] = [];
    if (user.role === 'ADMIN') {
        const sellers = await prisma.user.findMany({
            where: { role: 'SELLER', isActive: true },
            select: { id: true, name: true, businessName: true },
            orderBy: { name: 'asc' }
        });
        const talkingIds = new Set(conversations.map(c => c.partnerId));
        sellerContacts = sellers
            .filter(s => !talkingIds.has(s.id))
            .map(s => ({
                partnerId: s.id,
                partnerName: s.businessName || s.name,
                partnerRole: 'SELLER',
                lastMessage: 'Sin mensajes aún',
                lastMessageAt: null,
                unreadCount: 0,
                isNew: true,
            }));
    }

    const allConversations = [
        ...(adminContact ? [adminContact] : []),
        ...conversations,
        ...sellerContacts,
    ];

    return (
        <div className="pb-10">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
                <div className="space-y-2 mb-8">
                    <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">💬 Mensajes</h1>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                        {user.role === 'ADMIN' ? 'Comunicación con vendedores' : 'Comunicación directa con el equipo de Moda Zapotlanejo'}
                    </p>
                </div>

                <MessagesClient 
                    conversations={allConversations} 
                    currentUserId={user.id}
                    initialPartnerId={params.with}
                    userRole={user.role as string}
                />
            </div>
        </div>
    );
}

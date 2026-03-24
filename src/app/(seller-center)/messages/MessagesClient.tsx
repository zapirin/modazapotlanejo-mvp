"use client";

import { useState, useEffect, useRef } from 'react';
import { sendMessage, getMessagesWith } from '@/app/actions/messages';

export default function MessagesClient({ 
    conversations, 
    currentUserId,
    initialPartnerId,
    userRole
}: { 
    conversations: any[];
    currentUserId: string;
    initialPartnerId?: string;
    userRole?: string;
}) {
    const [selectedPartner, setSelectedPartner] = useState<string | null>(initialPartnerId || null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedPartner) loadMessages(selectedPartner);
    }, [selectedPartner]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadMessages = async (partnerId: string) => {
        setLoading(true);
        const msgs = await getMessagesWith(partnerId);
        setMessages(msgs);
        setLoading(false);
    };

    const handleSend = async () => {
        if (!selectedPartner || !newMessage.trim()) return;
        setSending(true);
        
        const result = await sendMessage(selectedPartner, newMessage);
        
        if (result.success) {
            setNewMessage('');
            await loadMessages(selectedPartner);
        } else if (result.error) {
            alert(result.error);
        }
        
        setSending(false);
    };

    const selectedConv = conversations.find(c => c.partnerId === selectedPartner);

    return (
        <div className="flex gap-6 h-[600px] bg-white dark:bg-gray-900 rounded-3xl border border-border overflow-hidden shadow-xl">
            {/* Conversations list */}
            <div className="w-72 border-r border-border flex flex-col shrink-0">
                <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Mensajes</h3>
                        {userRole === 'SELLER' && (
                            <span className="text-[9px] text-blue-500 font-black uppercase tracking-wider">
                                🔒 Privado
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-400">
                            Sin conversaciones aún
                        </div>
                    ) : (
                        conversations.map((conv: any) => (
                            <button
                                key={conv.partnerId}
                                onClick={() => setSelectedPartner(conv.partnerId)}
                                className={`w-full text-left p-4 border-b border-border/50 transition-colors ${
                                    selectedPartner === conv.partnerId 
                                        ? 'bg-blue-50 dark:bg-blue-900/20' 
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 ${conv.partnerRole === 'ADMIN' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : conv.partnerRole === 'SELLER' ? 'bg-gradient-to-br from-blue-600 to-indigo-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'}`}>
                                        {conv.partnerRole === 'ADMIN' ? '👑' : conv.partnerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center gap-1">
                                            <p className="font-bold text-sm text-foreground truncate">{conv.partnerName}</p>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {conv.partnerRole === 'ADMIN' && (
                                                    <span className="text-[8px] font-black bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Admin</span>
                                                )}
                                                {conv.unreadCount > 0 && (
                                                    <span className="w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                                        {conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-400 truncate">{conv.lastMessage}</p>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col">
                {selectedPartner ? (
                    <>
                        <div className="p-4 border-b border-border flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xs">
                                {selectedConv?.partnerName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                                <p className="font-bold text-sm">{selectedConv?.partnerName || 'Chat'}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    {selectedConv?.partnerRole === 'SELLER' ? 'Vendedor' : 'Comprador'}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-gray-400">Cargando...</div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-400 text-sm">Envía el primer mensaje</div>
                            ) : (
                                messages.map((msg: any) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${
                                            msg.senderId === currentUserId
                                                ? 'bg-blue-600 text-white rounded-br-md'
                                                : 'bg-gray-100 dark:bg-gray-800 text-foreground rounded-bl-md'
                                        }`}>
                                            <p>{msg.content}</p>
                                            <p className={`text-[9px] mt-1 ${msg.senderId === currentUserId ? 'text-blue-200' : 'text-gray-400'}`}>
                                                {new Date(msg.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 border-t border-border flex gap-3">
                            <input
                                type="text"
                                placeholder="Escribe un mensaje..."
                                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/50"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            />
                            <button
                                onClick={handleSend}
                                disabled={sending || !newMessage.trim()}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50 hover:bg-blue-700 transition"
                            >
                                {sending ? '...' : 'Enviar'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        <div className="text-center space-y-2">
                            <div className="text-6xl">💬</div>
                            <p className="text-sm font-bold">Selecciona una conversación</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

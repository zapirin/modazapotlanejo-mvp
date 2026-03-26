"use client";

import React, { useState, useEffect } from 'react';
import { getMyReceivedReviews, replyToReview } from '@/app/actions/reviews';
import toast from 'react-hot-toast';

function StarDisplay({ value }: { value: number }) {
    return (
        <div className="flex gap-0.5">
            {[1,2,3,4,5].map(s => (
                <span key={s} className={s <= value ? 'text-amber-400' : 'text-gray-200 dark:text-gray-700'}>★</span>
            ))}
        </div>
    );
}

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');

    useEffect(() => {
        getMyReceivedReviews().then(r => { setReviews(r); setLoading(false); });
    }, []);

    const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    const handleReply = async (reviewId: string) => {
        if (!replyText.trim()) return;
        const res = await replyToReview(reviewId, replyText);
        if (res.success) {
            setReviews(prev => prev.map(r => r.id === reviewId ? {...r, sellerReply: replyText} : r));
            setReplyingTo(null);
            setReplyText('');
            toast.success('Respuesta publicada');
        } else toast.error(res.error || 'Error al responder');
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight">⭐ Mis Calificaciones</h1>
                <p className="text-gray-400 text-sm mt-1">Reseñas de tus compradores.</p>
            </div>
            {reviews.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-card border border-border rounded-2xl p-5 text-center">
                        <p className="text-4xl font-black text-amber-500">{avg.toFixed(1)}</p>
                        <p className="text-xs text-gray-400 mt-1 font-bold">Promedio</p>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5 text-center">
                        <p className="text-4xl font-black">{reviews.length}</p>
                        <p className="text-xs text-gray-400 mt-2 font-bold">Total reseñas</p>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5 text-center">
                        <p className="text-4xl font-black text-emerald-500">{reviews.filter(r => r.sellerReply).length}</p>
                        <p className="text-xs text-gray-400 mt-2 font-bold">Respondidas</p>
                    </div>
                </div>
            )}
            {reviews.length === 0 ? (
                <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
                    <p className="text-5xl mb-4">⭐</p>
                    <p className="font-black text-lg">Aún no tienes calificaciones</p>
                </div>
            ) : reviews.map((review: any) => (
                <div key={review.id} className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="font-black">{review.buyer.businessName || review.buyer.name}</p>
                            <p className="text-[10px] text-gray-400">{new Date(review.createdAt).toLocaleDateString('es-MX')}</p>
                        </div>
                        <StarDisplay value={review.rating} />
                    </div>
                    {review.title && <p className="font-black">{review.title}</p>}
                    <p className="text-sm text-gray-600 dark:text-gray-300">{review.body}</p>
                    {review.sellerReply && (
                        <div className="ml-4 pl-4 border-l-2 border-blue-200 bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4">
                            <p className="text-[10px] font-black text-blue-600 mb-1">Tu respuesta</p>
                            <p className="text-sm">{review.sellerReply}</p>
                        </div>
                    )}
                    {!review.sellerReply && (
                        replyingTo === review.id ? (
                            <div className="space-y-2">
                                <textarea rows={3} value={replyText} onChange={e => setReplyText(e.target.value)}
                                    placeholder="Tu respuesta..." className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-border rounded-xl text-sm resize-none outline-none" />
                                <div className="flex gap-2">
                                    <button onClick={() => handleReply(review.id)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">Publicar</button>
                                    <button onClick={() => setReplyingTo(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-black">Cancelar</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setReplyingTo(review.id)} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 text-blue-600 rounded-xl text-xs font-black">
                                💬 Responder
                            </button>
                        )
                    )}
                </div>
            ))}
        </div>
    );
}

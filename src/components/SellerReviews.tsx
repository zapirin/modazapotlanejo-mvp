"use client";

import React, { useState, useEffect } from 'react';
import { getSellerReviews, canReviewSeller, createReview, replyToReview } from '@/app/actions/reviews';

function StarRating({ value, onChange, size = 'md' }: { value: number, onChange?: (v: number) => void, size?: 'sm' | 'md' | 'lg' }) {
    const [hover, setHover] = useState(0);
    const sz = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-xl';
    return (
        <div className={`flex gap-0.5 ${sz}`}>
            {[1,2,3,4,5].map(star => (
                <button key={star} type="button"
                    className={`transition-transform ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${star <= (hover || value) ? 'text-amber-400' : 'text-gray-200 dark:text-gray-700'}`}
                    onMouseEnter={() => onChange && setHover(star)}
                    onMouseLeave={() => onChange && setHover(0)}
                    onClick={() => onChange?.(star)}>
                    ★
                </button>
            ))}
        </div>
    );
}

export default function SellerReviews({ sellerId, sellerName }: { sellerId: string, sellerName: string }) {
    const [data, setData] = useState<any>({ reviews: [], avg: 0, total: 0, distribution: [] });
    const [canReview, setCanReview] = useState<any>(null);
    const [showForm, setShowForm] = useState(false);
    const [rating, setRating] = useState(5);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isOwner, setIsOwner] = useState(false);

    useEffect(() => {
        getSellerReviews(sellerId).then(setData);
        canReviewSeller(sellerId).then(result => {
            setCanReview(result);
        });
        // Verificar si es el dueño
        fetch('/api/me').then(r => r.json()).then(u => {
            if (u?.id === sellerId) setIsOwner(true);
        }).catch(() => {});
    }, [sellerId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim() || !canReview?.orderId) return;
        setSubmitting(true);
        const res = await createReview({ sellerId, orderId: canReview.orderId, rating, title, body });
        if (res.success) {
            setShowForm(false);
            setBody(''); setTitle(''); setRating(5);
            getSellerReviews(sellerId).then(setData);
            setCanReview({ can: false, reason: 'already_reviewed' });
        }
        setSubmitting(false);
    };

    const handleReply = async (reviewId: string) => {
        if (!replyText.trim()) return;
        const res = await replyToReview(reviewId, replyText);
        if (res.success) {
            setReplyingTo(null);
            setReplyText('');
            getSellerReviews(sellerId).then(setData);
        }
    };

    return (
        <div className="space-y-8">
            {/* Resumen de calificaciones */}
            <div className="bg-card border border-border rounded-3xl p-8">
                <h2 className="text-xl font-black uppercase tracking-tight mb-6">⭐ Calificaciones de {sellerName}</h2>
                {data.total === 0 ? (
                    <p className="text-gray-400 text-sm">Aún no hay calificaciones para este vendedor.</p>
                ) : (
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Promedio grande */}
                        <div className="flex flex-col items-center gap-2 shrink-0">
                            <span className="text-7xl font-black text-foreground">{data.avg}</span>
                            <StarRating value={Math.round(data.avg)} size="lg" />
                            <span className="text-xs text-gray-400 font-bold">{data.total} reseña{data.total !== 1 ? 's' : ''}</span>
                        </div>
                        {/* Distribución */}
                        <div className="flex-1 space-y-2 w-full">
                            {data.distribution.map((d: any) => (
                                <div key={d.stars} className="flex items-center gap-3">
                                    <span className="text-xs font-black w-2">{d.stars}</span>
                                    <span className="text-amber-400 text-sm">★</span>
                                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-400 rounded-full transition-all"
                                            style={{width: data.total > 0 ? `${(d.count/data.total)*100}%` : '0%'}} />
                                    </div>
                                    <span className="text-xs text-gray-400 w-4">{d.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Botón calificar */}
                {canReview?.can && !showForm && (
                    <button onClick={() => setShowForm(true)}
                        className="mt-6 px-6 py-3 bg-amber-500 text-white rounded-2xl text-sm font-black hover:bg-amber-600 transition">
                        ✍️ Calificar a {sellerName}
                    </button>
                )}
                {canReview && !canReview.can && canReview.reason === 'already_reviewed' && (
                    <p className="mt-4 text-xs text-emerald-600 font-bold">✓ Ya dejaste tu calificación para este vendedor.</p>
                )}
                {canReview && !canReview.can && canReview.reason === 'no_completed_order' && (
                    <p className="mt-4 text-xs text-gray-400 font-bold">Solo puedes calificar después de completar una compra.</p>
                )}
            </div>

            {/* Formulario de reseña */}
            {showForm && canReview?.can && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-3xl p-8">
                    <h3 className="text-lg font-black mb-6">Tu calificación</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estrellas</label>
                            <StarRating value={rating} onChange={setRating} size="lg" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Título (opcional)</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
                                placeholder="Resumen de tu experiencia"
                                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-border rounded-2xl font-bold focus:ring-2 focus:ring-amber-400 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reseña *</label>
                            <textarea rows={4} required value={body} onChange={e => setBody(e.target.value)} maxLength={1000}
                                placeholder="Comparte tu experiencia con este vendedor..."
                                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-border rounded-2xl font-medium resize-none focus:ring-2 focus:ring-amber-400 outline-none" />
                            <p className="text-[10px] text-gray-400">{body.length}/1000</p>
                        </div>
                        <div className="flex gap-3">
                            <button type="submit" disabled={submitting || !body.trim()}
                                className="px-6 py-3 bg-amber-500 text-white rounded-2xl text-sm font-black hover:bg-amber-600 transition disabled:opacity-50">
                                {submitting ? 'Enviando...' : '✓ Publicar reseña'}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)}
                                className="px-6 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl text-sm font-black hover:bg-gray-200 transition">
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Lista de reseñas */}
            {data.reviews.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Todas las reseñas</h3>
                    {data.reviews.map((review: any) => (
                        <div key={review.id} className="bg-card border border-border rounded-2xl p-6 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-black text-amber-600">
                                        {(review.buyer.businessName || review.buyer.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-black text-sm text-foreground">{review.buyer.businessName || review.buyer.name}</p>
                                        <p className="text-[10px] text-gray-400">{new Date(review.createdAt).toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })}</p>
                                    </div>
                                </div>
                                <StarRating value={review.rating} size="sm" />
                            </div>
                            {review.title && <p className="font-black text-foreground">{review.title}</p>}
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{review.body}</p>

                            {/* Respuesta del vendedor */}
                            {review.sellerReply && (
                                <div className="ml-4 pl-4 border-l-2 border-border bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Respuesta del vendedor</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{review.sellerReply}</p>
                                </div>
                            )}

                            {/* Botón responder (solo si es el vendedor y no ha respondido) */}
                            {isOwner && !review.sellerReply && (
                                <div>
                                    {replyingTo === review.id ? (
                                        <div className="space-y-2">
                                            <textarea rows={3} value={replyText} onChange={e => setReplyText(e.target.value)}
                                                placeholder="Tu respuesta..."
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-border rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                                            <div className="flex gap-2">
                                                <button onClick={() => handleReply(review.id)}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition">
                                                    Publicar respuesta
                                                </button>
                                                <button onClick={() => setReplyingTo(null)}
                                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-black">
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setReplyingTo(review.id)}
                                            className="text-xs font-black text-blue-600 hover:underline">
                                            💬 Responder
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

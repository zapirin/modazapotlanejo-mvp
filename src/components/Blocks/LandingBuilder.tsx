"use client";
import React, { useState } from 'react';
import { LandingBlock, BlockType } from '@/lib/blocks';

interface Props {
    blocks: LandingBlock[];
    onChange: (blocks: LandingBlock[]) => void;
    onUploadImage: (file: File) => Promise<string>;
}

export default function LandingBuilder({ blocks, onChange, onUploadImage }: Props) {
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const generateId = () => Math.random().toString(36).substring(2, 9);

    const addBlock = (type: BlockType) => {
        let newBlock: any = { id: generateId(), type };
        if (type === 'heroSlider') newBlock.images = [];
        onChange([...blocks, newBlock as LandingBlock]);
    };

    const loadDefaultTemplate = () => {
        if (blocks.length > 0) {
            const confirmLoad = window.confirm(
                "¿Estás seguro de que deseas cargar la plantilla base? Esto reemplazará todos los bloques que tienes actualmente."
            );
            if (!confirmLoad) return;
        }

        const defaultBlocks: LandingBlock[] = [
            { id: generateId(), type: 'heroSlider', images: [] },
            { id: generateId(), type: 'featuredCategories' },
            { id: generateId(), type: 'newArrivals' },
            { id: generateId(), type: 'bestSellers' }
        ];

        onChange(defaultBlocks);
    };

    const removeBlock = (index: number) => {
        const newBlocks = [...blocks];
        newBlocks.splice(index, 1);
        onChange(newBlocks);
    };

    const moveBlock = (index: number, dir: -1 | 1) => {
        if (index + dir < 0 || index + dir >= blocks.length) return;
        const newBlocks = [...blocks];
        const temp = newBlocks[index];
        newBlocks[index] = newBlocks[index + dir];
        newBlocks[index + dir] = temp;
        onChange(newBlocks);
    };

    const updateBlock = (index: number, updates: Partial<LandingBlock>) => {
        const newBlocks = [...blocks];
        newBlocks[index] = { ...newBlocks[index], ...updates } as LandingBlock;
        onChange(newBlocks);
    };

    const handleUpload = async (file: File, blockIndex: number, isMultiple: boolean = false) => {
        const block = blocks[blockIndex];
        setUploadingId(block.id);
        try {
            const url = await onUploadImage(file);
            if (block.type === 'heroSlider') {
                updateBlock(blockIndex, { images: [...block.images, url] });
            } else if (block.type === 'banner') {
                updateBlock(blockIndex, { imageUrl: url });
            }
        } catch (e) {
            console.error(e);
            alert("Error al subir imagen");
        } finally {
            setUploadingId(null);
        }
    };

    const renderBlockEditor = (block: LandingBlock, index: number) => {
        return (
            <div key={block.id} className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm relative">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                    <h3 className="font-black text-sm uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        {block.type === 'heroSlider' && '🖼️ Hero Slider'}
                        {block.type === 'featuredCategories' && '📁 Categorías Destacadas'}
                        {block.type === 'bestSellers' && '🔥 Best Sellers'}
                        {block.type === 'newArrivals' && '✨ Nuevos Modelos'}
                        {block.type === 'banner' && '🎫 Banner Promocional'}
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => moveBlock(index, -1)} disabled={index === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">⬆️</button>
                        <button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">⬇️</button>
                        <button onClick={() => removeBlock(index)} className="p-1 hover:bg-red-100 text-red-500 rounded">🗑️</button>
                    </div>
                </div>

                {/* Common Title field for sections that support it */}
                {['featuredCategories', 'bestSellers', 'newArrivals'].includes(block.type) && (
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Título de Sección (Opcional)</label>
                        <input type="text" value={(block as any).title || ''} 
                            onChange={e => updateBlock(index, { title: e.target.value })}
                            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none" 
                            placeholder="Dejar en blanco para usar título por defecto" />
                    </div>
                )}

                {/* Hero Slider specifics */}
                {block.type === 'heroSlider' && (
                    <div className="space-y-4 pt-2 border-t border-border/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Texto de Etiqueta (Badge)</label>
                                <input type="text" value={(block as any).badgeText || ''} 
                                    onChange={e => updateBlock(index, { badgeText: e.target.value })}
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none" 
                                    placeholder="Ej: Tendencias Primavera 2026" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Alineación Horizontal</label>
                                <select value={(block as any).align || 'left'} 
                                    onChange={e => updateBlock(index, { align: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none">
                                    <option value="left">Izquierda</option>
                                    <option value="center">Centro</option>
                                    <option value="right">Derecha</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Alineación Vertical</label>
                                <select value={(block as any).verticalAlign || 'center'} 
                                    onChange={e => updateBlock(index, { verticalAlign: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none">
                                    <option value="top">Arriba</option>
                                    <option value="center">Centro</option>
                                    <option value="bottom">Abajo</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tamaño del Texto</label>
                                <select value={(block as any).textSize || 'normal'} 
                                    onChange={e => updateBlock(index, { textSize: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none">
                                    <option value="normal">Normal</option>
                                    <option value="compact">Compacto</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Título del Hero</label>
                            <input type="text" value={(block as any).title || ''} 
                                onChange={e => updateBlock(index, { title: e.target.value })}
                                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none font-bold" 
                                placeholder="Ej: LA MODA QUE MUEVE A MÉXICO." />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Subtítulo (Tagline)</label>
                                <input type="text" value={(block as any).subtitle || ''} 
                                    onChange={e => updateBlock(index, { subtitle: e.target.value })}
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none" 
                                    placeholder="Ej: Kalexa Fashion Marketplace" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Descripción (Párrafo)</label>
                                <textarea value={(block as any).description || ''} 
                                    onChange={e => updateBlock(index, { description: e.target.value })}
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none h-20 resize-none" 
                                    placeholder="Ej: Calidad premium, precios de fábrica..." />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Texto del Botón (CTA)</label>
                                <input type="text" value={(block as any).ctaText || ''} 
                                    onChange={e => updateBlock(index, { ctaText: e.target.value })}
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none" 
                                    placeholder="Ej: Explorar Catálogo" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Enlace del Botón (CTA Link)</label>
                                <input type="text" value={(block as any).ctaLink || ''} 
                                    onChange={e => updateBlock(index, { ctaLink: e.target.value })}
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none" 
                                    placeholder="Ej: /catalog" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Imágenes del Slider</label>
                            <div className="flex gap-2 flex-wrap mt-1">
                                {block.images.map((img, i) => (
                                    <div key={i} className="relative w-20 h-20 border rounded-lg overflow-hidden group">
                                        <img src={img} alt="slide" className="w-full h-full object-cover" />
                                        <button onClick={() => updateBlock(index, { images: block.images.filter((_, idx) => idx !== i) })}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100">×</button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2">
                                <input type="file" id={`upload-${block.id}`} className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], index, true)} />
                                <button onClick={() => document.getElementById(`upload-${block.id}`)?.click()} disabled={uploadingId === block.id}
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-border rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">
                                    {uploadingId === block.id ? 'Subiendo...' : '+ Añadir Imagen'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Banner specifics */}
                {block.type === 'banner' && (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Imagen del Banner</label>
                        {block.imageUrl ? (
                            <div className="relative h-32 w-full border rounded-lg overflow-hidden group">
                                <img src={block.imageUrl} alt="banner" className="w-full h-full object-cover" />
                                <button onClick={() => updateBlock(index, { imageUrl: '' })}
                                    className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100">Cambiar</button>
                            </div>
                        ) : (
                            <div>
                                <input type="file" id={`upload-${block.id}`} className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], index)} />
                                <button onClick={() => document.getElementById(`upload-${block.id}`)?.click()} disabled={uploadingId === block.id}
                                    className="w-full h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-sm font-bold text-gray-400 hover:bg-gray-50 disabled:opacity-50">
                                    {uploadingId === block.id ? 'Subiendo...' : 'Click para subir banner'}
                                </button>
                            </div>
                        )}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Enlace URL (Opcional)</label>
                            <input type="text" value={block.linkUrl || ''} onChange={e => updateBlock(index, { linkUrl: e.target.value })}
                                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none" placeholder="/catalog" />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-border flex flex-wrap gap-2 items-center">
                <span className="text-xs font-bold flex items-center mr-2">Agregar Bloque:</span>
                <button onClick={() => addBlock('heroSlider')} className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs shadow-sm hover:shadow">🖼️ Hero</button>
                <button onClick={() => addBlock('featuredCategories')} className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs shadow-sm hover:shadow">📁 Categorías</button>
                <button onClick={() => addBlock('bestSellers')} className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs shadow-sm hover:shadow">🔥 Más Vendidos</button>
                <button onClick={() => addBlock('newArrivals')} className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs shadow-sm hover:shadow">✨ Novedades</button>
                <button onClick={() => addBlock('banner')} className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs shadow-sm hover:shadow">🎫 Banner Custom</button>
                
                <button onClick={loadDefaultTemplate} type="button" className="ml-auto px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-lg text-xs font-bold hover:bg-blue-100 transition">
                    ✨ Cargar plantilla base
                </button>
            </div>

            <div className="space-y-4">
                {blocks.length === 0 && (
                    <div className="text-center py-10 bg-card border border-dashed rounded-xl flex flex-col items-center justify-center gap-3">
                        <div>
                            <p className="text-gray-400 font-medium">No hay bloques personalizados.</p>
                            <p className="text-xs text-gray-500 mt-1">Se usará el diseño predeterminado.</p>
                        </div>
                        <button type="button" onClick={loadDefaultTemplate} className="px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition">
                            ✨ Cargar diseño por defecto
                        </button>
                    </div>
                )}
                {blocks.map((b, i) => renderBlockEditor(b, i))}
            </div>
        </div>
    );
}

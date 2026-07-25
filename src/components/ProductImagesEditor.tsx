"use client";

// Editor de fotografías del producto: subir, quitar, y REORDENAR arrastrando
// (con mouse en computadora o con el dedo en celular/tablet). La foto que
// quede en primer lugar es la "Principal" (así la trata el resto de la app:
// catálogo, redes sociales, etc.). Componente controlado: el orden vive en
// el formulario padre vía `images` / `onChange`.

import React, { useRef } from 'react';
import { processImage } from '@/lib/imageUtils';
import {
    DndContext, closestCenter, PointerSensor, TouchSensor,
    useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, rectSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
    });
}

function SortablePhoto({ id, img, index, onRemove }: {
    id: string; img: string; index: number; onRemove: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 20 : undefined,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="relative aspect-square rounded-2xl overflow-hidden border border-border group bg-gray-50/50 dark:bg-card/50 border-dashed cursor-grab active:cursor-grabbing"
        >
            <img src={img} alt={`Foto ${index + 1}`} className="w-full h-full object-cover pointer-events-none" draggable={false} />
            {index === 0 && (
                <span className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-full shadow pointer-events-none">
                    ⭐ Principal
                </span>
            )}
            <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onRemove}
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg font-bold z-10"
            >
                ×
            </button>
        </div>
    );
}

export default function ProductImagesEditor({ images, onChange }: {
    images: string[];
    onChange: (next: string[]) => void;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // PointerSensor: mouse en computadora. TouchSensor con retardo: en
    // celular/tablet se mantiene presionado ~150ms para empezar a arrastrar,
    // así el gesto no choca con el desplazamiento normal de la página.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            onChange(arrayMove(images, Number(active.id), Number(over.id)));
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        let next = [...images];
        for (const file of files) {
            try {
                const { url } = await processImage(file, 'products');
                next = [...next, url];
            } catch {
                next = [...next, await readAsDataURL(file)];
            }
            onChange(next);
        }
        if (e.target) e.target.value = '';
    };

    const ids = images.map((_, i) => String(i));

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={ids} strategy={rectSortingStrategy}>
                    {images.map((img, idx) => (
                        <SortablePhoto
                            key={idx}
                            id={String(idx)}
                            img={img}
                            index={idx}
                            onRemove={() => onChange(images.filter((_, i) => i !== idx))}
                        />
                    ))}
                </SortableContext>
            </DndContext>
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
            >
                <span className="text-3xl mb-2">📸</span>
                <span className="text-xs font-bold px-4 text-center">Agregar Foto</span>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleUpload} />
        </div>
    );
}

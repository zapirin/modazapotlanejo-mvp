"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function ProductWizardPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        colors: [] as string[],
        sizes: { S: false, M: false, L: false },
        stock: '',
        retailPrice: '',
        isWholesale: false,
        wholesaleComposition: { S: 0, M: 0, L: 0 },
        wholesalePrice: '',
    });

    const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 4));
    const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

    const toggleColor = (color: string) => {
        setFormData((prev) => ({
            ...prev,
            colors: prev.colors.includes(color)
                ? prev.colors.filter((c) => c !== color)
                : [...prev.colors, color],
        }));
    };

    const toggleSize = (size: 'S' | 'M' | 'L') => {
        setFormData((prev) => ({
            ...prev,
            sizes: { ...prev.sizes, [size]: !prev.sizes[size] },
        }));
    };

    return (
        <div className="max-w-3xl mx-auto py-8">
            {/* Header del Wizard */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Agregar Nuevo Producto</h1>
                    <p className="text-gray-500 mt-1">Completa estos 4 pasos rápidos para publicar tu prenda.</p>
                </div>
                <Link href="/dashboard" className="text-sm font-medium text-blue-900 border border-blue-200 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition">
                    Cancelar
                </Link>
            </div>

            {/* Barra de Progreso */}
            <div className="mb-10 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -mt-0.5 rounded-full z-0"></div>
                <div
                    className="absolute top-1/2 left-0 h-1 bg-blue-600 -mt-0.5 rounded-full z-0 transition-all duration-300"
                    style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                ></div>
                <div className="relative z-10 flex justify-between">
                    {[1, 2, 3, 4].map((step) => (
                        <div
                            key={step}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${currentStep >= step
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-400'
                                }`}
                        >
                            {currentStep > step ? '✓' : step}
                        </div>
                    ))}
                </div>
                <div className="relative z-10 flex justify-between mt-2 px-1 text-xs font-medium text-gray-500">
                    <span>Básico</span>
                    <span>Variantes</span>
                    <span className="-ml-4">Precios</span>
                    <span>Fotos</span>
                </div>
            </div>

            {/* Contenedor de Pasos */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 min-h-[400px]">

                {/* PASO 1: Información Básica */}
                {currentStep === 1 && (
                    <div className="space-y-6 animate-fadeIn">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-4">1. Identificación del Producto</h2>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la prenda</label>
                            <input
                                type="text"
                                placeholder="Ej. Blusa Campesina Floral"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría Principal</label>
                            <select
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="">Selecciona una categoría</option>
                                <option value="dama">Ropa para Dama</option>
                                <option value="caballero">Ropa para Caballero</option>
                                <option value="infantil">Moda Infantil</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* PASO 2: Tallas y Colores */}
                {currentStep === 2 && (
                    <div className="space-y-8 animate-fadeIn">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-4">2. Tallas y Variantes Físicas</h2>

                        {/* Colores */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">¿En qué colores lo fabricas?</label>
                            <div className="flex gap-4">
                                {[
                                    { id: 'rojo', class: 'bg-red-500' },
                                    { id: 'negro', class: 'bg-gray-900' },
                                    { id: 'azul', class: 'bg-blue-500' },
                                    { id: 'blanco', class: 'bg-white border border-gray-300' }
                                ].map((color) => (
                                    <button
                                        key={color.id}
                                        onClick={() => toggleColor(color.id)}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform ${color.class} ${formData.colors.includes(color.id) ? 'ring-4 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                                            }`}
                                    >
                                        {formData.colors.includes(color.id) && <span className={color.id === 'blanco' ? 'text-black' : 'text-white'}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tallas */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">Tallas disponibles (General)</label>
                            <div className="flex gap-3">
                                {(['S', 'M', 'L'] as const).map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => toggleSize(size)}
                                        className={`px-6 py-2 rounded-lg font-bold border-2 transition-colors ${formData.sizes[size]
                                                ? 'bg-blue-50 border-blue-600 text-blue-700'
                                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Stock Total */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Total de piezas físicas en tu taller</label>
                            <input
                                type="number"
                                placeholder="Ej. 150 piezas"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-2">La plataforma irá descontando este número conforme tengas ventas en Internet o en tu Punto de Venta (POS).</p>
                        </div>
                    </div>
                )}

                {/* PASO 3: Precios Inteligentes B2B */}
                {currentStep === 3 && (
                    <div className="space-y-8 animate-fadeIn">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-4">3. Fija tus Precios</h2>

                        {/* Menudeo */}
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                                🛒 Vender por Pieza (Menudeo B2C)
                            </h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Precio al público general (MXN)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        placeholder="250.00"
                                        className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white transition"
                                        value={formData.retailPrice}
                                        onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Mayoreo / Pack */}
                        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-blue-900 flex items-center gap-2">
                                    📦 Vender en Paquete (Mayoreo B2B)
                                </h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.isWholesale}
                                        onChange={(e) => setFormData({ ...formData, isWholesale: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {formData.isWholesale && (
                                <div className="space-y-4 pt-4 border-t border-blue-200 animate-fadeIn">
                                    <label className="block text-sm font-medium text-blue-900 mb-1">¿Cómo armas tu "Corrida" o Paquete?</label>
                                    <div className="flex gap-4 items-center">
                                        {(['S', 'M', 'L'] as const).map((size) => (
                                            <div key={size} className="flex-1">
                                                <span className="block text-xs font-bold text-center mb-1 text-blue-800">Talla {size}</span>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min="0"
                                                    className="w-full text-center py-2 rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={formData.wholesaleComposition[size]}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        wholesaleComposition: {
                                                            ...formData.wholesaleComposition,
                                                            [size]: parseInt(e.target.value) || 0
                                                        }
                                                    })}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-4">
                                        <label className="block text-sm font-medium text-blue-900 mb-1">Precio Total del Paquete Completo (MXN)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-3 text-gray-500">$</span>
                                            <input
                                                type="number"
                                                placeholder="1200.00"
                                                className="w-full pl-8 pr-4 py-3 rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white transition"
                                                value={formData.wholesalePrice}
                                                onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* PASO 4: Fotos */}
                {currentStep === 4 && (
                    <div className="space-y-6 animate-fadeIn">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-4">4. ¡Muestra tu Prenda!</h2>

                        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-900 font-semibold text-center mb-1">Toma una foto con tu cámara</p>
                            <p className="text-sm text-gray-500 text-center">O presiona aquí para subir una de tu galería</p>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
                            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="text-sm">¿Sabías que tus prendas se venden un 300% más rápido si contratas nuestro servicio fotográfico con modelos reales? Solicítalo gratis con tu **Saldo Exclusivo B2B** al final.</p>
                        </div>
                    </div>
                )}

            </div>

            {/* Controles de Navegación */}
            <div className="mt-8 flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <button
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className={`px-6 py-2.5 rounded-lg font-bold transition-all ${currentStep === 1
                            ? 'opacity-0 cursor-default'
                            : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                        }`}
                >
                    Atrás
                </button>

                {currentStep < 4 ? (
                    <button
                        onClick={nextStep}
                        className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all flex items-center gap-2"
                    >
                        Siguiente Paso <span className="text-lg">→</span>
                    </button>
                ) : (
                    <button
                        className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md transition-all flex items-center gap-2"
                    >
                        🔥 Publicar Producto
                    </button>
                )}
            </div>

        </div>
    );
}

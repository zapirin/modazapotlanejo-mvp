'use client';

import React, { useState } from 'react';

interface ManualImagePlaceholderProps {
  description: string;
  imagePath?: string; // Si ya tienen la imagen, la pueden pasar por aquí
}

export default function ManualImagePlaceholder({ description, imagePath }: ManualImagePlaceholderProps) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  if (imagePath) {
    return (
      <div className="my-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm relative group">
        <img src={imagePath} alt={description} className="w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="my-8 print:my-4 print:border-gray-300 relative group">
      <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[200px] transition-colors hover:bg-gray-50 hover:border-blue-400">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="32" 
          height="32" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="text-gray-400 mb-3"
        >
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Falta Captura de Pantalla</h3>
        <p className="text-xs text-gray-500 max-w-sm">
          {description}
        </p>
        <p className="text-[10px] text-gray-400 mt-4 print:hidden">
          Para añadir la imagen, busca este componente en el código y agrega: <br/>
          <code className="bg-gray-200 px-1 rounded text-gray-600">imagePath="/imagenes/tu-imagen.png"</code>
        </p>
      </div>
      
      <button 
        onClick={() => setHidden(true)}
        className="absolute top-2 right-2 bg-white border border-gray-200 text-gray-500 hover:text-red-500 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
        title="Ocultar este espacio (solo temporalmente en pantalla)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    </div>
  );
}

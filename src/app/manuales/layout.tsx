'use client';

import React from 'react';
import Link from 'next/link';

export default function ManualesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 selection:bg-blue-100">
      {/* Header flotante, oculto al imprimir */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="font-bold text-xl tracking-tight text-blue-900">
              Moda Zapotlanejo
            </div>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-sm font-medium text-gray-600 hidden sm:inline">Centro de Ayuda</span>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>
            </svg>
            Guardar como PDF
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 py-10 print:py-0">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 bg-white sm:shadow-lg sm:rounded-2xl sm:border border-gray-200 py-12 print:shadow-none print:border-none print:px-0 print:py-0">
          {children}
        </div>
      </main>

      {/* Footer oculto al imprimir */}
      <footer className="bg-white border-t border-gray-200 py-8 print:hidden mt-auto">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Moda Zapotlanejo. Todos los derechos reservados.</p>
        </div>
      </footer>
      
      {/* Estilos globales para impresión */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            font-size: 11pt;
            color: black;
          }
          @page {
            margin: 1.5cm;
          }
          /* Evita que los títulos se queden solos al final de la página */
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }
          /* Evita que las imágenes se corten a la mitad */
          img, svg, div.group {
            page-break-inside: avoid;
          }
          /* Mantener listas unidas en lo posible */
          ul, ol, p {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

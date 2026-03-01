import Link from 'next/link';
import React from 'react';

export default function SellerCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar / Menú Lateral */}
      <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Moda<span className="text-blue-600">Zapotlanejo</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">Panel de Fabricante</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <Link href="/seller-center/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            <span className="text-lg">📊</span>
            Mis Ventas
          </Link>

          <Link href="/seller-center/inventory" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            <span className="text-lg">📦</span>
            Mi Inventario
          </Link>

          <Link href="/seller-center/products/new" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100">
            <span className="text-lg">✨</span>
            Nuevo Producto (Wizard)
          </Link>

          <Link href="/seller-center/pos" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
            <span className="text-lg">💳</span>
            Mi Punto de Venta (POS)
          </Link>

          <Link href="/seller-center/vas/photography" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            <span className="text-lg">📸</span>
            Solicitar Fotos
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              ML
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Modas Lucy</p>
              <p className="text-xs text-gray-500">Local 104, Centro</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">Panel Activo</h1>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Conectado a Sucursal
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

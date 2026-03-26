"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { logout } from '../actions/auth';
import { getUnreadCount } from '../actions/messages';

export default function SidebarLayout({
  children,
  user
}: {
  children: React.ReactNode;
  user: any;
}) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const pathname = usePathname() || '';

    // Auto-open inventory if we are inside any inventory route
    useEffect(() => {
        if (pathname.startsWith('/inventory') || pathname.startsWith('/products')) {
            setIsInventoryOpen(true);
        }
    }, [pathname]);

    // Fetch unread messages count
    useEffect(() => {
        const fetchUnread = async () => {
            try {
                const count = await getUnreadCount();
                setUnreadCount(count);
            } catch (error) {
                console.error('Error fetching unread count:', error);
            }
        };
        fetchUnread();
        
        // Refresh every 30 seconds
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, []);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // Default to light if no preference is saved, to avoid system theme sync
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, []);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  // Cajero: interfaz mínima — solo POS y cerrar sesión, colapsable
  if (user?.role === 'CASHIER') {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar cajero — colapsable */}
        <aside className={`shrink-0 h-full bg-gray-950 text-white flex flex-col border-r border-white/10 transition-all duration-300 ${isSidebarOpen ? 'w-56' : 'w-12'}`}>
          {/* Toggle */}
          <div className="flex items-center justify-between px-3 py-4 border-b border-white/10">
            {isSidebarOpen && (
              <div className="min-w-0">
                <p className="font-black text-white text-sm truncate">{user.name}</p>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Cajero</p>
              </div>
            )}
            <button onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="w-7 h-7 flex flex-col justify-center items-center gap-1 shrink-0 hover:bg-white/10 rounded-lg transition-all p-1">
              <span className="block w-4 h-0.5 bg-gray-400"/>
              <span className="block w-4 h-0.5 bg-gray-400"/>
              <span className="block w-4 h-0.5 bg-gray-400"/>
            </button>
          </div>
          <nav className="flex-1 p-2">
            <Link href="/pos"
              className={`flex items-center gap-2 px-2 py-3 rounded-xl font-black text-xs transition-all ${pathname === '/pos' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}>
              <span className="text-base shrink-0">🖥️</span>
              {isSidebarOpen && <span className="uppercase tracking-wider truncate">Punto de Venta</span>}
            </Link>
          </nav>
          <div className="p-2 border-t border-white/10">
            <button onClick={async () => { await logout(); window.location.href = '/login'; }}
              className="w-full px-2 py-3 text-red-400 hover:bg-red-500/10 rounded-xl font-black text-xs transition-all flex items-center gap-2">
              <span className="text-base shrink-0">🚪</span>
              {isSidebarOpen && <span className="uppercase tracking-wider">Salir</span>}
            </button>
          </div>
        </aside>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground transition-colors duration-300 overflow-hidden font-sans">
      {/* Sidebar / Menú Lateral - Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar (Premium Dark/Light Style) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-card border-r border-border shadow-xl flex flex-col transition-all duration-300 ease-in-out
        lg:static lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        ${isDesktopCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64
      `}>
        {/* Logo block */}
        <div className={`p-6 border-b border-border flex shrink-0 items-center ${isDesktopCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`${isDesktopCollapsed ? 'hidden' : 'block'}`}>
            <a href="https://tienda-modazapo.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity group flex items-center gap-1.5" title="Ir al Marketplace">
              <h2 className="text-2xl font-bold tracking-tight">
                Moda<span className="text-blue-600">Zapotlanejo</span>
              </h2>
              <span className="text-[9px] text-gray-400 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100">↗</span>
            </a>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider font-semibold">
              {user?.role === 'BUYER' ? 'Mi Cuenta' : 'Panel de Fabricante'}
            </p>
          </div>
          {isDesktopCollapsed && (
            <div className="text-2xl font-bold tracking-tight text-blue-600 hidden lg:block">MZ</div>
          )}
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-4 overflow-x-hidden">
          <div className="space-y-1">
            <p className={`px-3 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ${isDesktopCollapsed ? 'hidden' : 'block'}`}>
              {user?.role === 'BUYER' ? 'Navegación' : 'Operaciones'}
            </p>
            
            {/* Common Links / Dashboard */}
            <Link
                href="/dashboard"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname === '/dashboard' ? 'font-bold bg-gray-100 dark:bg-gray-800 text-foreground' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
            >
                <span className="text-lg group-hover:scale-110 transition-transform shrink-0">
                  {user?.role === 'BUYER' ? '🏠' : '📊'}
                </span>
                <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>
                  {user?.role === 'BUYER' ? 'Inicio' : 'Panel de Control'}
                </span>
            </Link>

            {/* Common: Messages */}
            <Link
                href="/messages"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/messages') ? 'font-bold bg-gray-100 dark:bg-gray-800 text-foreground' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg group-hover:scale-110 transition-transform shrink-0">💬</span>
                    <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Mensajes</span>
                </div>
                {unreadCount > 0 && (
                    <span className={`bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center ${isDesktopCollapsed ? 'absolute top-1 right-1 border-2 border-card' : ''}`}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </Link>
            <Link
                href="/reviews"
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${pathname === '/reviews' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
                <span>⭐</span>
                <span className={isDesktopCollapsed ? 'hidden' : 'block'}>Calificaciones</span>
            </Link>

            {/* SELLER Only: Clients, POS, Reports */}
            {user?.role === 'SELLER' && (
              <>
                <Link
                    href="/clients"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/clients') ? 'font-bold bg-gray-100 dark:bg-gray-800 text-foreground' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
                >
                    <span className="text-lg group-hover:scale-110 transition-transform shrink-0">👥</span>
                    <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Clientes</span>
                </Link>

                <Link
                    href="/pos"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/pos') ? 'font-bold text-blue-700 bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/10' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
                >
                    <span className="text-lg group-hover:scale-110 transition-transform shrink-0">💳</span>
                    <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Punto de Venta</span>
                </Link>

                <Link
                    href="/reports"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/reports') ? 'font-bold bg-gray-100 dark:bg-gray-800 text-foreground' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
                >
                    <span className="text-lg group-hover:scale-110 transition-transform shrink-0">📈</span>
                    <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Reportes</span>
                </Link>
              </>
            )}

            {/* BUYER Only: Purchases */}
            {user?.role === 'BUYER' && (
              <Link
                  href="/orders"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/orders') ? 'font-bold bg-gray-100 dark:bg-gray-800 text-foreground' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
              >
                  <span className="text-lg group-hover:scale-110 transition-transform shrink-0">🛍️</span>
                  <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Mis Compras</span>
              </Link>
            )}

            {/* Admin Settlement (Only for ADMIN) */}
            {user?.role === 'ADMIN' && (
              <>
                <Link
                    href="/admin/settlements"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/admin/settlements') ? 'font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
                >
                    <span className="text-lg group-hover:scale-110 transition-transform shrink-0">🏧</span>
                    <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Liquidaciones</span>
                </Link>

                <Link
                    href="/admin/marketplace"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/admin/marketplace') ? 'font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
                >
                    <span className="text-lg group-hover:scale-110 transition-transform shrink-0">🖼️</span>
                    <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Configuración Web</span>
                </Link>
              </>
            )}

            {/* Seller Earnings (Only for SELLER) */}
            {user?.role === 'SELLER' && (
              <Link
                  href="/dashboard/earnings"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/dashboard/earnings') ? 'font-bold bg-green-50 text-green-600 dark:bg-green-900/20' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
              >
                  <span className="text-lg group-hover:scale-110 transition-transform shrink-0">💸</span>
                  <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Mis Ganancias</span>
              </Link>
            )}

            {/* Inventory Accordion - SELLER Only (Admins manage via Marketplace control if needed) */}
            {user?.role === 'SELLER' && (
              <div className="pt-2">
                  <button 
                      onClick={() => {
                          if (isDesktopCollapsed) setIsDesktopCollapsed(false);
                          setIsInventoryOpen(!isInventoryOpen);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/inventory') || pathname.startsWith('/products') ? 'font-bold bg-gray-100 dark:bg-gray-800 text-foreground' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
                  >
                      <div className="flex items-center gap-3">
                          <span className="text-lg group-hover:scale-110 transition-transform shrink-0">📦</span>
                          <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Inventario</span>
                      </div>
                      {!isDesktopCollapsed && (
                          <svg className={`w-4 h-4 transition-transform duration-200 ${isInventoryOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      )}
                  </button>
                  
                  {/* Accordion Content */}
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isInventoryOpen && !isDesktopCollapsed ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                      <div className="ml-9 border-l border-gray-200 dark:border-gray-700 pl-3 space-y-1 flex flex-col">
                          {[
                              { href: '/inventory', label: 'Todos los Productos' },
                              { href: '/products/new', label: 'Nuevo Producto' },
                              { href: '/inventory/brands', label: 'Marcas' },
                              { href: '/inventory/categories', label: 'Categorías' },
                              { href: '/inventory/tags', label: 'Etiquetas' },
                              { href: '/inventory/suppliers', label: 'Proveedores' },
                          ].map(sub => (
                              <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={`px-3 py-2 text-xs rounded-lg transition-colors ${pathname === sub.href ? 'bg-blue-50 text-blue-700 font-bold dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'}`}
                              >
                                  {sub.label}
                              </Link>
                          ))}
                      </div>
                  </div>
              </div>
            )}

            {user?.role === 'SELLER' && (
              <Link
                  href="/vas/photography"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/vas') ? 'font-bold bg-gray-100 dark:bg-gray-800 text-foreground' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
              >
                  <span className="text-lg group-hover:scale-110 transition-transform shrink-0">📸</span>
                  <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Solicitar Fotos</span>
              </Link>
            )}
          </div>

          <div className="space-y-1">
            <p className={`px-3 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 mt-4 ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Ajustes</p>
            
            {/* Settings Accordion Container */}
            <div className="bg-gray-50/50 dark:bg-gray-800/20 rounded-xl overflow-hidden">
              <button 
                  onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                  className={`w-full flex items-center justify-between px-3 py-3 text-sm transition-all duration-200 group hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none ${isSettingsExpanded ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
              >
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                      <span className="text-lg group-hover:rotate-12 transition-transform shrink-0">⚙️</span>
                      <span className={`font-bold whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>
                          Configuración
                      </span>
                  </div>
                  <svg 
                      className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isSettingsExpanded ? 'rotate-180' : ''} ${isDesktopCollapsed ? 'hidden' : 'block'}`} 
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
              </button>

              <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${isSettingsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
              >
                  <div className={`p-2 flex flex-col gap-1 ${isDesktopCollapsed ? 'hidden' : 'block'}`}>
                      {[
                          ...(user?.role !== 'BUYER' ? [{ href: '/settings/general', label: 'Tienda y Facturación' }] : []),
                          ...(user?.role === 'SELLER' || user?.role === 'ADMIN' ? [{ href: '/settings/denominations', label: 'Denominaciones' }] : []),
                          { href: '/settings/profile', label: 'Mi Perfil' },
                          ...(user?.role !== 'BUYER' ? [
                            { href: '/settings/locations', label: 'Sucursales y Tickets' },
                            { href: '/settings/price-tiers', label: 'Niveles de Precios' },
                            { href: '/settings/payment-methods', label: 'Formas de Pago' },
                            { href: '/settings/team', label: 'Mi Equipo' },
                          ] : []),
                      ].map(sub => (
                          <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`px-3 py-2 text-xs rounded-lg transition-colors ${pathname === sub.href ? 'bg-blue-50 text-blue-700 font-bold dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'}`}
                          >
                              {sub.label}
                          </Link>
                      ))}
                  </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-border mt-auto space-y-3">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="w-10 h-10 shrink-0 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {user?.name?.substring(0, 2).toUpperCase() || 'US'}
            </div>
            <div className={`overflow-hidden ${isDesktopCollapsed ? 'hidden' : 'block'}`}>
              <p className="text-sm font-bold truncate">{user?.name}</p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase truncate">
                {user?.role === 'BUYER' ? (user.isWholesale ? 'Mayorista' : 'COMPRADOR') : user.role}
              </p>
              {user?.location?.name && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.location.name}</p>
              )}
            </div>
          </div>
          
          <button 
            onClick={async () => {
              await logout();
              window.location.href = '/login';
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 ${isDesktopCollapsed ? 'justify-center' : ''}`}
            title="Cerrar Sesión"
          >
            <span className="text-lg">🚪</span>
            <span className={`${isDesktopCollapsed ? 'hidden' : 'block'}`}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Premium Header */}
        <header className="bg-card shadow-sm border-b border-border px-4 lg:px-8 py-3 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              className="hidden lg:block p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
              title="Alternar Menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight">Panel Principal</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-yellow-400 hover:scale-110 transition-all shadow-sm border border-border group"
              title='Cambiar tema oscuro/claro'
            >
              <svg className="w-5 h-5 hidden dark:block" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" /></svg>
              <svg className="w-5 h-5 block dark:hidden" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
            </button>

            <span className="hidden sm:flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-900/30">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              EN LÍNEA
            </span>
          </div>
        </header>

        {/* Content Region */}
        <div className="flex-1 overflow-auto relative">
          {children}
        </div>
      </main>
    </div>
  );
}

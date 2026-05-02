"use client";

import Link from "next/link";

interface AdminDashboardProps {
    userName: string;
    activeSellers: number;
    pendingApplications: number;
    subsOverdue: number;
    subsSoon: number;
    marketplaceOrdersCount: number;
    marketplaceRevenue: number;
    marketplaceCommission: number;
    marketplaceNet: number;
    pendingSettlements: number;
    recentOrders: any[];
}

export default function AdminDashboard({
    userName,
    activeSellers,
    pendingApplications,
    subsOverdue,
    subsSoon,
    marketplaceOrdersCount,
    marketplaceRevenue,
    marketplaceCommission,
    marketplaceNet,
    pendingSettlements,
    recentOrders,
}: AdminDashboardProps) {
    const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    const subsAlerts = subsOverdue + subsSoon;

    return (
        <div className="max-w-7xl mx-auto py-6 lg:py-10 px-4 space-y-8">
            <div className="border-b border-border pb-6">
                <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tight">
                    Bienvenido de nuevo, {userName}
                </h1>
                <p className="text-gray-500 font-medium mt-2">Panel del administrador del marketplace.</p>
            </div>

            {/* KPIs principales del marketplace */}
            <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Resumen del marketplace</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard title="Pedidos online" value={marketplaceOrdersCount.toString()} sub="Todas las órdenes registradas" icon="🛒" />
                    <KpiCard title="Bruto" value={fmt(marketplaceRevenue)} sub="Ventas totales del marketplace" icon="💰" valueClass="text-foreground" />
                    <KpiCard title="Comisión" value={fmt(marketplaceCommission)} sub="Tu ganancia del marketplace" icon="💸" valueClass="text-emerald-600 dark:text-emerald-400" />
                    <KpiCard title="Neto a vendedores" value={fmt(marketplaceNet)} sub="Lo que se transfiere a los vendedores" icon="🏭" valueClass="text-blue-600 dark:text-blue-400" />
                </div>
            </div>

            {/* Atención requerida */}
            <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Atención requerida</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link href="/admin/applications" className="group">
                        <div className={`bg-card border rounded-3xl p-6 shadow-sm hover:shadow-md transition ${pendingApplications > 0 ? 'border-amber-300 dark:border-amber-700' : 'border-border'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Solicitudes pendientes</p>
                            <h3 className={`text-4xl font-black mt-2 tabular-nums ${pendingApplications > 0 ? 'text-amber-500' : 'text-foreground'}`}>{pendingApplications}</h3>
                            <p className="text-xs text-gray-400 font-medium mt-1">Vendedores nuevos por aprobar</p>
                            <p className="text-xs font-black text-blue-500 mt-3 group-hover:underline">Revisar →</p>
                        </div>
                    </Link>

                    <Link href="/admin/marketplace" className="group">
                        <div className={`bg-card border rounded-3xl p-6 shadow-sm hover:shadow-md transition ${subsOverdue > 0 ? 'border-red-300 dark:border-red-700' : subsSoon > 0 ? 'border-amber-300 dark:border-amber-700' : 'border-border'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Suscripciones</p>
                            <h3 className={`text-4xl font-black mt-2 tabular-nums ${subsOverdue > 0 ? 'text-red-500' : subsSoon > 0 ? 'text-amber-500' : 'text-foreground'}`}>{subsAlerts}</h3>
                            <p className="text-xs text-gray-400 font-medium mt-1">
                                {subsOverdue} vencidas · {subsSoon} por vencer
                            </p>
                            <p className="text-xs font-black text-blue-500 mt-3 group-hover:underline">Ir a suscripciones →</p>
                        </div>
                    </Link>

                    <Link href="/admin/settlements" className="group">
                        <div className={`bg-card border rounded-3xl p-6 shadow-sm hover:shadow-md transition ${pendingSettlements > 0 ? 'border-purple-300 dark:border-purple-700' : 'border-border'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Liquidaciones pendientes</p>
                            <h3 className={`text-4xl font-black mt-2 tabular-nums ${pendingSettlements > 0 ? 'text-purple-500' : 'text-foreground'}`}>{pendingSettlements}</h3>
                            <p className="text-xs text-gray-400 font-medium mt-1">Órdenes por liquidar con vendedores</p>
                            <p className="text-xs font-black text-blue-500 mt-3 group-hover:underline">Ir a liquidaciones →</p>
                        </div>
                    </Link>

                    <Link href="/admin/marketplace" className="group">
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vendedores activos</p>
                            <h3 className="text-4xl font-black text-foreground mt-2 tabular-nums">{activeSellers}</h3>
                            <p className="text-xs text-gray-400 font-medium mt-1">Cuentas con isActive = true</p>
                            <p className="text-xs font-black text-blue-500 mt-3 group-hover:underline">Gestionar →</p>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Acciones rápidas */}
            <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Accesos rápidos</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <QuickLink href="/admin/marketplace" label="Marketplace" icon="🏭" />
                    <QuickLink href="/admin/applications" label="Solicitudes" icon="📋" />
                    <QuickLink href="/admin/settlements" label="Liquidaciones" icon="🧾" />
                    <QuickLink href="/admin/costs" label="Costos / %" icon="⚙️" />
                    <QuickLink href="/reports" label="Comisiones" icon="📊" />
                </div>
            </div>

            {/* Pedidos recientes del marketplace */}
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                    <h3 className="font-black text-foreground text-lg">Pedidos recientes del marketplace</h3>
                    <Link href="/orders" className="text-xs font-black text-blue-500 hover:underline">Ver todos →</Link>
                </div>
                {recentOrders.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 font-medium text-sm">No hay pedidos recientes.</div>
                ) : (
                    <div className="divide-y divide-border">
                        {recentOrders.map((o: any) => (
                            <div key={o.id} className="flex items-center gap-4 px-6 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground">
                                        #{o.orderNumber || o.id.slice(-6).toUpperCase()}
                                        <span className="ml-3 text-xs text-gray-400 font-medium">
                                            {new Date(o.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                    </p>
                                    <p className="text-xs text-gray-500 font-medium truncate">
                                        {o.buyer?.businessName || o.buyer?.name || 'Comprador'}
                                        {o.items?.length ? ` · ${o.items.length} producto${o.items.length !== 1 ? 's' : ''}` : ''}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                    o.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' :
                                    o.status === 'ACCEPTED' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' :
                                    o.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                                    'bg-gray-50 text-gray-500 border-gray-200'
                                }`}>{o.status}</span>
                                <div className="text-right w-32">
                                    <p className="font-black text-foreground tabular-nums">{fmt(o.total)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function KpiCard({ title, value, sub, icon, valueClass }: { title: string; value: string; sub: string; icon: string; valueClass?: string }) {
    return (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm overflow-hidden relative group">
            <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:scale-110 group-hover:-rotate-6 transition-transform blur-[2px]">{icon}</div>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">{title}</p>
            <h3 className={`text-3xl lg:text-4xl font-black mt-2 mb-1 tracking-tighter tabular-nums ${valueClass || 'text-foreground'}`}>{value}</h3>
            <p className="text-xs text-gray-400 font-medium">{sub}</p>
        </div>
    );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
    return (
        <Link href={href} className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition flex items-center gap-3 group">
            <span className="text-2xl">{icon}</span>
            <span className="font-black text-sm text-foreground uppercase tracking-wide">{label}</span>
        </Link>
    );
}

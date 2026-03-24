"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { addLayawayPayment, deleteSale, updateSaleNotes } from '../products/new/actions';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';

interface DashboardClientProps {
    userName: string;
    salesTotal: number;
    inventoryTotal: number;
    clientsTotal: number;
    weeklyChartData: Array<{ dateStr: string; dayName: string; total: number }>;
    thirtyDayTrend: Array<{ dateStr: string; dayName: string; day: number; total: number }>;
    categoryDistribution: Array<{ name: string; value: number }>;
    recentSales: any[];
    userLocationName: string;
    topProducts: Array<{ name: string; totalSold: number; image: string | null }>;
    inventoryValue: number;
    topBrands: Array<{ name: string; totalRevenue: number }>;
    lowStock: Array<{ name: string; color: string; size: string; stock: number }>;
    marketplaceOrdersCount: number;
    marketplaceRevenue: number;
    marketplaceCommission: number;
    marketplaceNet: number;
    recentOrders: any[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

export default function DashboardClient({ 
    userName, 
    salesTotal, 
    inventoryTotal, 
    clientsTotal,
    weeklyChartData,
    thirtyDayTrend,
    categoryDistribution,
    recentSales,
    userLocationName,
    topProducts,
    inventoryValue,
    topBrands,
    lowStock,
    marketplaceOrdersCount,
    marketplaceRevenue,
    marketplaceCommission,
    marketplaceNet,
    recentOrders
}: DashboardClientProps) {
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [selectedLayaway, setSelectedLayaway] = useState<any>(null);
    const [editingSale, setEditingSale] = useState<any>(null);
    const [editNotes, setEditNotes] = useState('');
    const [layawayAbono, setLayawayAbono] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAbono = async () => {
        if (!selectedLayaway) return;
        const amt = parseFloat(layawayAbono);
        if (isNaN(amt) || amt <= 0 || amt > selectedLayaway.balance) {
            return alert("Ingrese un abono válido menor o igual al saldo restante.");
        }
        
        setIsProcessing(true);
        const res = await addLayawayPayment(selectedLayaway.id, amt, 'Efectivo');
        setIsProcessing(false);

        if (res.success) {
            alert(`Abono registrado exitosamente. Nuevo saldo: $${res.newBalance?.toFixed(2)}\nEstado: ${res.status === 'COMPLETED' ? 'PAGADO' : 'APARTADO'}`);
            setSelectedLayaway(null);
            setLayawayAbono('');
            // Page reload is handled by revalidatePath in the action, but we can force refresh if needed.
            window.location.reload();
        } else {
            alert(res.error || "Ocurrió un error al registrar el abono.");
        }
    };

    const handleEditSale = async () => {
        if (!editingSale) return;
        const res = await updateSaleNotes(editingSale.id, editNotes);
        if (res.success) {
            toast.success('Venta actualizada');
            setEditingSale(null);
            window.location.reload();
        } else {
            toast.error(res.error || 'Error al actualizar');
        }
    };

    const handleCancelSale = async (sale: any) => {
        if (!confirm(`¿Estás seguro de cancelar el ticket #PDV${sale.receiptNumber} por $${sale.total.toFixed(2)}?\n\nEsta acción devolverá los artículos al inventario y marcará el ticket como CANCELADO.`)) {
            return;
        }

        setIsProcessing(true);
        const res = await deleteSale(sale.id);
        setIsProcessing(false);

        if (res.success) {
            alert("Venta cancelada exitosamente y el inventario ha sido restaurado.");
            window.location.reload();
        } else {
            alert(res.error || "Ocurrió un error al cancelar la venta.");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Bienvenido de nuevo, {userName}</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Aquí está el resumen de tu negocio en {userLocationName} hoy.
                </p>
            </div>

            {/* Tarjetas de Métricas Interactivas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href="/reports" className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col justify-between hover:border-blue-500/50 hover:shadow-md transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:scale-110 group-hover:-rotate-6 transition-transform blur-[2px]">💰</div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-blue-500 mb-1">Ventas de Hoy</p>
                        <p className="text-3xl font-black text-foreground tabular-nums">${salesTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="mt-4 flex items-center text-sm font-bold text-gray-500 group-hover:text-blue-600 transition-colors">
                        Ver Reportes <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                </Link>

                <Link href="/inventory" className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col justify-between hover:border-purple-500/50 hover:shadow-md transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:scale-110 group-hover:-rotate-6 transition-transform blur-[2px]">📦</div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-purple-500 mb-1">Stock General</p>
                        <p className="text-3xl font-black text-foreground tabular-nums">{inventoryTotal.toLocaleString()} <span className="text-lg font-medium text-gray-400">Pzs</span></p>
                    </div>
                    <div className="mt-4 flex items-center text-sm font-bold text-gray-500 group-hover:text-purple-600 transition-colors">
                        Gestionar Inventario <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                </Link>

                <div className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col justify-between hover:border-amber-500/50 hover:shadow-md transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:scale-110 group-hover:-rotate-6 transition-transform blur-[2px]">🏛️</div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-amber-500 mb-1">Valor de Inventario</p>
                        <p className="text-3xl font-black text-foreground tabular-nums">${inventoryValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="mt-4 flex items-center text-sm font-bold text-gray-500 group-hover:text-amber-600 transition-colors">
                        Capital en Mercancía <div className="ml-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                    </div>
                </div>
            </div>

            {/* Marketplace Statistics */}
            {/* Marketplace Statistics & Revenue Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                <div className="lg:col-span-1 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 text-8xl opacity-10 group-hover:scale-110 transition-transform">🛒</div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Ventas Marketplace</p>
                        <h3 className="text-4xl font-black mb-1">${marketplaceRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
                        <p className="text-sm font-bold opacity-90">{marketplaceOrdersCount} pedidos totales realizados</p>
                    </div>
                    <div className="mt-6 flex gap-3 relative z-10">
                        <Link href="/orders" className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                            Gestionar Pedidos
                        </Link>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col items-center justify-center">
                    <div className="w-full flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Desglose de Ingresos Marketplace</h3>
                    </div>
                    <div className="w-full h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { name: 'Bruto', monto: marketplaceRevenue, fill: '#3b82f6' },
                                { name: 'Comisión', monto: marketplaceCommission, fill: '#ef4444' },
                                { name: 'Neto', monto: marketplaceNet, fill: '#10b981' }
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Monto']}
                                />
                                <Bar dataKey="monto" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Gráfica Avanzada 30 Días */}
            <div className="bg-card rounded-3xl shadow-sm border border-border p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Tendencia de Ventas (30 Días)</h3>
                        <p className="text-xl font-black">Análisis de Crecimiento</p>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                        <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-gray-700 rounded-lg shadow-sm">Mensual</button>
                    </div>
                </div>
                
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={thirtyDayTrend}>
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <XAxis 
                                dataKey="day" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                minTickGap={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                tickFormatter={(value) => `$${value.toLocaleString()}`}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    borderRadius: '20px', 
                                    border: 'none', 
                                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                                    padding: '12px'
                                }}
                                formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Ventas']}
                                labelStyle={{ fontWeight: 'black', marginBottom: '4px' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="total" 
                                stroke="#3b82f6" 
                                strokeWidth={4}
                                fillOpacity={1} 
                                fill="url(#colorTotal)" 
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Distribución por Categorías */}
                 <div className="bg-card rounded-3xl shadow-sm border border-border p-8 flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Ventas por Categoría</h3>
                    <div className="flex-1 min-h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    animationDuration={1500}
                                >
                                    {categoryDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Ventas']}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36} 
                                    iconType="circle"
                                    formatter={(value) => <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Últimos Pedidos Recientes (Re-located) */}
                <div className="bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Últimos Pedidos Marketplace</h3>
                                <p className="text-sm font-bold text-foreground">Actividad Reciente</p>
                            </div>
                            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full">En Vivo</span>
                        </div>
                        <div className="space-y-4">
                            {recentOrders && recentOrders.length > 0 ? (
                                recentOrders.map((order: any) => (
                                    <div key={order.id} className="flex justify-between items-center py-3 border-b border-border last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 px-2 rounded-xl transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-xs">📦</div>
                                            <div>
                                                <p className="text-xs font-black text-foreground">#{order.orderNumber || order.id.slice(-6).toUpperCase()}</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase">{order.buyer?.businessName || order.buyer?.name || 'Cliente'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-foreground">${order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                            <p className="text-[9px] text-gray-400 font-medium uppercase">{new Date(order.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10">
                                    <p className="text-xs text-gray-400 italic">No hay pedidos recientes.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <Link href="/orders" className="mt-6 text-center text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors">
                        Ver todos los pedidos →
                    </Link>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Alertas de Stock Bajo */}
                <div className="lg:col-span-1 bg-card rounded-3xl shadow-sm border border-border p-6 border-l-4 border-l-red-500">
                    <h3 className="text-xs font-black uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                        <span className="animate-bounce">⚠️</span> Stock Crítico
                    </h3>
                    <div className="space-y-3">
                        {lowStock.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-foreground uppercase truncate">{item.name}</p>
                                    <p className="text-[9px] text-gray-500 font-bold">{item.color} • {item.size}</p>
                                </div>
                                <div className="text-xs font-black text-red-600 bg-white dark:bg-gray-800 px-2 py-1 rounded-lg">
                                    {item.stock}
                                </div>
                            </div>
                        ))}
                        {lowStock.length === 0 && (
                            <p className="text-xs text-gray-400 italic py-2">Inventario saludable.</p>
                        )}
                    </div>
                    <Link href="/inventory" className="mt-4 block text-center text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors">
                        Surtir Mercancía →
                    </Link>
                </div>

                {/* Top Marcas */}
                <div className="lg:col-span-1 bg-card rounded-3xl shadow-sm border border-border p-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Marcas Estrella</h3>
                    <div className="space-y-4">
                        {topBrands.map((brand, idx) => (
                            <div key={idx} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-black text-gray-400">
                                        {brand.name[0]}
                                    </div>
                                    <p className="text-[10px] font-bold text-foreground uppercase">{brand.name}</p>
                                </div>
                                <p className="text-[10px] font-black text-green-500">
                                    ${brand.totalRevenue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Productos (moved to 2 column span) */}
                <div className="lg:col-span-2 bg-card rounded-3xl shadow-sm border border-border p-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Modelos Destacados</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {topProducts.map((product, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-border">
                                    {product.image ? (
                                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-lg">👕</div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-foreground truncate uppercase">{product.name}</p>
                                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{product.totalSold} vendidos</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Actividad Reciente */}
            <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Últimas Ventas ({userLocationName})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                            <thead className="bg-gray-50/30 dark:bg-gray-800/30">
                                <tr>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha / # Venta</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal / Cajero</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Pago</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {recentSales.map((sale: any) => (
                                    <tr key={sale.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-foreground">
                                                {new Date(sale.date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-400 flex gap-2 items-center">
                                                <span className="text-blue-500 font-black">#PDV{sale.receiptNumber}</span>
                                                {sale.isLayaway ? <span className="text-purple-500 uppercase tracking-tighter">Apartado</span> : sale.isReturn ? <span className="text-red-500 uppercase tracking-tighter">Devolución</span> : null}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-foreground flex items-center gap-1">
                                                <span>🏬</span> {sale.locationName || 'General'}
                                            </div>
                                            {sale.cashierName && (
                                                <div className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                                    <span>👤</span> {sale.cashierName}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-black text-foreground">
                                                ${sale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md text-gray-500">
                                                {sale.paymentMethodName}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                                            {sale.isLayaway && sale.balance > 0 && (
                                                <button 
                                                    onClick={() => setSelectedLayaway(sale)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                                    title="Abonar"
                                                >
                                                    💳
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setEditingSale(sale); setEditNotes(sale.notes || ''); }}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                title="Editar notas"
                                            >
                                                ✏️
                                            </button>
                                            {sale.status !== 'CANCELLED' && (
                                                <button 
                                                    onClick={() => handleCancelSale(sale)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                    title="Cancelar venta (revierte inventario)"
                                                >
                                                    🗑
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setSelectedSale(sale)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                title="Ver Ticket"
                                            >
                                                📄
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                </div>
            </div>

            {/* Receipt Modal (Re-print) */}
            {selectedSale && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl">
                            <h3 className="font-bold text-foreground">Re-Imprimir Ticket</h3>
                            <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-red-500 w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors">✕</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900 flex justify-center">
                            <div id="thermal-receipt" className="bg-white text-black w-[80mm] min-h-[100mm] shadow-md p-4 flex flex-col font-mono text-sm leading-tight relative">
                                <div className="text-center mb-4">
                                    <h1 className="font-black text-xl mb-1">MODA ZAPOTLANEJO</h1>
                                    <p className="text-xs">{selectedSale.locationName}</p>
                                    <p className="text-xs">COPIA DE TICKET</p>
                                </div>
                                
                                <div className="border-t border-b border-dashed border-black py-2 mb-2 text-xs">
                                    <p>Ticket: #PDV{selectedSale.receiptNumber}</p>
                                    <p>Fecha Original: {new Date(selectedSale.date).toLocaleString()}</p>
                                    <p>Cajero: {selectedSale.sellerName}</p>
                                    {selectedSale.isLayaway && <p className="font-bold">* APARTADO *</p>}
                                    {selectedSale.isReturn && <p className="font-bold">* DEVOLUCIÓN *</p>}
                                </div>

                                <table className="w-full text-xs text-left mb-2">
                                    <thead>
                                        <tr className="border-b border-black">
                                            <th className="py-1 w-8">Cant</th>
                                            <th className="py-1 text-left">Desc</th>
                                            <th className="py-1 text-right">Imp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSale.cart.map((item: any, idx: number) => {
                                            const total = item.price * item.quantity;
                                            return (
                                                <tr key={idx} className="align-top">
                                                    <td className="py-1">{item.quantity}</td>
                                                    <td className="py-1 break-words pr-1">{item.name} <br/><span className="text-[10px]">${item.price.toFixed(2)}</span></td>
                                                    <td className="py-1 text-right">${total.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {selectedSale.discount > 0 && (
                                    <div className="flex justify-between items-center text-xs mb-1">
                                        <span>Subtotal:</span>
                                        <span>${selectedSale.subtotal.toFixed(2)}</span>
                                    </div>
                                )}
                                {selectedSale.discount > 0 && (
                                    <div className="flex justify-between items-center text-xs mb-2">
                                        <span>Descuento:</span>
                                        <span>-${selectedSale.discount.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center font-black text-lg border-t border-black pt-2 mb-2">
                                    <span>TOTAL:</span>
                                    <span>${selectedSale.total.toFixed(2)}</span>
                                </div>

                                {selectedSale.isLayaway && (
                                    <>
                                        <div className="flex justify-between items-center text-xs mt-2 border-t border-black pt-1">
                                            <span>Enganche:</span>
                                            <span>${(selectedSale.amountPaid || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span>Resta por pagar:</span>
                                            <span className="font-bold">${(selectedSale.balance || 0).toFixed(2)}</span>
                                        </div>
                                        {selectedSale.dueDate && (
                                            <div className="flex justify-between items-center text-[10px] mt-1 text-gray-700">
                                                <span>Vence:</span>
                                                <span>{new Date(selectedSale.dueDate).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="text-xs mb-4 mt-2">
                                    <p>{selectedSale.isLayaway ? 'Abono Registrado vía:' : 'Pago:'} {selectedSale.paymentMethodName}</p>
                                </div>

                                <div className="text-center text-[10px] mt-auto border-t border-dashed border-black pt-4">
                                    <p>¡GRACIAS POR SU COMPRA!</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-card border-t border-border flex gap-3 rounded-b-3xl">
                            <button
                                onClick={() => setSelectedSale(null)}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-foreground font-bold rounded-xl transition-colors"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={() => {
                                    const receiptHtml = document.getElementById('thermal-receipt')?.outerHTML;
                                    if (receiptHtml) {
                                        const printWindow = window.open('', '', 'width=300,height=600');
                                        if (printWindow) {
                                            printWindow.document.write(`
                                                <html>
                                                    <head>
                                                        <title>Imprimir Copia del Ticket</title>
                                                        <style>
                                                            body { margin: 0; padding: 0; display: flex; justify-content: center; background: white; }
                                                            @page { margin: 0; size: 80mm auto; }
                                                            * { font-family: monospace; }
                                                        </style>
                                                        <script src="https://cdn.tailwindcss.com"></script>
                                                    </head>
                                                    <body class="bg-white">
                                                        ${receiptHtml}
                                                    </body>
                                                </html>
                                            `);
                                            printWindow.document.close();
                                            setTimeout(() => {
                                                printWindow.print();
                                                setTimeout(() => printWindow.close(), 500);
                                                setSelectedSale(null);
                                            }, 500);
                                        }
                                    }
                                }}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-2"
                            >
                                Imprimir Copia
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add Payment to Layaway */}
            {selectedLayaway && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-sm rounded-[24px] shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-bold text-foreground">Abonar a Apartado</h3>
                            <button onClick={() => setSelectedLayaway(null)} className="text-gray-400 hover:text-red-500 w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors">✕</button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
                                <div className="flex justify-between items-center text-sm mb-1">
                                    <span className="text-purple-600 font-bold text-xs uppercase">Resta por Pagar</span>
                                    <span className="font-black text-lg text-purple-700 dark:text-purple-400">
                                        ${selectedLayaway.balance.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Monto a Abonar</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max={selectedLayaway.balance}
                                        step="0.01"
                                        value={layawayAbono}
                                        onChange={(e) => setLayawayAbono(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 bg-card border border-border rounded-xl font-bold focus:border-purple-500 outline-none transition"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleAbono}
                                disabled={isProcessing}
                                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all uppercase tracking-wider disabled:opacity-50"
                            >
                                {isProcessing ? "Registrando..." : "Registrar Abono (Efectivo)"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal editar venta */}
            {editingSale && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-3xl border border-border shadow-2xl p-8 w-full max-w-md space-y-5">
                        <h3 className="text-lg font-black text-foreground">✏️ Editar Venta #{editingSale.receiptNumber}</h3>
                        <div className="text-xs text-gray-500 space-y-1">
                            <p>📅 {new Date(editingSale.date).toLocaleDateString('es-MX', { dateStyle: 'full' })}</p>
                            <p>🏬 {editingSale.locationName} {editingSale.cashierName ? `· 👤 ${editingSale.cashierName}` : ''}</p>
                            <p className="font-black text-foreground">${editingSale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-400">Notas internas</label>
                            <textarea
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                placeholder="Agregar nota a esta venta..."
                                rows={3}
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-medium resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setEditingSale(null)}
                                className="flex-1 py-3 border border-border rounded-xl text-sm font-black text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                                Cancelar
                            </button>
                            <button onClick={handleEditSale}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black transition">
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

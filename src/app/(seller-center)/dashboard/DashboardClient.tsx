"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { addLayawayPayment, deleteSale, updateSaleNotes, updateSaleDashboard } from '../products/new/actions';
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
    paymentMethods: { id: string; name: string }[];
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
    recentOrders,
    paymentMethods
}: DashboardClientProps) {
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [selectedLayaway, setSelectedLayaway] = useState<any>(null);
    const [editingSale, setEditingSale] = useState<any>(null);
    const [editNotes, setEditNotes] = useState('');
    const [editPaymentMethod, setEditPaymentMethod] = useState('');
    const [editItems, setEditItems] = useState<{ variantId: string; name: string; quantity: number; price: number }[]>([]);
    const [editSaving, setEditSaving] = useState(false);
    const [layawayAbono, setLayawayAbono] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Filtro de últimas ventas por sucursal y fecha
    const [salesLocationFilter, setSalesLocationFilter] = useState<string>('all');
    const [salesActiveFilter, setSalesActiveFilter] = useState<string>('today');
    const [salesDateRange, setSalesDateRange] = useState<{ startDate: Date; endDate: Date }>(() => {
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { startDate: start, endDate: now };
    });

    const handleSalesFilterChange = (preset: string) => {
        setSalesActiveFilter(preset);
        const now = new Date();
        const start = new Date(now);
        switch (preset) {
            case 'today':  start.setHours(0, 0, 0, 0); break;
            case 'week':   { const day = start.getDay() || 7; start.setHours(-24 * (day - 1), 0, 0, 0); break; }
            case 'month':  start.setDate(1); start.setHours(0, 0, 0, 0); break;
            case 'last_month': start.setMonth(now.getMonth() - 1, 1); start.setHours(0, 0, 0, 0); now.setDate(0); now.setHours(23, 59, 59, 999); break;
            case 'quarter':  { const q = Math.floor(now.getMonth() / 3); start.setMonth(q * 3, 1); start.setHours(0, 0, 0, 0); break; }
            case 'last_quarter': { const lq = Math.floor(now.getMonth() / 3) - 1; start.setMonth(lq * 3, 1); if (lq < 0) { start.setFullYear(now.getFullYear() - 1); start.setMonth(9); } start.setHours(0, 0, 0, 0); now.setTime(start.getTime()); now.setMonth(start.getMonth() + 3, 0); now.setHours(23, 59, 59, 999); break; }
            case 'year':   start.setMonth(0, 1); start.setHours(0, 0, 0, 0); break;
            case 'last_year': start.setFullYear(now.getFullYear() - 1, 0, 1); start.setHours(0, 0, 0, 0); now.setFullYear(now.getFullYear() - 1, 11, 31); now.setHours(23, 59, 59, 999); break;
        }
        setSalesDateRange({ startDate: start, endDate: now });
    };

    const handleSalesCustomDate = (type: 'start' | 'end', value: string) => {
        setSalesActiveFilter('custom');
        const [y, m, d] = value.split('-').map(Number);
        const newDate = new Date(type === 'start' ? salesDateRange.startDate : salesDateRange.endDate);
        newDate.setFullYear(y, m - 1, d);
        type === 'start' ? newDate.setHours(0, 0, 0, 0) : newDate.setHours(23, 59, 59, 999);
        setSalesDateRange(prev => type === 'start' ? { ...prev, startDate: newDate } : { ...prev, endDate: newDate });
    };

    const fmtDate = (d: Date) => d.toISOString().split('T')[0];

    const salesLocations = Array.from(new Set(recentSales.map((s: any) => s.locationName || 'General')));
    const filteredSales = recentSales.filter((s: any) => {
        // Excluir ventas en espera, apartados y canceladas — solo completadas y devoluciones
        if (s.status !== 'COMPLETED' && s.status !== 'REFUNDED') return false;
        if (salesLocationFilter !== 'all' && (s.locationName || 'General') !== salesLocationFilter) return false;
        const d = new Date(s.date);
        if (d < salesDateRange.startDate) return false;
        if (d > salesDateRange.endDate)   return false;
        return true;
    });

    const handlePrintSalesTable = () => {
        const rows = filteredSales.map((s: any) => `
            <tr>
                <td>${new Date(s.date).toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}<br/><b>#PDV${s.receiptNumber}</b>${s.isLayaway ? ' · Apartado' : s.isReturn ? ' · Devolución' : ''}</td>
                <td>${s.locationName || 'General'}${s.cashierName ? '<br/>👤 ' + s.cashierName : ''}${s.salespersonName ? '<br/>🧑‍💼 ' + s.salespersonName : ''}</td>
                <td><b>$${s.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</b></td>
                <td>${s.paymentMethodName}</td>
            </tr>`).join('');
        const total = filteredSales.reduce((a: number, s: any) => a + s.total, 0);
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ventas</title>
        <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
        h2{margin-bottom:4px}p{margin:2px 0 12px;color:#666}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:top}
        th{background:#f3f4f6;font-weight:700;font-size:11px;text-transform:uppercase}
        tfoot td{font-weight:700;background:#f9fafb}
        @media print{button{display:none}}</style></head><body>
        <h2>Últimas Ventas</h2>
        <p>${fmtDate(salesDateRange.startDate)} → ${fmtDate(salesDateRange.endDate)} · ${salesLocationFilter === 'all' ? 'Todas las sucursales' : salesLocationFilter}</p>
        <table><thead><tr><th>Fecha / #</th><th>Sucursal / Cajero / Vendedor</th><th>Monto</th><th>Pago</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2">Total (${filteredSales.length} ventas)</td><td>$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</td><td></td></tr></tfoot>
        </table>
        <script>window.onload=()=>{window.print();}</script></body></html>`);
        w.document.close();
    };

    // Visibilidad de métricas sensibles (ocultas por default)
    const [showSalesToday,      setShowSalesToday]      = useState(false);
    const [showStockGeneral,    setShowStockGeneral]     = useState(false);
    const [showValorInventario, setShowValorInventario]  = useState(false);

    const toggleMetric = (key: string, current: boolean, setter: (v: boolean) => void) => (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setter(!current);
    };
    const eyeIcon = (visible: boolean) => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {visible
                ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
            }
        </svg>
    );

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
        setEditSaving(true);
        // Persist notes update
        if (editNotes !== (editingSale.notes || '')) {
            await updateSaleNotes(editingSale.id, editNotes);
        }
        // Persist payment method + items update
        const pmChanged = editPaymentMethod && editPaymentMethod !== editingSale.paymentMethodName;
        const itemsChanged = JSON.stringify(editItems) !== JSON.stringify(
            editingSale.cart.map((i: any) => ({ variantId: i.variantId, name: i.name, quantity: i.quantity, price: i.price }))
        );
        if (pmChanged || itemsChanged) {
            const res = await updateSaleDashboard(editingSale.id, {
                ...(pmChanged ? { paymentMethodName: editPaymentMethod } : {}),
                ...(itemsChanged ? { items: editItems.filter(i => i.quantity > 0).map(i => ({ variantId: i.variantId, quantity: i.quantity, price: i.price })) } : {})
            });
            setEditSaving(false);
            if (!res.success) {
                toast.error(res.error || 'Error al actualizar');
                return;
            }
        } else {
            setEditSaving(false);
        }
        toast.success('Venta actualizada');
        setEditingSale(null);
        window.location.reload();
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
                {/* Ventas de Hoy */}
                <Link href="/reports" className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col justify-between hover:border-blue-500/50 hover:shadow-md transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:scale-110 group-hover:-rotate-6 transition-transform blur-[2px]">💰</div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-black uppercase tracking-widest text-blue-500">Ventas de Hoy</p>
                            <button onClick={toggleMetric('sales', showSalesToday, setShowSalesToday)} className="text-gray-400 hover:text-blue-500 transition-colors z-10">
                                {eyeIcon(showSalesToday)}
                            </button>
                        </div>
                        <p className="text-3xl font-black text-foreground tabular-nums">
                            {showSalesToday ? `$${salesTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : <span className="tracking-widest text-gray-400">••••••</span>}
                        </p>
                    </div>
                    <div className="mt-4 flex items-center text-sm font-bold text-gray-500 group-hover:text-blue-600 transition-colors">
                        Ver Reportes <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                </Link>

                {/* Stock General */}
                <Link href="/inventory" className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col justify-between hover:border-purple-500/50 hover:shadow-md transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:scale-110 group-hover:-rotate-6 transition-transform blur-[2px]">📦</div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-black uppercase tracking-widest text-purple-500">Stock General</p>
                            <button onClick={toggleMetric('stock', showStockGeneral, setShowStockGeneral)} className="text-gray-400 hover:text-purple-500 transition-colors z-10">
                                {eyeIcon(showStockGeneral)}
                            </button>
                        </div>
                        <p className="text-3xl font-black text-foreground tabular-nums">
                            {showStockGeneral
                                ? <>{inventoryTotal.toLocaleString()} <span className="text-lg font-medium text-gray-400">Pzs</span></>
                                : <span className="tracking-widest text-gray-400">••••••</span>}
                        </p>
                    </div>
                    <div className="mt-4 flex items-center text-sm font-bold text-gray-500 group-hover:text-purple-600 transition-colors">
                        Gestionar Inventario <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                </Link>

                {/* Valor de Inventario */}
                <div className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col justify-between hover:border-amber-500/50 hover:shadow-md transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:scale-110 group-hover:-rotate-6 transition-transform blur-[2px]">🏛️</div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-black uppercase tracking-widest text-amber-500">Valor de Inventario</p>
                            <button onClick={toggleMetric('valor', showValorInventario, setShowValorInventario)} className="text-gray-400 hover:text-amber-500 transition-colors z-10">
                                {eyeIcon(showValorInventario)}
                            </button>
                        </div>
                        <p className="text-3xl font-black text-foreground tabular-nums">
                            {showValorInventario ? `$${inventoryValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : <span className="tracking-widest text-gray-400">••••••</span>}
                        </p>
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

            {/* Gráfica Tendencia de Ventas */}
            {(() => {
                const [trendPeriod, setTrendPeriod] = React.useState<'30' | '7'>('30');
                const trendData = trendPeriod === '7' ? thirtyDayTrend.slice(-7) : thirtyDayTrend;
                const trendTotal = trendData.reduce((a, d) => a + d.total, 0);
                return (
                <div className="bg-card rounded-3xl shadow-sm border border-border p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Tendencia de Ventas</h3>
                            <p className="text-xl font-black">
                                ${trendTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                <span className="text-sm font-medium text-gray-400 ml-2">últimos {trendPeriod === '7' ? '7' : '30'} días</span>
                            </p>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                            <button
                                onClick={() => setTrendPeriod('7')}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${trendPeriod === '7' ? 'bg-white dark:bg-gray-700 shadow-sm text-foreground' : 'text-gray-400 hover:text-foreground'}`}
                            >Semana</button>
                            <button
                                onClick={() => setTrendPeriod('30')}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${trendPeriod === '30' ? 'bg-white dark:bg-gray-700 shadow-sm text-foreground' : 'text-gray-400 hover:text-foreground'}`}
                            >30 Días</button>
                        </div>
                    </div>

                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis
                                    dataKey={trendPeriod === '7' ? 'dayName' : 'day'}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                    minTickGap={trendPeriod === '30' ? 10 : 0}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                    tickFormatter={(v) => `$${v.toLocaleString()}`}
                                    width={70}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '20px',
                                        border: 'none',
                                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                                        padding: '12px'
                                    }}
                                    formatter={(value: any) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Ventas']}
                                    labelFormatter={(label) => trendPeriod === '7' ? `${label}` : `Día ${label}`}
                                    labelStyle={{ fontWeight: 900, marginBottom: '4px' }}
                                    cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                                />
                                <Bar
                                    dataKey="total"
                                    fill="#3b82f6"
                                    radius={[6, 6, 0, 0]}
                                    animationDuration={800}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                );
            })()}

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
                <div className="px-6 py-4 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex flex-wrap justify-between items-start gap-3">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Últimas Ventas</h3>
                        {/* Filtro por sucursal */}
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => setSalesLocationFilter('all')}
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${salesLocationFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            >Todas</button>
                            {salesLocations.map(loc => (
                                <button
                                    key={loc}
                                    onClick={() => setSalesLocationFilter(loc)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${salesLocationFilter === loc ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                >{loc}</button>
                            ))}
                        </div>
                    </div>
                    {/* Selector de fechas — igual que reportes */}
                    <div className="flex flex-col gap-2 items-end">
                        <div className="flex flex-wrap shadow-sm bg-input border border-border p-1 rounded-2xl overflow-x-auto">
                            {[
                                { id: 'today',        name: 'Hoy' },
                                { id: 'week',         name: 'Semana' },
                                { id: 'month',        name: 'Mes' },
                                { id: 'last_month',   name: 'Mes Ant.' },
                                { id: 'quarter',      name: 'Trimestre' },
                                { id: 'last_quarter', name: 'Trimes Ant.' },
                                { id: 'year',         name: 'Año' },
                                { id: 'last_year',    name: 'Año Ant.' },
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => handleSalesFilterChange(f.id)}
                                    className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${salesActiveFilter === f.id ? 'bg-foreground text-background shadow-md' : 'text-gray-500 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                                >{f.name}</button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 bg-input border border-border rounded-2xl p-1.5">
                            <span className="text-xs font-bold text-gray-400 pl-3 uppercase tracking-widest">Desde</span>
                            <input
                                type="date"
                                value={fmtDate(salesDateRange.startDate)}
                                onChange={e => handleSalesCustomDate('start', e.target.value)}
                                className="bg-transparent text-sm font-bold text-foreground outline-none px-2"
                            />
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Hasta</span>
                            <input
                                type="date"
                                value={fmtDate(salesDateRange.endDate)}
                                onChange={e => handleSalesCustomDate('end', e.target.value)}
                                className="bg-transparent text-sm font-bold text-foreground outline-none px-2"
                            />
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                            <thead className="bg-gray-50/30 dark:bg-gray-800/30">
                                <tr>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha / # Venta</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal / Cajero / Vendedor</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Pago</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredSales.map((sale: any) => (
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
                                            {sale.salespersonName && (
                                                <div className="text-[10px] text-blue-500 font-bold flex items-center gap-1">
                                                    <span>🧑‍💼</span> {sale.salespersonName}
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
                                                onClick={() => {
                                                    setEditingSale(sale);
                                                    setEditNotes(sale.notes || '');
                                                    setEditPaymentMethod(sale.paymentMethodName || '');
                                                    setEditItems(sale.cart.map((i: any) => ({ variantId: i.variantId, name: i.name, quantity: i.quantity, price: i.price })));
                                                }}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                title="Editar venta"
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
                {/* Pie con total y botón imprimir */}
                <div className="px-6 py-3 border-t border-border bg-gray-50/50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-gray-500 font-bold">
                        {filteredSales.length} venta{filteredSales.length !== 1 ? 's' : ''} ·
                        Total: <span className="text-foreground font-black">${filteredSales.reduce((a: number, s: any) => a + s.total, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </p>
                    <button
                        onClick={handlePrintSalesTable}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 dark:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-80 transition-opacity shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                        Imprimir tabla
                    </button>
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
                    <div className="bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-border flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-black text-foreground">✏️ Editar Venta #PDV{editingSale.receiptNumber}</h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {new Date(editingSale.date).toLocaleDateString('es-MX', { dateStyle: 'full' })} · {editingSale.locationName}
                                </p>
                            </div>
                            <button onClick={() => setEditingSale(null)} className="text-gray-400 hover:text-red-500 w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                            {/* Método de pago */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Método de pago</label>
                                <select
                                    value={editPaymentMethod}
                                    onChange={e => setEditPaymentMethod(e.target.value)}
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {paymentMethods.map(pm => (
                                        <option key={pm.id} value={pm.name}>{pm.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Artículos */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Artículos</label>
                                <div className="space-y-2">
                                    {editItems.map((item, idx) => (
                                        <div key={item.variantId + idx} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 border border-border rounded-xl px-3 py-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                                                <p className="text-[10px] text-gray-400">${item.price.toFixed(2)} c/u</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}
                                                    className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-black hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                                                >−</button>
                                                <span className="w-6 text-center text-sm font-black">{item.quantity}</span>
                                                <button
                                                    onClick={() => setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                                                    className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-black hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                                                >+</button>
                                                <span className="w-16 text-right text-xs font-black text-foreground">${(item.price * item.quantity).toFixed(2)}</span>
                                                <button
                                                    onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))}
                                                    className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition text-xs"
                                                    title="Quitar artículo"
                                                >✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    {editItems.length === 0 && (
                                        <p className="text-xs text-red-500 italic">Sin artículos. Agrega al menos uno antes de guardar.</p>
                                    )}
                                </div>
                                <div className="flex justify-end pt-1">
                                    <p className="text-xs font-black text-foreground">
                                        Nuevo total: ${editItems.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            {/* Notas */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Notas internas</label>
                                <textarea
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    placeholder="Agregar nota a esta venta..."
                                    rows={2}
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-medium resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 pt-4 border-t border-border flex gap-3">
                            <button onClick={() => setEditingSale(null)}
                                className="flex-1 py-3 border border-border rounded-xl text-sm font-black text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                                Cancelar
                            </button>
                            <button
                                onClick={handleEditSale}
                                disabled={editSaving || editItems.length === 0}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition">
                                {editSaving ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

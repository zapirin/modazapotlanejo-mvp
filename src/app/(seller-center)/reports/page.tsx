"use client";

import React, { useEffect, useState } from 'react';
import { getSalesReports, ReportDateRange } from './actions';

export default function ReportsPage() {
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState('month');
    const [dateRange, setDateRange] = useState<ReportDateRange>({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First of month
        endDate: new Date() // Today
    });
    const [data, setData] = useState<any>(null);

    // Filter Buttons logic
    const handleFilterChange = (preset: string) => {
        setActiveFilter(preset);
        const now = new Date();
        const start = new Date(now);
        
        switch (preset) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'week':
                const day = start.getDay() || 7; 
                start.setHours(-24 * (day - 1), 0, 0, 0);
                break;
            case 'month':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'last_month':
                start.setMonth(now.getMonth() - 1, 1);
                start.setHours(0, 0, 0, 0);
                now.setDate(0); // Last day of previous month
                now.setHours(23, 59, 59, 999);
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                start.setMonth(quarter * 3, 1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'last_quarter':
                const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
                // If it was Q1
                start.setMonth(lastQuarter * 3, 1);
                if (lastQuarter < 0) {
                     start.setFullYear(now.getFullYear() - 1);
                     start.setMonth(9); // Oct
                }
                start.setHours(0, 0, 0, 0);
                now.setTime(start.getTime());
                now.setMonth(start.getMonth() + 3, 0); // Last day of that quarter
                now.setHours(23, 59, 59, 999);
                break;
            case 'year':
                start.setMonth(0, 1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'last_year':
                start.setFullYear(now.getFullYear() - 1, 0, 1);
                start.setHours(0, 0, 0, 0);
                now.setFullYear(now.getFullYear() - 1, 11, 31);
                now.setHours(23, 59, 59, 999);
                break;
        }
        
        setDateRange({ startDate: start, endDate: now });
    };

    const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
        setActiveFilter('custom');
        const [year, month, day] = value.split('-');
        
        const newDate = new Date(dateRange[type === 'start' ? 'startDate' : 'endDate']);
        newDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        if (type === 'start') {
            newDate.setHours(0, 0, 0, 0);
            setDateRange({ ...dateRange, startDate: newDate });
        } else {
            newDate.setHours(23, 59, 59, 999);
            setDateRange({ ...dateRange, endDate: newDate });
        }
    };

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const fetchData = async () => {
        setLoading(true);
        const res = await getSalesReports(dateRange);
        if (res.success) {
            setData(res);
        } else {
            alert(res.error || "No se pudo cargar el reporte");
        }
        setLoading(false);
    };

    // Utils
    const formatDateObj = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const renderMetricCard = (title: string, value: string | number, sub: string, icon: string) => (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm overflow-hidden relative group">
            <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:scale-110 group-hover:-rotate-6 transition-transform blur-[2px]">{icon}</div>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">{title}</p>
            <h3 className="text-3xl lg:text-4xl font-black text-foreground mt-2 mb-1 tracking-tighter tabular-nums">{value}</h3>
            <p className="text-xs text-gray-400 font-medium">{sub}</p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto py-6 lg:py-10 px-4 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border pb-8">
                <div>
                    <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tight">Reportes</h1>
                    <p className="text-gray-500 font-medium mt-2">Visión general analítica del Punto de Venta.</p>
                </div>
                
                <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                    {/* Filtros Predefinidos */}
                    <div className="flex flex-wrap shadow-sm bg-input border border-border p-1 rounded-2xl w-full md:w-auto overflow-x-auto">
                        {[
                            { id: 'today', name: 'Hoy' },
                            { id: 'week', name: 'Semana' },
                            { id: 'month', name: 'Mes' },
                            { id: 'last_month', name: 'Mes Ant.' },
                            { id: 'quarter', name: 'Trimestre' },
                            { id: 'last_quarter', name: 'Trimes Ant.' },
                            { id: 'year', name: 'Año' },
                            { id: 'last_year', name: 'Año Ant.' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => handleFilterChange(f.id)}
                                className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${activeFilter === f.id ? 'bg-foreground text-background shadow-md' : 'text-gray-500 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                                {f.name}
                            </button>
                        ))}
                    </div>

                    {/* Rango Manual */}
                    <div className="flex items-center gap-2 bg-input border border-border rounded-2xl p-1.5 w-full md:w-auto">
                        <span className="text-xs font-bold text-gray-400 pl-3 uppercase tracking-widest">Desde</span>
                        <input 
                            type="date"
                            value={formatDateObj(dateRange.startDate)}
                            onChange={(e) => handleCustomDateChange('start', e.target.value)}
                            className="bg-transparent text-sm font-bold text-foreground outline-none px-2"
                        />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Hasta</span>
                        <input 
                            type="date"
                            value={formatDateObj(dateRange.endDate)}
                            onChange={(e) => handleCustomDateChange('end', e.target.value)}
                            className="bg-transparent text-sm font-bold text-foreground outline-none px-2 pr-4"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600"></div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Calculando Rendimiento...</p>
                </div>
            ) : data && data.success ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {renderMetricCard("Ventas Totales", `$${data.kpis.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, "Ingresos procesados", "💰")}
                        {renderMetricCard("Notas Cobradas", data.kpis.totalTickets, "Tickets emitidos exitosos", "🧾")}
                        {renderMetricCard("Promedio de Venta", `$${data.kpis.averageTicket.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, "Ingreso promedio por Ticket", "📈")}
                        {renderMetricCard("Unidades Vendidas", data.kpis.totalUnits, "Prendas físicas desplazadas", "📦")}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Top Products */}
                        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm flex flex-col h-[500px]">
                            <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                                <h3 className="font-black text-foreground text-lg">👕 Top Productos</h3>
                                <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest">Por Ingresos</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {data.topProducts.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-gray-400 font-medium text-sm">No hay ventas registradas.</div>
                                ) : (
                                    data.topProducts.map((p: any, idx: number) => (
                                        <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition">
                                            <div className="w-8 flex-shrink-0 text-center text-sm font-black text-gray-400">#{idx + 1}</div>
                                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 border border-border">
                                                {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">👚</div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground truncate">{p.name}</p>
                                                <p className="text-xs text-gray-500 font-medium">{p.quantity} Unidades Vendidas</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-green-600 dark:text-green-400 tabular-nums">${p.revenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Top Suppliers */}
                        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm flex flex-col h-[500px]">
                            <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                                <h3 className="font-black text-foreground text-lg">🏭 Proveedores Estrella</h3>
                                <span className="text-xs font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full uppercase tracking-widest">Rendimiento</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {data.topSuppliers.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-gray-400 font-medium text-sm">No hay ventas registradas.</div>
                                ) : (
                                    data.topSuppliers.map((s: any, idx: number) => (
                                        <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition">
                                            <div className="w-8 flex-shrink-0 text-center text-sm font-black text-gray-400">#{idx + 1}</div>
                                            <div className="w-12 h-12 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0">
                                                {s.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground truncate">{s.name}</p>
                                                <p className="text-xs text-gray-500 font-medium">{s.quantity} Prendas Movidas</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-green-600 dark:text-green-400 tabular-nums">${s.revenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

        </div>
    );
}

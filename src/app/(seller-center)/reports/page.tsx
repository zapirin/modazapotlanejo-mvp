"use client";

import { useEffect, useState } from 'react';
import { getSalesReports, getCommissionReport, getZCutsReport, getReportPermissions, ReportDateRange } from './actions';
import { getLocationsSettings } from '../settings/actions';

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<'sales' | 'commissions' | 'zcuts'>('sales');
    const [perms, setPerms] = useState({ canViewReports: true, canViewCommissions: true, canViewZCuts: true, isCashier: false, sessionStartedAt: null as Date | null });
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState('today');
    const [dateRange, setDateRange] = useState<ReportDateRange>(() => {
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { startDate: start, endDate: now };
    });
    const [data, setData] = useState<any>(null);

    // Commission report state
    const [commissionData, setCommissionData] = useState<any>(null);
    // Z-cuts report state
    const [zcutsData, setZcutsData] = useState<any>(null);
    const [expandedCut, setExpandedCut] = useState<string | null>(null);
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');

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
        getLocationsSettings().then(res => {
            if (res.success && res.data) setLocations(res.data);
        });
        getReportPermissions().then(p => {
            setPerms({ canViewReports: p.canViewReports, canViewCommissions: p.canViewCommissions, canViewZCuts: p.canViewZCuts, isCashier: p.isCashier, sessionStartedAt: p.sessionStartedAt ? new Date(p.sessionStartedAt) : null });
            // Si es cajero, fijar el rango de fechas a la sesión activa
            if (p.isCashier && p.sessionStartedAt) {
                setDateRange({ startDate: new Date(p.sessionStartedAt), endDate: new Date() });
                setActiveFilter('session');
            }
            // Si el tab activo no está permitido, saltar al primero que sí lo esté
            setActiveTab(tab => {
                if (tab === 'sales' && p.canViewReports) return 'sales';
                if (tab === 'commissions' && p.canViewCommissions) return 'commissions';
                if (tab === 'zcuts' && p.canViewZCuts) return 'zcuts';
                if (p.canViewReports) return 'sales';
                if (p.canViewCommissions) return 'commissions';
                if (p.canViewZCuts) return 'zcuts';
                return 'sales';
            });
        });
    }, []);

    useEffect(() => {
        if (activeTab === 'sales') fetchSalesData();
        else if (activeTab === 'commissions') fetchCommissionData();
        else fetchZCutsData();
    }, [dateRange, activeTab, selectedLocationId]);

    const fetchSalesData = async () => {
        setLoading(true);
        const res = await getSalesReports({ ...dateRange, locationId: selectedLocationId || undefined });
        if (res.success) {
            setData(res);
        } else {
            alert(res.error || "No se pudo cargar el reporte");
        }
        setLoading(false);
    };

    const fetchZCutsData = async () => {
        setLoading(true);
        const res = await getZCutsReport({ ...dateRange, locationId: selectedLocationId || undefined });
        if (res.success) {
            setZcutsData(res);
        } else {
            alert(res.error || 'No se pudo cargar los cortes Z');
        }
        setLoading(false);
    };

    const fetchCommissionData = async () => {
        setLoading(true);
        const res = await getCommissionReport({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            locationId: selectedLocationId || undefined,
        });
        if (res.success) {
            setCommissionData(res);
        } else {
            alert(res.error || "No se pudo cargar el reporte de comisiones");
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
                    {/* Tabs */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit mt-4">
                        {perms.canViewReports && (
                        <button onClick={() => setActiveTab('sales')}
                            className={`px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition ${activeTab === 'sales' ? 'bg-white dark:bg-gray-700 text-foreground shadow' : 'text-gray-500 hover:text-foreground'}`}>
                            Ventas
                        </button>
                        )}
                        {perms.canViewCommissions && (
                        <button onClick={() => setActiveTab('commissions')}
                            className={`px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition ${activeTab === 'commissions' ? 'bg-white dark:bg-gray-700 text-foreground shadow' : 'text-gray-500 hover:text-foreground'}`}>
                            Comisiones
                        </button>
                        )}
                        {perms.canViewZCuts && (
                        <button onClick={() => setActiveTab('zcuts')}
                            className={`px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition ${activeTab === 'zcuts' ? 'bg-white dark:bg-gray-700 text-foreground shadow' : 'text-gray-500 hover:text-foreground'}`}>
                            Cortes Z
                        </button>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                    {/* Cajero: mostrar rango de sesión activa en lugar de filtros */}
                    {perms.isCashier && perms.sessionStartedAt && (
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl px-4 py-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                            <span>📅</span>
                            <span>Sesión activa desde {new Date(perms.sessionStartedAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    )}
                    {/* Location filter — visible in all tabs for seller/admin */}
                    {!perms.isCashier && locations.length > 1 && (
                        <select value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)}
                            className="bg-input border border-border rounded-xl px-4 py-2 text-sm font-bold text-foreground outline-none w-full md:w-auto">
                            <option value="">Todas las sucursales</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    )}
                    {/* Filtros Predefinidos y rango manual — ocultos para cajeros */}
                    {!perms.isCashier && (
                        <>
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
                        </>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600"></div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Calculando Rendimiento...</p>
                </div>
            ) : activeTab === 'commissions' ? (
                commissionData && commissionData.success ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Summary KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {renderMetricCard("Vendedores con Ventas", commissionData.rows.filter((r: any) => r.salesCount > 0).length, "Vendedores de piso activos en el periodo", "🏷️")}
                            {renderMetricCard("Total Vendido", `$${commissionData.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, "Suma de ventas asignadas", "💰")}
                            {renderMetricCard("Total Comisiones", `$${commissionData.totalCommission.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, "Monto a pagar por comisiones", "💸")}
                        </div>

                        {/* Commission table */}
                        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50">
                                <h3 className="font-black text-foreground text-lg">Desglose por Vendedor de Piso</h3>
                            </div>
                            {commissionData.rows.length === 0 ? (
                                <div className="p-16 text-center text-gray-400 font-medium">
                                    <p className="text-4xl mb-3">🏷️</p>
                                    <p>No hay ventas con vendedor de piso asignado en este periodo.</p>
                                    <p className="text-xs mt-2">Asigna vendedores de piso en el POS al cobrar.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border text-[10px] uppercase tracking-widest text-gray-400 font-black">
                                                <th className="text-left px-6 py-4">Vendedor</th>
                                                <th className="text-center px-4 py-4">Teléfono</th>
                                                <th className="text-center px-4 py-4">Ventas</th>
                                                <th className="text-center px-4 py-4">Piezas</th>
                                                <th className="text-right px-4 py-4">Total Vendido</th>
                                                <th className="text-center px-4 py-4">Comisión</th>
                                                <th className="text-right px-6 py-4">A Pagar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {commissionData.rows.map((row: any) => (
                                                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center font-black text-base flex-shrink-0">
                                                                {row.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="font-bold text-foreground">{row.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-center px-4 py-4 text-gray-500 font-medium">{row.phone || '—'}</td>
                                                    <td className="text-center px-4 py-4">
                                                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-black">{row.salesCount}</span>
                                                    </td>
                                                    <td className="text-center px-4 py-4 text-gray-500 font-bold tabular-nums">{row.totalPieces}</td>
                                                    <td className="text-right px-4 py-4 font-bold text-foreground tabular-nums">
                                                        ${row.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="text-center px-4 py-4">
                                                        <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-xs font-black">
                                                            {row.commissionType === 'FIXED_PER_PIECE'
                                                                ? `$${row.commissionValue}/pza`
                                                                : `${row.commissionValue}%`}
                                                        </span>
                                                    </td>
                                                    <td className="text-right px-6 py-4 font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                        ${row.commissionAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50/80 dark:bg-gray-800/80 font-black text-foreground">
                                                <td colSpan={4} className="px-6 py-4 text-xs uppercase tracking-widest text-gray-500">Total</td>
                                                <td className="text-right px-4 py-4 tabular-nums">
                                                    ${commissionData.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td></td>
                                                <td className="text-right px-6 py-4 text-emerald-600 tabular-nums">
                                                    ${commissionData.totalCommission.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null
            ) : activeTab === 'zcuts' ? (
                zcutsData && zcutsData.success ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {renderMetricCard('Cortes Z', zcutsData.rows.length, 'Cierres de caja en el periodo', '🗂️')}
                            {renderMetricCard('Total Vendido', `$${zcutsData.totalSalesAll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Suma de ventas en todos los cortes', '💰')}
                            {renderMetricCard('Tickets Emitidos', zcutsData.totalTicketsAll, 'Notas cobradas en el periodo', '🧾')}
                        </div>

                        {/* Tabla de cortes */}
                        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50">
                                <h3 className="font-black text-foreground text-lg">Detalle de Cortes Z</h3>
                                <p className="text-xs text-gray-400 mt-1">Ordenados del más reciente al más antiguo. Toca una fila para ver el desglose por método de pago.</p>
                            </div>
                            {zcutsData.rows.length === 0 ? (
                                <div className="p-16 text-center text-gray-400 font-medium">
                                    <p className="text-4xl mb-3">🗂️</p>
                                    <p>No hay cortes Z cerrados en este periodo.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border text-[10px] uppercase tracking-widest text-gray-400 font-black">
                                                <th className="text-left px-6 py-4">#</th>
                                                <th className="text-left px-4 py-4">Fecha Cierre</th>
                                                <th className="text-left px-4 py-4">Sucursal</th>
                                                <th className="text-left px-4 py-4">Cajero</th>
                                                <th className="text-right px-4 py-4">Apertura</th>
                                                <th className="text-right px-4 py-4">Ventas</th>
                                                <th className="text-center px-4 py-4">Tickets</th>
                                                <th className="text-right px-4 py-4">Esperado</th>
                                                <th className="text-right px-4 py-4">Cierre</th>
                                                <th className="text-right px-6 py-4">Diferencia</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {zcutsData.rows.map((row: any, idx: number) => (
                                                <>
                                                    <tr
                                                        key={row.id}
                                                        onClick={() => setExpandedCut(expandedCut === row.id ? null : row.id)}
                                                        className="border-b border-border hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                                                    >
                                                        <td className="px-6 py-4 text-xs font-black text-gray-400">#{zcutsData.rows.length - idx}</td>
                                                        <td className="px-4 py-4">
                                                            <p className="font-bold text-foreground">{new Date(row.closedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                            <p className="text-[10px] text-gray-400">{new Date(row.closedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                                                        </td>
                                                        <td className="px-4 py-4 text-sm font-bold text-foreground">{row.locationName}</td>
                                                        <td className="px-4 py-4 text-sm text-gray-500 font-medium">{row.cashierName}</td>
                                                        <td className="px-4 py-4 text-right text-sm font-bold tabular-nums">${row.openingBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-4 text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums">${row.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-black">{row.totalTickets}</span>
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-sm text-gray-500 tabular-nums">${row.expectedBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-4 text-right text-sm font-bold tabular-nums">${row.closingBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                        <td className={`px-6 py-4 text-right font-black tabular-nums ${Math.abs(row.difference) < 0.01 ? 'text-gray-400' : row.difference >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            {row.difference >= 0 ? '+' : ''}{row.difference.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                    {expandedCut === row.id && row.salesByPayment.length > 0 && (
                                                        <tr key={`${row.id}-detail`} className="bg-gray-50/80 dark:bg-gray-800/60">
                                                            <td colSpan={10} className="px-8 py-4">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Desglose por método de pago</p>
                                                                <div className="flex flex-wrap gap-3">
                                                                    {row.salesByPayment.map((pm: any) => (
                                                                        <div key={pm.name} className="bg-white dark:bg-gray-900 border border-border rounded-xl px-4 py-2 flex items-center gap-3">
                                                                            <span className="text-xs font-black uppercase tracking-wider text-foreground">{pm.name}</span>
                                                                            <span className="text-[10px] text-gray-400">{pm.count} ticket{pm.count !== 1 ? 's' : ''}</span>
                                                                            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">${pm.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    ))}
                                                                    {(row.totalIn > 0 || row.totalOut > 0) && (
                                                                        <div className="bg-white dark:bg-gray-900 border border-border rounded-xl px-4 py-2 flex items-center gap-3">
                                                                            <span className="text-xs font-black uppercase tracking-wider text-foreground">Movimientos</span>
                                                                            {row.totalIn > 0 && <span className="text-[10px] text-emerald-600">+${row.totalIn.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>}
                                                                            {row.totalOut > 0 && <span className="text-[10px] text-red-500">-${row.totalOut.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null
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

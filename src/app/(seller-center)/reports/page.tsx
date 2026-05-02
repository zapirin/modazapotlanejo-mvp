"use client";

import { useEffect, useState } from 'react';
import { getSalesReports, getCommissionReport, getZCutsReport, getProfitReport, getMarketplaceCommissionReport, getReportPermissions, getTransfersReport, ReportDateRange } from './actions';
import { getTransferById } from '../pos/actions';
import { getLocationsSettings } from '../settings/actions';
import TransferTicket from '../pos/TransferTicket';

const handlePrintTransfer = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const bodyChildren = Array.from(document.body.children) as HTMLElement[];
    const savedStyles: { el: HTMLElement; display: string }[] = [];
    bodyChildren.forEach(child => {
        savedStyles.push({ el: child, display: child.style.display });
        child.style.display = 'none';
    });
    const printArea = document.createElement('div');
    printArea.id = 'pos-print-area';
    printArea.style.cssText = 'background:white;margin:0;padding:0;width:100%;display:flex;justify-content:center;';
    printArea.innerHTML = el.outerHTML;
    printArea.querySelectorAll('[class]').forEach(node => { (node as HTMLElement).style.boxShadow = 'none'; });
    document.body.appendChild(printArea);
    const origBg = document.body.style.background;
    const origMargin = document.body.style.margin;
    document.body.style.background = 'white';
    document.body.style.margin = '0';
    try { window.print(); } catch (err) { console.error(err); }
    const restore = () => {
        printArea.remove();
        document.body.style.background = origBg;
        document.body.style.margin = origMargin;
        savedStyles.forEach(({ el: child, display }) => { child.style.display = display; });
    };
    window.addEventListener('afterprint', restore, { once: true });
    setTimeout(restore, 3000);
};

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<'sales' | 'commissions' | 'zcuts' | 'profit' | 'transfers'>('sales');
    const [perms, setPerms] = useState({ role: null as string | null, canViewReports: true, canViewCommissions: true, canViewZCuts: true, canViewProfit: true, canViewTransfers: true, isCashier: false, sessionStartedAt: null as Date | null });
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
    const [profitData, setProfitData] = useState<any>(null);
    const [transfersData, setTransfersData] = useState<any>(null);
    const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
    const [expandedCut, setExpandedCut] = useState<string | null>(null);
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
    const [selectedMovementsCut, setSelectedMovementsCut] = useState<any | null>(null);
    const [selectedPaymentBucket, setSelectedPaymentBucket] = useState<{ cut: any; pm: any } | null>(null);

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
            setPerms({ role: p.role, canViewReports: p.canViewReports, canViewCommissions: p.canViewCommissions, canViewZCuts: p.canViewZCuts, canViewProfit: p.canViewProfit, canViewTransfers: (p as any).canViewTransfers ?? false, isCashier: p.isCashier, sessionStartedAt: p.sessionStartedAt ? new Date(p.sessionStartedAt) : null });
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
                if (tab === 'profit' && p.canViewProfit) return 'profit';
                if (p.canViewReports) return 'sales';
                if (p.canViewCommissions) return 'commissions';
                if (p.canViewZCuts) return 'zcuts';
                if (p.canViewProfit) return 'profit';
                return 'sales';
            });
        });
    }, []);

    useEffect(() => {
        if (activeTab === 'sales') fetchSalesData();
        else if (activeTab === 'commissions') fetchCommissionData();
        else if (activeTab === 'profit') fetchProfitData();
        else if (activeTab === 'transfers') fetchTransfersData();
        else fetchZCutsData();
    }, [dateRange, activeTab, selectedLocationId]);

    const fetchTransfersData = async () => {
        setLoading(true);
        const res = await getTransfersReport({ ...dateRange, locationId: selectedLocationId || undefined });
        if (res.success) setTransfersData(res);
        else alert(res.error || 'No se pudo cargar el reporte de traspasos');
        setLoading(false);
    };

    const openTransferDetail = async (id: string) => {
        const t = await getTransferById(id);
        if (t) setSelectedTransfer(t);
        else alert('No se pudo cargar el traspaso.');
    };

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

    const fetchProfitData = async () => {
        setLoading(true);
        const res = await getProfitReport({ ...dateRange, locationId: selectedLocationId || undefined });
        if (res.success) {
            setProfitData(res);
        } else {
            alert(res.error || 'No se pudo cargar el reporte de ganancia');
        }
        setLoading(false);
    };

    const fetchCommissionData = async () => {
        setLoading(true);
        const res = perms.role === 'ADMIN'
            ? await getMarketplaceCommissionReport({ startDate: dateRange.startDate, endDate: dateRange.endDate })
            : await getCommissionReport({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                locationId: selectedLocationId || undefined,
            });
        if (res.success) {
            setCommissionData({ ...res, isMarketplace: perms.role === 'ADMIN' });
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
                        {perms.canViewProfit && (
                        <button onClick={() => setActiveTab('profit')}
                            className={`px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition ${activeTab === 'profit' ? 'bg-white dark:bg-gray-700 text-foreground shadow' : 'text-gray-500 hover:text-foreground'}`}>
                            Ganancia
                        </button>
                        )}
                        {perms.canViewTransfers && (
                        <button onClick={() => setActiveTab('transfers')}
                            className={`px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition ${activeTab === 'transfers' ? 'bg-white dark:bg-gray-700 text-foreground shadow' : 'text-gray-500 hover:text-foreground'}`}>
                            Traspasos
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
                    {!perms.isCashier && perms.role !== 'ADMIN' && locations.length > 1 && (
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
                    commissionData.isMarketplace ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {renderMetricCard('Ventas online totales', `$${commissionData.totals.totalSalesAll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, `${commissionData.totals.ordersCountAll} órdenes en el periodo`, '🛒')}
                            {renderMetricCard('Comisión total', `$${commissionData.totals.commissionTotalAll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Suma de todas las comisiones', '💸')}
                            {renderMetricCard('Retenida (tarjeta)', `$${commissionData.totals.commissionRetainedAll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Ya cobrada vía Stripe', '✅')}
                            {renderMetricCard('Pendiente de cobro', `$${commissionData.totals.commissionPendingAll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Pagos offline — cobrar al vendedor', '⚠️')}
                        </div>

                        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                                <h3 className="font-black text-foreground text-lg">Comisiones por vendedor</h3>
                                <span className="text-xs font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full uppercase tracking-widest">Marketplace</span>
                            </div>
                            {commissionData.rows.length === 0 ? (
                                <div className="p-16 text-center text-gray-400 font-medium">
                                    <p className="text-4xl mb-3">🛒</p>
                                    <p>No hay órdenes online en este periodo.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border text-[10px] uppercase tracking-widest text-gray-400 font-black">
                                                <th className="text-left px-6 py-4">Vendedor</th>
                                                <th className="text-left px-4 py-4">Plan</th>
                                                <th className="text-center px-4 py-4">%</th>
                                                <th className="text-right px-4 py-4">Mensualidad</th>
                                                <th className="text-center px-4 py-4">Órdenes</th>
                                                <th className="text-right px-4 py-4">Ventas</th>
                                                <th className="text-right px-4 py-4">Retenida</th>
                                                <th className="text-right px-4 py-4">Pendiente</th>
                                                <th className="text-right px-6 py-4">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {commissionData.rows.map((row: any) => (
                                                <tr key={row.sellerId} className="border-b border-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center font-black text-base flex-shrink-0">
                                                                {(row.businessName || row.name).charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-foreground">{row.businessName || row.name}</p>
                                                                {row.businessName && <p className="text-[10px] text-gray-400 font-medium">{row.name}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-purple-100 dark:border-purple-800">
                                                            {row.planName}
                                                        </span>
                                                    </td>
                                                    <td className="text-center px-4 py-4 font-bold text-foreground tabular-nums">{row.commissionPct}%</td>
                                                    <td className="text-right px-4 py-4 text-gray-500 font-bold tabular-nums">
                                                        {row.monthlyFee > 0 ? `$${row.monthlyFee.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}
                                                    </td>
                                                    <td className="text-center px-4 py-4">
                                                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-black">{row.ordersCount}</span>
                                                    </td>
                                                    <td className="text-right px-4 py-4 font-bold text-foreground tabular-nums">${row.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                    <td className="text-right px-4 py-4 text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">${row.commissionRetained.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                    <td className={`text-right px-4 py-4 font-bold tabular-nums ${row.commissionPending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                                                        ${row.commissionPending.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="text-right px-6 py-4 font-black text-foreground tabular-nums">${row.commissionTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50/80 dark:bg-gray-800/80 font-black text-foreground">
                                                <td colSpan={4} className="px-6 py-4 text-xs uppercase tracking-widest text-gray-500">Total</td>
                                                <td className="text-center px-4 py-4">{commissionData.totals.ordersCountAll}</td>
                                                <td className="text-right px-4 py-4 tabular-nums">${commissionData.totals.totalSalesAll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                <td className="text-right px-4 py-4 text-emerald-600 tabular-nums">${commissionData.totals.commissionRetainedAll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                <td className="text-right px-4 py-4 text-amber-600 tabular-nums">${commissionData.totals.commissionPendingAll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                <td className="text-right px-6 py-4 tabular-nums">${commissionData.totals.commissionTotalAll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-gray-400 font-medium px-2">
                            La gestión de mensualidades (fechas y "marcar pagado") está en{' '}
                            <a href="/admin/marketplace" className="text-blue-500 font-bold hover:underline">Marketplace → Suscripciones</a>.
                        </div>
                    </div>
                    ) : (
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
                    )
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
                                                                        <button
                                                                            key={pm.name}
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedPaymentBucket({ cut: row, pm }); }}
                                                                            className="bg-white dark:bg-gray-900 border border-border rounded-xl px-4 py-2 flex items-center gap-3 hover:border-emerald-500 hover:shadow-sm transition cursor-pointer"
                                                                        >
                                                                            <span className="text-xs font-black uppercase tracking-wider text-foreground">{pm.name}</span>
                                                                            <span className="text-[10px] text-gray-400">{pm.count} ticket{pm.count !== 1 ? 's' : ''}</span>
                                                                            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">${pm.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                                                        </button>
                                                                    ))}
                                                                    {(row.movements?.length > 0) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedMovementsCut(row); }}
                                                                            className="bg-white dark:bg-gray-900 border border-border rounded-xl px-4 py-2 flex items-center gap-3 hover:border-purple-500 hover:shadow-sm transition cursor-pointer"
                                                                        >
                                                                            <span className="text-xs font-black uppercase tracking-wider text-foreground">Movimientos</span>
                                                                            <span className="text-[10px] text-gray-400">{row.movements.length} mov.</span>
                                                                            {row.totalIn > 0 && <span className="text-[10px] text-emerald-600">+${row.totalIn.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>}
                                                                            {row.totalOut > 0 && <span className="text-[10px] text-red-500">-${row.totalOut.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>}
                                                                        </button>
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
            ) : activeTab === 'profit' ? (
                profitData && profitData.success ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {renderMetricCard('Ganancia', `$${profitData.kpis.totalProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Precio menos costo', '💵')}
                            {renderMetricCard('Margen', `${profitData.kpis.marginPct.toFixed(1)}%`, 'Ganancia sobre ingresos', '📊')}
                            {renderMetricCard('Costo Total', `$${profitData.kpis.totalCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Suma del costo de las prendas', '🧾')}
                            {renderMetricCard('Ingresos contabilizados', `$${profitData.kpis.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, `${profitData.kpis.totalUnits} unidades con costo`, '💰')}
                        </div>

                        {profitData.kpis.excludedUnits > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-5 py-3 text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center gap-3">
                                <span className="text-lg">⚠️</span>
                                <span>
                                    {profitData.kpis.excludedUnits} unidad{profitData.kpis.excludedUnits !== 1 ? 'es' : ''} de {profitData.kpis.excludedProducts} producto{profitData.kpis.excludedProducts !== 1 ? 's' : ''} se excluyeron por no tener costo registrado.
                                </span>
                            </div>
                        )}

                        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm flex flex-col h-[500px]">
                            <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                                <h3 className="font-black text-foreground text-lg">💵 Top Productos por Ganancia</h3>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full uppercase tracking-widest">Por Ganancia</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {profitData.topProducts.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-gray-400 font-medium text-sm">No hay productos con costo en este periodo.</div>
                                ) : (
                                    profitData.topProducts.map((p: any, idx: number) => {
                                        const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                                        return (
                                            <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition">
                                                <div className="w-8 flex-shrink-0 text-center text-sm font-black text-gray-400">#{idx + 1}</div>
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 border border-border">
                                                    {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">👚</div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-foreground truncate">{p.name}</p>
                                                    <p className="text-xs text-gray-500 font-medium">
                                                        {p.quantity} u. · costo ${p.cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} · {margin.toFixed(0)}% margen
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+${p.profit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                ) : null
            ) : activeTab === 'transfers' ? (
                transfersData && transfersData.success ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                                <h3 className="font-black text-foreground text-lg">📦 Traspasos de Inventario</h3>
                                <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest">
                                    {transfersData.rows.length} traspaso{transfersData.rows.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            {transfersData.rows.length === 0 ? (
                                <div className="p-16 text-center text-gray-400 font-medium">
                                    <p className="text-4xl mb-3">📦</p>
                                    <p>No hay traspasos en este periodo.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border text-[10px] uppercase tracking-widest text-gray-400 font-black">
                                                <th className="text-left px-6 py-4">Folio</th>
                                                <th className="text-left px-4 py-4">Fecha</th>
                                                <th className="text-left px-4 py-4">Origen → Destino</th>
                                                <th className="text-left px-4 py-4">Usuario</th>
                                                <th className="text-center px-4 py-4">Artículos</th>
                                                <th className="text-right px-6 py-4">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transfersData.rows.map((row: any) => (
                                                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition">
                                                    <td className="px-6 py-4 font-black text-foreground tabular-nums">T-{String(row.folio).padStart(6, '0')}</td>
                                                    <td className="px-4 py-4 text-gray-500 font-bold tabular-nums">
                                                        {new Date(row.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </td>
                                                    <td className="px-4 py-4 font-bold text-foreground">
                                                        <span>{row.sourceLocationName}</span>
                                                        <span className="text-gray-400 mx-2">→</span>
                                                        <span>{row.destLocationName}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-500 font-bold">{row.userName}</td>
                                                    <td className="px-4 py-4 text-center font-black text-foreground tabular-nums">{row.totalItems}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => openTransferDetail(row.id)}
                                                            className="px-4 py-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-xs font-bold transition-colors"
                                                        >Ver / Imprimir</button>
                                                    </td>
                                                </tr>
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
                                        <div
                                            key={s.id}
                                            onClick={() => setSelectedSupplier(s)}
                                            className="flex items-center gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition cursor-pointer"
                                        >
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

            {selectedSupplier && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedSupplier(null)}
                >
                    <div
                        className="bg-card border border-border rounded-3xl w-full max-w-lg max-h-[80vh] shadow-2xl flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center rounded-t-3xl">
                            <div>
                                <h3 className="font-black text-foreground text-lg">{selectedSupplier.name}</h3>
                                <p className="text-xs text-gray-500 font-medium mt-1">
                                    {selectedSupplier.quantity} prendas · ${selectedSupplier.revenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedSupplier(null)}
                                className="text-gray-400 hover:text-foreground text-2xl leading-none px-2"
                                aria-label="Cerrar"
                            >×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {selectedSupplier.products?.length ? (
                                selectedSupplier.products.map((p: any, idx: number) => (
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
                            ) : (
                                <div className="py-12 flex items-center justify-center text-gray-400 font-medium text-sm">
                                    Este proveedor no tiene productos en el rango seleccionado.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedMovementsCut && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedMovementsCut(null)}
                >
                    <div
                        className="bg-card border border-border rounded-3xl w-full max-w-lg max-h-[80vh] shadow-2xl flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center rounded-t-3xl">
                            <div>
                                <h3 className="font-black text-foreground text-lg">Movimientos de caja</h3>
                                <p className="text-xs text-gray-500 font-medium mt-1">
                                    {selectedMovementsCut.locationName} · {new Date(selectedMovementsCut.closedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedMovementsCut(null)}
                                className="text-gray-400 hover:text-foreground text-2xl leading-none px-2"
                                aria-label="Cerrar"
                            >×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {selectedMovementsCut.movements?.length ? (
                                selectedMovementsCut.movements.map((m: any) => {
                                    const isIn = m.type === 'IN';
                                    return (
                                        <div key={m.id} className="flex items-center gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0 ${isIn ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                {isIn ? '↑' : '↓'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground truncate">{m.reason || (isIn ? 'Entrada de caja' : 'Salida de caja')}</p>
                                                <p className="text-xs text-gray-500 font-medium">
                                                    {new Date(m.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-black tabular-nums ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    {isIn ? '+' : '-'}${m.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-12 flex items-center justify-center text-gray-400 font-medium text-sm">
                                    Este corte no tiene movimientos.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedTransfer && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTransfer(null)}>
                    <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-border bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl shrink-0 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-foreground">📦 Traspaso T-{String(selectedTransfer.folio).padStart(6, '0')}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{new Date(selectedTransfer.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
                            </div>
                            <button onClick={() => setSelectedTransfer(null)} className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 flex items-center justify-center font-bold transition-colors">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900 flex justify-center">
                            <TransferTicket
                                transfer={selectedTransfer}
                                elementId="transfer-reprint"
                                isReprint
                            />
                        </div>
                        <div className="p-4 bg-card border-t border-border flex gap-3 rounded-b-3xl">
                            <button
                                onClick={() => setSelectedTransfer(null)}
                                className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >Cerrar</button>
                            <button
                                onClick={() => handlePrintTransfer('transfer-reprint')}
                                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors flex justify-center items-center gap-2"
                            >🖨️ Imprimir</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPaymentBucket && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedPaymentBucket(null)}
                >
                    <div
                        className="bg-card border border-border rounded-3xl w-full max-w-lg max-h-[80vh] shadow-2xl flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center rounded-t-3xl">
                            <div>
                                <h3 className="font-black text-foreground text-lg">{selectedPaymentBucket.pm.name}</h3>
                                <p className="text-xs text-gray-500 font-medium mt-1">
                                    {selectedPaymentBucket.pm.count} ticket{selectedPaymentBucket.pm.count !== 1 ? 's' : ''} · ${selectedPaymentBucket.pm.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedPaymentBucket(null)}
                                className="text-gray-400 hover:text-foreground text-2xl leading-none px-2"
                                aria-label="Cerrar"
                            >×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {selectedPaymentBucket.pm.tickets?.length ? (
                                selectedPaymentBucket.pm.tickets.map((t: any) => (
                                    <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition">
                                        <div className="w-12 flex-shrink-0 text-center text-xs font-black text-gray-400 tabular-nums">
                                            #{t.receiptNumber}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-foreground truncate">
                                                {t.clientName || 'Cliente mostrador'}
                                            </p>
                                            <p className="text-xs text-gray-500 font-medium truncate">
                                                {new Date(t.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                                {t.soldByName ? ` · ${t.soldByName}` : ''}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                ${t.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 flex items-center justify-center text-gray-400 font-medium text-sm">
                                    Sin tickets.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { round2 } from '@/lib/money';
import {
    getPurchaseFormData,
    searchProductsForPurchase,
    getProductVariantsForPurchase,
    createPurchaseNote,
} from './actions';
import { createSupplier } from '@/app/(seller-center)/inventory/suppliers/actions';

// Un renglón del carrito = un producto. El costo y el precio se capturan una
// sola vez aquí; las cantidades van por variante.
type Renglon = {
    key: string;
    esNuevo: boolean;
    productId?: string;
    nombre: string;
    sku?: string | null;
    unitCost: string;
    // Lo que costó la vez pasada. Solo se muestra como ayuda: el costo se
    // captura siempre, cambia en cada remesa y define cuánto se le debe al
    // proveedor.
    costoAnterior: number | null;
    salePrice: string;
    // El precio con el que se prellenó el renglón, para mandar el precio solo si
    // el dueño lo cambió aquí.
    salePriceOriginal: string;
    // Para un producto existente la llave es el id de la variante; para uno
    // nuevo es el JSON de la combinación, que es lo que espera la action.
    variantes: { key: string; label: string; currentStock: number | null }[];
    cantidades: Record<string, string>;
    variantOptions?: { name: string; values: string[] }[];
    cargando: boolean;
    errorCarga: boolean;
    stockDesconocido: boolean;
};

const hoyLocal = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
};

const pesos = (n: number) =>
    `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const enteroPositivo = (valor: string) => {
    const n = parseInt(valor, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

// Mismas combinaciones y el mismo orden que genera la action al dar de alta el
// producto nuevo.
function combinaciones(opciones: { name: string; values: string[] }[]): Record<string, string>[] {
    if (opciones.length === 0) return [];
    let combos: Record<string, string>[] = [{}];
    for (const opcion of opciones) {
        const siguiente: Record<string, string>[] = [];
        for (const combo of combos) {
            for (const valor of opcion.values) siguiente.push({ ...combo, [opcion.name]: valor });
        }
        combos = siguiente;
    }
    return combos;
}

let contadorRenglones = 0;
const nuevaLlave = () => `r${++contadorRenglones}`;

// Resultados del buscador, en dos grupos: los del proveedor elegido y los que
// todavía no tienen proveedor.
type Resultados = { delProveedor: any[]; sinProveedor: any[] };
const SIN_RESULTADOS: Resultados = { delProveedor: [], sinProveedor: [] };

// Arriba de esta cantidad de proveedores, la lista se vuelve incómoda de
// recorrer a ojo y aparece el buscador.
const PROVEEDORES_PARA_BUSCADOR = 8;

export default function PurchaseCart({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [cargandoDatos, setCargandoDatos] = useState(true);
    const [errorDatos, setErrorDatos] = useState<string | null>(null);

    const [supplierId, setSupplierId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [noteDate, setNoteDate] = useState(hoyLocal());
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [notas, setNotas] = useState('');
    const [abono, setAbono] = useState('');
    const [paymentMethodId, setPaymentMethodId] = useState('');
    const [creditDays, setCreditDays] = useState('');

    // Paso 1: el proveedor. Sin él no se puede agregar nada a la nota.
    const [filtroProveedor, setFiltroProveedor] = useState('');
    const [formProveedor, setFormProveedor] = useState(false);
    const [nombreProveedor, setNombreProveedor] = useState('');
    const [notasProveedor, setNotasProveedor] = useState('');
    const [creandoProveedor, setCreandoProveedor] = useState(false);

    const [query, setQuery] = useState('');
    const [resultados, setResultados] = useState<Resultados>(SIN_RESULTADOS);
    const [buscando, setBuscando] = useState(false);
    const totalResultados = resultados.delProveedor.length + resultados.sinProveedor.length;
    // El lector de código de barras teclea sobre lo que tenga el foco: en cuanto
    // hay proveedor, el foco se va al buscador.
    const inputBusqueda = useRef<HTMLInputElement>(null);

    const [renglones, setRenglones] = useState<Renglon[]>([]);
    // Un solo renglón abierto a la vez: el que se acaba de agregar, que es
    // donde el dueño va a capturar las cantidades.
    const [expandido, setExpandido] = useState<string | null>(null);
    const renglonesRef = useRef<Renglon[]>([]);
    renglonesRef.current = renglones;

    const [recargandoStocks, setRecargandoStocks] = useState(false);
    const [guardando, setGuardando] = useState(false);
    // Candado síncrono: el estado y el `disabled` no alcanzan si llegan dos
    // toques en el mismo tick de React, y el servidor no es idempotente (serían
    // dos notas y el doble de inventario).
    const guardandoRef = useRef(false);
    const [formNuevo, setFormNuevo] = useState(false);

    // ── Datos del formulario ───────────────────────────────────────────────
    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const data: any = await getPurchaseFormData();
                if (!vivo) return;
                if (data?.error) {
                    setErrorDatos(data.error);
                } else {
                    setSuppliers(data.suppliers || []);
                    setLocations(data.locations || []);
                    setPaymentMethods(data.paymentMethods || []);
                    // Si solo hay una sucursal, se preselecciona.
                    if ((data.locations || []).length === 1) setLocationId(data.locations[0].id);
                }
            } catch (error: any) {
                console.error('Error al cargar los datos de la compra:', error);
                if (vivo) setErrorDatos('No se pudieron cargar proveedores y sucursales. Revisa tu conexión y vuelve a abrir la pantalla.');
            } finally {
                if (vivo) setCargandoDatos(false);
            }
        })();
        return () => { vivo = false; };
    }, []);

    useEffect(() => {
        if (supplierId) inputBusqueda.current?.focus();
    }, [supplierId]);

    // ── Buscador con retraso ───────────────────────────────────────────────
    useEffect(() => {
        if (!supplierId || query.trim().length < 2) { setResultados(SIN_RESULTADOS); setBuscando(false); return; }
        setBuscando(true);
        const t = setTimeout(async () => {
            try {
                const res: any = await searchProductsForPurchase(query, supplierId);
                setResultados({ delProveedor: res?.delProveedor || [], sinProveedor: res?.sinProveedor || [] });
            } catch (error: any) {
                console.error('Error al buscar productos:', error);
                setResultados(SIN_RESULTADOS);
                toast.error('No se pudo buscar. Revisa tu conexión.');
            } finally {
                setBuscando(false);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [query, supplierId]);

    const agregarExistente = useCallback(async (producto: any) => {
        if (!supplierId) { toast.error('Elige primero el proveedor.'); return; }
        if (!locationId) { toast.error('Elige primero la sucursal donde entró la mercancía.'); return; }
        setQuery('');
        setResultados(SIN_RESULTADOS);

        // Ya capturado: no se duplica el renglón, se sube al tope y se abre.
        const yaEsta = renglonesRef.current.find(r => !r.esNuevo && r.productId === producto.id);
        if (yaEsta) {
            setRenglones(prev => [yaEsta, ...prev.filter(r => r.key !== yaEsta.key)]);
            setExpandido(yaEsta.key);
            toast.info(`"${yaEsta.nombre}" ya estaba en la nota. Lo subí hasta arriba.`);
            return;
        }

        const key = nuevaLlave();
        // El renglón nuevo va hasta arriba y abierto: es donde se va a capturar.
        setRenglones(prev => [{
            key,
            esNuevo: false,
            productId: producto.id,
            nombre: producto.name,
            sku: producto.sku,
            unitCost: '',
            costoAnterior: null,
            salePrice: '',
            salePriceOriginal: '',
            variantes: [],
            cantidades: {},
            cargando: true,
            errorCarga: false,
            stockDesconocido: false,
        }, ...prev]);
        setExpandido(key);

        try {
            const data: any = await getProductVariantsForPurchase(producto.id, locationId);
            setRenglones(prev => prev.map(r => {
                if (r.key !== key) return r;
                if (!data) return { ...r, cargando: false, errorCarga: true };
                return {
                    ...r,
                    cargando: false,
                    errorCarga: false,
                    nombre: data.name,
                    // El costo NO se prellena: prellenado, un renglón que nadie
                    // tocó se guardaría con el costo de la remesa anterior y la
                    // nota quedaría con un total —y una deuda— equivocados.
                    unitCost: '',
                    costoAnterior: (data.currentCost !== null && data.currentCost !== undefined) ? Number(data.currentCost) : null,
                    salePrice: data.currentPrice ? String(data.currentPrice) : '',
                    salePriceOriginal: data.currentPrice ? String(data.currentPrice) : '',
                    variantes: (data.variants || []).map((v: any) => ({
                        key: v.id,
                        label: v.label,
                        currentStock: v.currentStock,
                    })),
                };
            }));
        } catch (error: any) {
            console.error('Error al cargar las variantes del producto:', error);
            setRenglones(prev => prev.map(r => r.key === key ? { ...r, cargando: false, errorCarga: true } : r));
            toast.error('No se pudieron cargar las tallas de ese modelo. Quita el renglón y vuelve a agregarlo.');
        }
    }, [locationId, supplierId]);

    // El lector de código de barras teclea muy rápido y manda Enter: si hay un
    // solo resultado, se agrega directo sin esperar al retraso.
    const alPresionarEnter = async () => {
        const q = query.trim();
        if (q.length < 2) return;
        if (!supplierId) { toast.error('Elige primero el proveedor.'); return; }
        const encontrados = [...resultados.delProveedor, ...resultados.sinProveedor];
        if (encontrados.length === 1) { agregarExistente(encontrados[0]); return; }
        setBuscando(true);
        try {
            const res: any = await searchProductsForPurchase(q, supplierId);
            const grupos: Resultados = { delProveedor: res?.delProveedor || [], sinProveedor: res?.sinProveedor || [] };
            const todos = [...grupos.delProveedor, ...grupos.sinProveedor];
            if (todos.length === 1) {
                agregarExistente(todos[0]);
            } else {
                setResultados(grupos);
                if (todos.length === 0) toast.error('Sin resultados para lo que capturaste.');
            }
        } catch (error: any) {
            console.error('Error al buscar productos:', error);
            toast.error('No se pudo buscar. Revisa tu conexión.');
        } finally {
            setBuscando(false);
        }
    };

    // ── Cambio de sucursal: los stocks en pantalla son de la sucursal elegida
    const primerRender = useRef(true);
    useEffect(() => {
        if (primerRender.current) { primerRender.current = false; return; }
        const objetivo = renglonesRef.current.filter(r => !r.esNuevo && r.productId);
        if (!locationId || objetivo.length === 0) return;

        let vivo = true;
        (async () => {
            setRecargandoStocks(true);
            try {
                const datos = await Promise.all(
                    objetivo.map(r => getProductVariantsForPurchase(r.productId as string, locationId))
                );
                if (!vivo) return;
                setRenglones(prev => prev.map(r => {
                    const idx = objetivo.findIndex(o => o.key === r.key);
                    if (idx < 0) return r;
                    const data: any = datos[idx];
                    if (!data) return { ...r, errorCarga: true, stockDesconocido: true };
                    return {
                        ...r,
                        errorCarga: false,
                        stockDesconocido: false,
                        variantes: (data.variants || []).map((v: any) => ({
                            key: v.id,
                            label: v.label,
                            currentStock: v.currentStock,
                        })),
                    };
                }));
                toast.success('Se actualizaron las existencias con la sucursal elegida.');
            } catch (error: any) {
                console.error('Error al recargar las existencias:', error);
                if (!vivo) return;
                // Nunca dejar en pantalla el stock de otra sucursal.
                setRenglones(prev => prev.map(r => (!r.esNuevo && r.productId) ? { ...r, stockDesconocido: true } : r));
                toast.error('No se pudieron actualizar las existencias de la sucursal elegida. Los números que ves ya no son confiables.');
            } finally {
                if (vivo) setRecargandoStocks(false);
            }
        })();
        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationId]);

    // ── Cálculos en vivo ───────────────────────────────────────────────────
    // Mismo cálculo que hace la action: round2 del costo, round2 de cada
    // importe, y la suma redondeada. Así el total en vivo es el que se guarda.
    const subtotalRenglon = (r: Renglon) => {
        const costo = Number(r.unitCost);
        if (!Number.isFinite(costo)) return 0;
        const costoRedondeado = round2(costo);
        return round2(r.variantes.reduce(
            (s, v) => s + round2(enteroPositivo(r.cantidades[v.key] || '') * costoRedondeado), 0
        ));
    };
    const piezasRenglon = (r: Renglon) =>
        r.variantes.reduce((s, v) => s + enteroPositivo(r.cantidades[v.key] || ''), 0);

    const total = round2(renglones.reduce((s, r) => s + subtotalRenglon(r), 0));
    const totalPiezas = renglones.reduce((s, r) => s + piezasRenglon(r), 0);
    const montoAbono = abono.trim() === '' ? 0 : (Number(abono) || 0);
    const saldo = round2(Math.max(0, total - montoAbono));

    // ── Edición de renglones ───────────────────────────────────────────────
    const actualizar = (key: string, cambios: Partial<Renglon>) =>
        setRenglones(prev => prev.map(r => r.key === key ? { ...r, ...cambios } : r));

    const setCantidad = (key: string, varianteKey: string, valor: string) =>
        setRenglones(prev => prev.map(r =>
            r.key === key ? { ...r, cantidades: { ...r.cantidades, [varianteKey]: valor } } : r
        ));

    const quitar = (key: string) => setRenglones(prev => prev.filter(r => r.key !== key));

    const agregarNuevo = (datos: { nombre: string; precio: string; opciones: { name: string; values: string[] }[] }) => {
        const combos = combinaciones(datos.opciones);
        const key = nuevaLlave();
        setRenglones(prev => [{
            key,
            esNuevo: true,
            nombre: datos.nombre,
            unitCost: '',
            costoAnterior: null,
            salePrice: datos.precio,
            salePriceOriginal: '',
            variantOptions: datos.opciones,
            variantes: combos.map(c => ({
                key: JSON.stringify(c),
                label: Object.values(c).join(' / '),
                currentStock: null,
            })),
            cantidades: {},
            cargando: false,
            errorCarga: false,
            stockDesconocido: false,
        }, ...prev]);
        setExpandido(key);
        setFormNuevo(false);
    };

    // ── Paso 1: el proveedor ───────────────────────────────────────────────
    const proveedorElegido = suppliers.find(s => s.id === supplierId) || null;

    // Los renglones capturados son modelos del proveedor anterior: cambiar de
    // proveedor los deja sin sentido, así que se avisa y se limpian.
    const cambiarProveedor = () => {
        if (renglones.length > 0 && !confirm('Los productos que llevas capturados son de este proveedor y se van a quitar de la nota. ¿Cambiar de proveedor?')) return;
        setRenglones([]);
        setExpandido(null);
        setSupplierId('');
        setQuery('');
        setResultados(SIN_RESULTADOS);
        setFiltroProveedor('');
    };

    const crearProveedor = async () => {
        if (creandoProveedor) return;
        const nombre = nombreProveedor.trim();
        if (!nombre) { toast.error('Captura el nombre del proveedor.'); return; }

        setCreandoProveedor(true);
        try {
            const res: any = await createSupplier({ name: nombre, notes: notasProveedor.trim() || undefined });
            if (!res?.success) {
                toast.error(res?.error || 'No se pudo crear el proveedor.');
                return;
            }
            // `createSupplier` no devuelve el id: se recarga la lista y se busca
            // por nombre para dejarlo elegido.
            const data: any = await getPurchaseFormData();
            const lista: any[] = data?.suppliers || [];
            setSuppliers(lista);
            const creado = lista.find(s => String(s.name).trim().toLowerCase() === nombre.toLowerCase());
            if (creado) {
                setSupplierId(creado.id);
                toast.success(`Proveedor "${creado.name}" creado y elegido.`);
            } else {
                toast.success('Proveedor creado. Elígelo de la lista.');
            }
            setFormProveedor(false);
            setNombreProveedor('');
            setNotasProveedor('');
        } catch (error: any) {
            console.error('Error al crear el proveedor:', error);
            toast.error('No se pudo crear el proveedor. Revisa tu conexión y vuelve a intentar.');
        } finally {
            setCreandoProveedor(false);
        }
    };

    const proveedoresFiltrados = filtroProveedor.trim() === ''
        ? suppliers
        : suppliers.filter(s => String(s.name).toLowerCase().includes(filtroProveedor.trim().toLowerCase()));

    // ── Guardar ────────────────────────────────────────────────────────────
    // No hay borrador: cerrar con renglones capturados los pierde todos.
    const cerrar = () => {
        if (renglones.length > 0 && !confirm('Vas a perder lo que llevas capturado. ¿Cerrar de todos modos?')) return;
        onClose();
    };

    const guardar = async () => {
        if (guardando || guardandoRef.current) return;

        if (renglones.length === 0) { toast.error('Agrega al menos un producto a la nota.'); return; }
        if (!supplierId) { toast.error('Elige el proveedor.'); return; }
        if (!locationId) { toast.error('Elige la sucursal donde entró la mercancía.'); return; }

        for (let i = 0; i < renglones.length; i++) {
            const r = renglones[i];
            const costo = Number(r.unitCost);
            if (r.unitCost.trim() === '' || !Number.isFinite(costo) || costo < 0 || costo > 1000000) {
                toast.error(`Captura un costo válido para "${r.nombre}".`);
                return;
            }
            if (r.salePrice.trim() !== '') {
                const precio = Number(r.salePrice);
                if (!Number.isFinite(precio) || precio < 0 || precio > 1000000) {
                    toast.error(`El precio de venta de "${r.nombre}" no es válido.`);
                    return;
                }
            }
            if (r.esNuevo) {
                const precio = Number(r.salePrice);
                if (r.salePrice.trim() === '' || !Number.isFinite(precio) || precio <= 0) {
                    toast.error(`Falta el precio de venta de "${r.nombre}". Un producto nuevo no puede quedar sin precio.`);
                    return;
                }
            }
            if (piezasRenglon(r) === 0) {
                toast.error(`Captura al menos una cantidad en "${r.nombre}".`);
                return;
            }
            if (r.variantes.some(v => enteroPositivo(r.cantidades[v.key] || '') > 100000)) {
                toast.error(`Alguna cantidad de "${r.nombre}" es demasiado grande. Revisa lo que capturaste.`);
                return;
            }
        }

        if (creditDays.trim() !== '') {
            const dias = parseInt(creditDays, 10);
            if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
                toast.error('El plazo debe ser de al menos 1 día y máximo 365.');
                return;
            }
        }
        if (abono.trim() !== '') {
            if (!Number.isFinite(montoAbono) || montoAbono < 0) { toast.error('El abono no es válido.'); return; }
            if (montoAbono > total) { toast.error('El abono no puede ser mayor que el total de la nota.'); return; }
        }

        // El precio de un producto existente solo se manda si se cambió aquí: si
        // alguien lo movió desde otra pantalla con el carrito abierto, reenviar el
        // prellenado revertiría ese cambio en silencio. Para un producto nuevo el
        // precio es obligatorio y siempre va.
        const lineas = renglones.map(r => ({
            productId: r.esNuevo ? undefined : r.productId,
            newProduct: r.esNuevo ? { name: r.nombre, variantOptions: r.variantOptions || [] } : undefined,
            unitCost: Number(r.unitCost),
            salePrice: (r.salePrice.trim() === '' || (!r.esNuevo && r.salePrice === r.salePriceOriginal))
                ? undefined
                : Number(r.salePrice),
            quantities: r.variantes
                .map(v => ({ variantKey: v.key, quantity: enteroPositivo(r.cantidades[v.key] || '') }))
                .filter(q => q.quantity > 0),
        }));

        guardandoRef.current = true;
        setGuardando(true);
        try {
            const res: any = await createPurchaseNote({
                supplierId,
                locationId,
                noteDate,
                invoiceNumber: invoiceNumber.trim() || undefined,
                notes: notas.trim() || undefined,
                creditDays: creditDays.trim() === '' ? undefined : parseInt(creditDays, 10),
                initialPayment: montoAbono > 0
                    ? { amount: montoAbono, paymentMethodId: paymentMethodId || undefined }
                    : undefined,
                lines: lineas,
            });

            if (res?.success) {
                toast.success(`Compra C-${String(res.folio).padStart(6, '0')} registrada · ${totalPiezas} pieza${totalPiezas === 1 ? '' : 's'}`);
                onSaved();
                onClose();
                return;
            }
            toast.error(res?.error || 'No se pudo guardar la nota de compra.');
        } catch (error: any) {
            console.error('Error al guardar la nota de compra:', error);
            toast.error('No se pudo guardar la nota. Revisa tu conexión y vuelve a intentar.');
        } finally {
            guardandoRef.current = false;
            setGuardando(false);
        }
    };

    // ── Pantalla ───────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
            <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-lg md:text-2xl font-black truncate">🧾 Nueva Compra</h2>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                        La mercancía se suma al inventario al guardar
                    </p>
                </div>
                <button
                    onClick={cerrar}
                    className="px-4 py-2 border border-border rounded-xl font-black uppercase tracking-widest text-[10px] text-gray-500 shrink-0"
                >
                    Cerrar
                </button>
            </div>

            <div className="p-4 md:p-8">
                {errorDatos && (
                    <div className="bg-card border border-red-200 dark:border-red-900 rounded-2xl p-6 mb-4">
                        <p className="font-black text-sm text-red-600 mb-1">No se pudo abrir la compra</p>
                        <p className="text-xs text-red-500">{errorDatos}</p>
                    </div>
                )}

                {cargandoDatos && <p className="text-sm text-gray-400">Cargando…</p>}

                {!cargandoDatos && !errorDatos && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Carrito */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Paso 1: sin proveedor no se captura nada */}
                            {!proveedorElegido ? (
                                <div className="bg-card border border-border rounded-2xl p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paso 1 · Proveedor</p>
                                            <p className="font-black text-sm">¿A quién le compraste?</p>
                                        </div>
                                        <button
                                            onClick={() => setFormProveedor(v => !v)}
                                            className="px-4 py-2 border border-border rounded-xl font-black uppercase tracking-widest text-[10px] shrink-0"
                                        >
                                            + Proveedor nuevo
                                        </button>
                                    </div>

                                    {formProveedor && (
                                        <div className="mt-3 border border-border rounded-xl p-3 space-y-3">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre del proveedor</label>
                                                <input
                                                    autoFocus
                                                    value={nombreProveedor}
                                                    onChange={e => setNombreProveedor(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); crearProveedor(); } }}
                                                    placeholder="Ej. FOXXY JEANS"
                                                    className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notas (opcional)</label>
                                                <input
                                                    value={notasProveedor}
                                                    onChange={e => setNotasProveedor(e.target.value)}
                                                    placeholder="Ej. teléfono, dirección…"
                                                    className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                                />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setFormProveedor(false)}
                                                    className="flex-1 px-4 py-3 border border-border rounded-xl font-black uppercase tracking-widest text-[10px] text-gray-500"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={crearProveedor}
                                                    disabled={creandoProveedor}
                                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] disabled:opacity-40"
                                                >
                                                    {creandoProveedor ? 'Creando…' : 'Crear y elegir'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {suppliers.length > PROVEEDORES_PARA_BUSCADOR && (
                                        <input
                                            value={filtroProveedor}
                                            onChange={e => setFiltroProveedor(e.target.value)}
                                            placeholder="Buscar proveedor…"
                                            className="mt-3 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                        />
                                    )}

                                    {suppliers.length === 0 ? (
                                        <p className="mt-3 text-xs text-gray-500">
                                            Todavía no tienes proveedores activos. Da uno de alta con “+ Proveedor nuevo”.
                                        </p>
                                    ) : proveedoresFiltrados.length === 0 ? (
                                        <p className="mt-3 text-xs text-gray-400">Ningún proveedor se llama así.</p>
                                    ) : (
                                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                                            {proveedoresFiltrados.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => { setSupplierId(s.id); setFiltroProveedor(''); }}
                                                    className="text-left p-3 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-black text-sm"
                                                >
                                                    {s.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedor</p>
                                        <p className="font-black text-base truncate">{proveedorElegido.name}</p>
                                    </div>
                                    <button
                                        onClick={cambiarProveedor}
                                        className="px-4 py-2 border border-border rounded-xl font-black uppercase tracking-widest text-[10px] shrink-0"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            )}

                            <div className="bg-card border border-border rounded-2xl p-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    Buscar modelo o escanear código
                                </label>
                                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                    <input
                                        ref={inputBusqueda}
                                        disabled={!supplierId}
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); alPresionarEnter(); } }}
                                        placeholder="Nombre o SKU del modelo…"
                                        className="flex-1 p-3 rounded-xl border border-border bg-transparent font-bold text-sm disabled:opacity-40"
                                    />
                                    <button
                                        onClick={() => setFormNuevo(true)}
                                        disabled={!supplierId}
                                        className="px-4 py-3 border border-border rounded-xl font-black uppercase tracking-widest text-[10px] shrink-0 disabled:opacity-40"
                                    >
                                        + Producto nuevo
                                    </button>
                                </div>

                                {!supplierId && (
                                    <p className="mt-2 text-xs text-amber-600 font-bold">
                                        Elige primero el proveedor.
                                    </p>
                                )}
                                {supplierId && !locationId && (
                                    <p className="mt-2 text-xs text-amber-600 font-bold">
                                        Elige primero la sucursal donde entró la mercancía.
                                    </p>
                                )}
                                {buscando && <p className="mt-2 text-xs text-gray-400">Buscando…</p>}
                                {!buscando && supplierId && query.trim().length >= 2 && totalResultados === 0 && (
                                    <p className="mt-2 text-xs text-gray-400">
                                        Sin resultados entre los modelos de {proveedorElegido?.name} ni entre los que no tienen proveedor. Puedes darlo de alta con “+ Producto nuevo”.
                                    </p>
                                )}

                                <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
                                    {resultados.delProveedor.length > 0 && (
                                        <>
                                            <p className="pt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                De {proveedorElegido?.name}
                                            </p>
                                            {resultados.delProveedor.map(r => (
                                                <button
                                                    key={r.id}
                                                    onClick={() => agregarExistente(r)}
                                                    className="w-full text-left p-3 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <p className="font-black text-sm">{r.name}</p>
                                                    {r.sku && <p className="text-[10px] text-gray-400 font-medium">SKU {r.sku}</p>}
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {resultados.sinProveedor.length > 0 && (
                                        <>
                                            <p className="pt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                Sin proveedor asignado
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-medium">
                                                Al guardar la compra se le asignan a {proveedorElegido?.name}.
                                            </p>
                                            {resultados.sinProveedor.map(r => (
                                                <button
                                                    key={r.id}
                                                    onClick={() => agregarExistente(r)}
                                                    className="w-full text-left p-3 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <p className="font-black text-sm">{r.name}</p>
                                                    {r.sku && <p className="text-[10px] text-gray-400 font-medium">SKU {r.sku}</p>}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>

                            {recargandoStocks && (
                                <p className="text-xs text-gray-400 font-bold">Actualizando existencias de la sucursal…</p>
                            )}

                            {supplierId && renglones.length === 0 && (
                                <div className="bg-card border border-dashed border-border rounded-2xl p-8 md:p-10 text-center">
                                    <div className="text-4xl mb-3">🛒</div>
                                    <h3 className="text-base font-black mb-1">La nota está vacía</h3>
                                    <p className="text-xs text-gray-500">
                                        Busca un modelo arriba, escanea su código, o da de alta uno nuevo.
                                    </p>
                                </div>
                            )}

                            {renglones.map((r, i) => (
                                <div key={r.key} className="bg-card border border-border rounded-2xl p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setExpandido(expandido === r.key ? null : r.key)}
                                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandido(expandido === r.key ? null : r.key); } }}
                                            className="min-w-0 flex-1 flex items-start gap-2 cursor-pointer text-left"
                                        >
                                            <span className="text-gray-400 text-sm shrink-0">{expandido === r.key ? '▾' : '▸'}</span>
                                            <div className="min-w-0">
                                                <p className="font-black text-sm truncate">
                                                    {i + 1}. {r.nombre}
                                                    {r.esNuevo && (
                                                        <span className="ml-2 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wide">
                                                            Nuevo
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest truncate">
                                                    {r.sku ? `SKU ${r.sku} · ` : ''}
                                                    Costo {r.unitCost.trim() === '' ? '—' : pesos(Number(r.unitCost) || 0)} ·
                                                    {' '}Precio {r.salePrice.trim() === '' ? '—' : pesos(Number(r.salePrice) || 0)} ·
                                                    {' '}{piezasRenglon(r)} pieza{piezasRenglon(r) === 1 ? '' : 's'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-sm font-black">{pesos(subtotalRenglon(r))}</p>
                                            <button
                                                onClick={() => quitar(r.key)}
                                                className="text-[11px] font-black text-red-500 hover:underline"
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                    </div>

                                    {expandido === r.key && (<>
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Costo unitario</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                inputMode="decimal"
                                                value={r.unitCost}
                                                onChange={e => actualizar(r.key, { unitCost: e.target.value })}
                                                placeholder="0.00"
                                                className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-black text-sm"
                                            />
                                            {r.costoAnterior !== null && (
                                                <p className="mt-1 text-[10px] text-gray-400 font-medium">
                                                    La vez pasada te costó {pesos(r.costoAnterior)}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                Precio de venta {r.esNuevo && <span className="text-red-500">*</span>}
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                inputMode="decimal"
                                                value={r.salePrice}
                                                onChange={e => actualizar(r.key, { salePrice: e.target.value })}
                                                placeholder="0.00"
                                                className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-black text-sm"
                                            />
                                        </div>
                                    </div>

                                    {r.cargando && <p className="mt-3 text-xs text-gray-400">Cargando tallas…</p>}

                                    {r.errorCarga && !r.cargando && (
                                        <p className="mt-3 text-xs text-red-500 font-bold">
                                            No se pudieron cargar las tallas de este modelo en la sucursal elegida. Quita el renglón y vuelve a agregarlo.
                                        </p>
                                    )}

                                    {!r.cargando && r.variantes.length > 0 && (
                                        <div className="mt-3 border border-border rounded-xl divide-y divide-border">
                                            {r.variantes.map(v => (
                                                <div key={v.key} className="flex items-center gap-3 p-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-sm truncate">{v.label || 'Única'}</p>
                                                        <p className="text-[10px] text-gray-400 font-medium">
                                                            {r.esNuevo
                                                                ? 'Producto nuevo, empieza en 0'
                                                                : r.stockDesconocido
                                                                    ? 'Existencia desconocida — vuelve a elegir la sucursal'
                                                                    : `Tienes ${v.currentStock ?? 0} en esta sucursal`}
                                                        </p>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        inputMode="numeric"
                                                        value={r.cantidades[v.key] ?? ''}
                                                        onChange={e => setCantidad(r.key, v.key, e.target.value)}
                                                        placeholder="0"
                                                        className="w-20 md:w-24 p-3 rounded-lg border border-border bg-transparent text-center font-black"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!r.cargando && !r.errorCarga && r.variantes.length === 0 && (
                                        <p className="mt-3 text-xs text-gray-400">
                                            Este modelo no tiene tallas ni colores. Agrégalos en Editar Producto.
                                        </p>
                                    )}
                                    </>)}
                                </div>
                            ))}
                        </div>

                        {/* Panel derecho */}
                        <div className="lg:col-span-1">
                            <div className="bg-card border border-border rounded-2xl p-4 space-y-4 lg:sticky lg:top-24">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sucursal</label>
                                    <select
                                        value={locationId}
                                        onChange={e => setLocationId(e.target.value)}
                                        className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                    >
                                        <option value="">Elige una sucursal…</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                    {locations.length === 0 && (
                                        <p className="mt-1 text-[11px] text-gray-500">
                                            No tienes sucursales disponibles. Crea una en Configuración → Sucursales.
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha</label>
                                        <input
                                            type="date"
                                            value={noteDate}
                                            onChange={e => setNoteDate(e.target.value)}
                                            className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Factura</label>
                                        <input
                                            value={invoiceNumber}
                                            onChange={e => setInvoiceNumber(e.target.value)}
                                            placeholder="Folio del proveedor"
                                            className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notas (opcional)</label>
                                    <input
                                        value={notas}
                                        onChange={e => setNotas(e.target.value)}
                                        placeholder="Ej. llegó incompleto…"
                                        className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                    />
                                </div>

                                <div className="border-t border-border pt-4 flex items-baseline justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</span>
                                    <span className="text-2xl font-black">{pesos(total)}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest -mt-3">
                                    {totalPiezas} pieza{totalPiezas === 1 ? '' : 's'} · {renglones.length} producto{renglones.length === 1 ? '' : 's'}
                                </p>

                                <div className="border-t border-border pt-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Abono al recibir</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            inputMode="decimal"
                                            value={abono}
                                            onChange={e => setAbono(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full p-3 rounded-xl border border-border bg-transparent font-black text-sm"
                                        />
                                        <select
                                            value={paymentMethodId}
                                            onChange={e => setPaymentMethodId(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                        >
                                            <option value="">Forma de pago…</option>
                                            {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Plazo del saldo (días)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            step={1}
                                            inputMode="numeric"
                                            value={creditDays}
                                            onChange={e => setCreditDays(e.target.value)}
                                            placeholder="30"
                                            className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-black text-sm"
                                        />
                                        <p className="mt-1 text-[10px] text-gray-400 font-medium">
                                            Si lo dejas vacío y queda saldo, se aplican 30 días.
                                        </p>
                                    </div>

                                    <div className="flex items-baseline justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Queda a deber</span>
                                        <span className={`text-lg font-black ${saldo > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {pesos(saldo)}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={guardar}
                                    disabled={guardando || renglones.length === 0}
                                    className="w-full px-5 py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-40"
                                >
                                    {guardando ? 'Guardando…' : 'Guardar compra'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {formNuevo && (
                <FormProductoNuevo
                    onClose={() => setFormNuevo(false)}
                    onAgregar={agregarNuevo}
                />
            )}
        </div>
    );
}

// ── Alta rápida de producto dentro de la nota ─────────────────────────────
function FormProductoNuevo({
    onClose,
    onAgregar,
}: {
    onClose: () => void;
    onAgregar: (datos: { nombre: string; precio: string; opciones: { name: string; values: string[] }[] }) => void;
}) {
    const [nombre, setNombre] = useState('');
    const [precio, setPrecio] = useState('');
    const [opciones, setOpciones] = useState<{ name: string; values: string }[]>([{ name: 'Talla', values: '' }]);

    const opcionesLimpias = opciones
        .map(o => ({
            name: o.name.trim(),
            // "S, M, S" se queda en "S, M": un valor repetido generaría dos veces
            // la misma combinación y el servidor lo rechazaría hasta el final,
            // con todo ya capturado.
            values: [...new Set(o.values.split(',').map(v => v.trim()).filter(Boolean))],
        }))
        .filter(o => o.name && o.values.length > 0);

    const cuantasCombinaciones = opcionesLimpias.length === 0
        ? 0
        : opcionesLimpias.reduce((s, o) => s * o.values.length, 1);

    const agregar = () => {
        if (!nombre.trim()) { toast.error('Captura el nombre del producto.'); return; }
        const p = Number(precio);
        if (precio.trim() === '' || !Number.isFinite(p) || p <= 0) {
            toast.error('El precio de venta es obligatorio y debe ser mayor que cero.');
            return;
        }
        if (p > 1000000) { toast.error('El precio de venta es demasiado alto. Revisa lo que capturaste.'); return; }
        if (opcionesLimpias.length === 0) {
            toast.error('Captura al menos una talla o color, separados por coma.');
            return;
        }
        if (new Set(opcionesLimpias.map(o => o.name)).size !== opcionesLimpias.length) {
            toast.error('Hay dos opciones con el mismo nombre.');
            return;
        }
        if (cuantasCombinaciones > 100) {
            toast.error('Se generan demasiadas combinaciones. Reduce las tallas o los colores.');
            return;
        }
        onAgregar({ nombre: nombre.trim(), precio: precio.trim(), opciones: opcionesLimpias });
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black">🆕 Producto nuevo</h3>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                            Nace fuera de línea y sin fotos
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-foreground text-2xl leading-none">×</button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre</label>
                        <input
                            autoFocus
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            placeholder="Ej. Blusa manga larga floral"
                            className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Precio de venta <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={precio}
                            onChange={e => setPrecio(e.target.value)}
                            placeholder="0.00"
                            className="mt-1 w-full p-3 rounded-xl border border-border bg-transparent font-black text-sm"
                        />
                        <p className="mt-1 text-[10px] text-gray-400 font-medium">
                            Obligatorio: sin precio el modelo se vendería al costo en el punto de venta.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tallas y colores</label>
                        {opciones.map((o, i) => (
                            <div key={i} className="flex flex-col sm:flex-row gap-2">
                                <input
                                    value={o.name}
                                    onChange={e => setOpciones(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                                    placeholder="Talla"
                                    className="sm:w-32 p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                />
                                <input
                                    value={o.values}
                                    onChange={e => setOpciones(prev => prev.map((x, j) => j === i ? { ...x, values: e.target.value } : x))}
                                    placeholder="S, M, L"
                                    className="flex-1 p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                />
                                {opciones.length > 1 && (
                                    <button
                                        onClick={() => setOpciones(prev => prev.filter((_, j) => j !== i))}
                                        className="text-[11px] font-black text-red-500 hover:underline shrink-0 sm:self-center"
                                    >
                                        Quitar
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={() => setOpciones(prev => [...prev, { name: '', values: '' }])}
                            className="text-[11px] font-black text-blue-600 hover:underline"
                        >
                            + Agregar otra opción (color, modelo…)
                        </button>
                        <p className="text-[10px] text-gray-400 font-medium">
                            Separa los valores con coma. Se generan {cuantasCombinaciones} combinación{cuantasCombinaciones === 1 ? '' : 'es'}.
                        </p>
                    </div>
                </div>

                <div className="p-5 border-t border-border flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-5 py-3 border border-border rounded-xl font-black uppercase tracking-widest text-xs text-gray-500"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={agregar}
                        className="flex-1 px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs"
                    >
                        Agregar a la nota
                    </button>
                </div>
            </div>
        </div>
    );
}

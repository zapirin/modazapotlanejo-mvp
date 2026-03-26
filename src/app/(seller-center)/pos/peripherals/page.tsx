"use client";

import React, { useState, useEffect, useRef } from 'react';
import { getMyPeripherals, savePeripheral, deletePeripheral } from '@/app/actions/peripherals';
import { toast } from 'sonner';

const PERIPHERAL_TYPES = [
    {
        type: 'PRINTER_NETWORK',
        icon: '🖨️',
        label: 'Impresora Térmica (Red/IP)',
        desc: 'Conecta por WiFi o cable de red. Compatible con Epson, Star, Bixolon.',
        fields: [
            { key: 'ip', label: 'Dirección IP', placeholder: '192.168.1.100', type: 'text' },
            { key: 'port', label: 'Puerto', placeholder: '9100', type: 'number' },
            { key: 'paperWidth', label: 'Ancho de papel', placeholder: '80', type: 'number', suffix: 'mm' },
        ]
    },
    {
        type: 'PRINTER_BLUETOOTH',
        icon: '📱',
        label: 'Impresora Bluetooth',
        desc: 'Para usar desde móvil o tablet. Requiere parear el dispositivo primero.',
        fields: [
            { key: 'deviceName', label: 'Nombre del dispositivo', placeholder: 'Ej: RPP02N', type: 'text' },
            { key: 'paperWidth', label: 'Ancho de papel', placeholder: '58', type: 'number', suffix: 'mm' },
        ]
    },
    {
        type: 'BARCODE',
        icon: '📷',
        label: 'Lector de Código de Barras',
        desc: 'USB HID o Bluetooth. El lector simula teclado — se configura automáticamente.',
        fields: [
            { key: 'prefix', label: 'Prefijo (opcional)', placeholder: 'Dejar vacío si no aplica', type: 'text' },
            { key: 'suffix', label: 'Sufijo', placeholder: 'Enter (por defecto)', type: 'text' },
            { key: 'autoSearch', label: 'Buscar automáticamente al escanear', type: 'checkbox' },
        ]
    },
    {
        type: 'CASH_DRAWER',
        icon: '💰',
        label: 'Cajón de Dinero',
        desc: 'Se conecta a la impresora. Se abre automáticamente al completar una venta.',
        fields: [
            { key: 'triggerOnSale', label: 'Abrir al completar venta', type: 'checkbox' },
            { key: 'triggerOnCash', label: 'Solo abrir en pagos en efectivo', type: 'checkbox' },
            { key: 'printerIp', label: 'IP de impresora conectada', placeholder: '192.168.1.100', type: 'text' },
        ]
    },
    {
        type: 'CUSTOMER_DISPLAY',
        icon: '📺',
        label: 'Pantalla del Cliente',
        desc: 'Segunda pantalla que muestra el total al cliente. Abre en ventana nueva.',
        fields: [
            { key: 'message', label: 'Mensaje de bienvenida', placeholder: '¡Bienvenido!', type: 'text' },
            { key: 'showLogo', label: 'Mostrar logo de la tienda', type: 'checkbox' },
        ]
    },
];

function PeripheralForm({ ptype, onSave, onCancel, existing }: {
    ptype: typeof PERIPHERAL_TYPES[0],
    onSave: (name: string, config: any) => void,
    onCancel: () => void,
    existing?: any
}) {
    const [name, setName] = useState(existing?.name || ptype.label);
    const [config, setConfig] = useState<Record<string, any>>(existing?.config || {});

    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 space-y-4 border border-border">
            <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Nombre del dispositivo</label>
                <input value={name} onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            {ptype.fields.map(field => (
                <div key={field.key} className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">{field.label}</label>
                    {field.type === 'checkbox' ? (
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`relative w-10 h-5 rounded-full transition-all ${config[field.key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                onClick={() => setConfig(p => ({...p, [field.key]: !p[field.key]}))}>
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${config[field.key] ? 'left-5' : 'left-0.5'}`} />
                            </div>
                            <span className="text-sm font-medium text-foreground">{field.label}</span>
                        </label>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input type={field.type} value={config[field.key] || ''} placeholder={(field as any).placeholder || ''}
                                onChange={e => setConfig(p => ({...p, [field.key]: e.target.value}))}
                                className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-900 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                            {(field as any).suffix && <span className="text-sm text-gray-400 font-bold">{(field as any).suffix}</span>}
                        </div>
                    )}
                </div>
            ))}
            <div className="flex gap-2 pt-2">
                <button onClick={() => onSave(name, config)}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition">
                    💾 Guardar
                </button>
                <button onClick={onCancel}
                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-black hover:bg-gray-200 transition">
                    Cancelar
                </button>
            </div>
        </div>
    );
}

export default function PeripheralsPage() {
    const [peripherals, setPeripherals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [testingBarcode, setTestingBarcode] = useState(false);
    const [barcodeInput, setBarcodeInput] = useState('');
    const barcodeRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getMyPeripherals().then(p => { setPeripherals(p); setLoading(false); });
    }, []);

    useEffect(() => {
        if (testingBarcode) barcodeRef.current?.focus();
    }, [testingBarcode]);

    const handleSave = async (type: string, name: string, config: any, existingId?: string) => {
        const res = await savePeripheral({ id: existingId, type, name, config });
        if (res.success) {
            toast.success('Periférico guardado');
            setAdding(null);
            setEditing(null);
            getMyPeripherals().then(setPeripherals);
        } else toast.error(res.error || 'Error al guardar');
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar "${name}"?`)) return;
        const res = await deletePeripheral(id);
        if (res.success) {
            setPeripherals(prev => prev.filter(p => p.id !== id));
            toast.success('Periférico eliminado');
        }
    };

    const openCustomerDisplay = () => {
        const display = peripherals.find(p => p.type === 'CUSTOMER_DISPLAY');
        const url = `/pos/customer-display${display?.config?.message ? `?msg=${encodeURIComponent(display.config.message)}` : ''}`;
        window.open(url, 'customer_display', 'width=800,height=600,menubar=no,toolbar=no');
        toast.success('Pantalla del cliente abierta');
    };

    const testNetworkPrinter = async (config: any) => {
        toast.info(`Probando conexión a ${config.ip}:${config.port || 9100}...`);
        // En un entorno real, esto haría una petición al servidor
        // Por ahora simulamos el test
        setTimeout(() => toast.success('✓ Impresora encontrada (simulado)'), 1500);
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">🔌 Periféricos del POS</h1>
                    <p className="text-gray-400 text-sm mt-1">Configura los dispositivos conectados a tu punto de venta.</p>
                </div>
                <a href="/pos" className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-black hover:bg-gray-200 transition">
                    ← Volver al POS
                </a>
            </div>

            {/* Test de lector de código de barras */}
            {peripherals.some(p => p.type === 'BARCODE') && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-2xl p-5">
                    <div className="flex items-center justify-between gap-4 mb-3">
                        <div>
                            <p className="font-black text-sm">📷 Probar Lector de Código de Barras</p>
                            <p className="text-xs text-gray-400">Haz clic en el campo y escanea un código</p>
                        </div>
                        <button onClick={() => setTestingBarcode(!testingBarcode)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition ${testingBarcode ? 'bg-red-100 text-red-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                            {testingBarcode ? 'Detener' : 'Iniciar prueba'}
                        </button>
                    </div>
                    {testingBarcode && (
                        <div className="space-y-2">
                            <input ref={barcodeRef} value={barcodeInput}
                                onChange={e => setBarcodeInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && barcodeInput) { toast.success(`Código escaneado: ${barcodeInput}`); setBarcodeInput(''); } }}
                                placeholder="Esperando escaneo..."
                                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border-2 border-blue-400 rounded-xl font-mono text-sm focus:outline-none animate-pulse" />
                            {barcodeInput && <p className="text-xs text-blue-600 font-bold">Código: {barcodeInput} — presiona Enter para confirmar</p>}
                        </div>
                    )}
                </div>
            )}

            {/* Pantalla del cliente */}
            {peripherals.some(p => p.type === 'CUSTOMER_DISPLAY') && (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <p className="font-black text-sm">📺 Pantalla del cliente configurada</p>
                        <p className="text-xs text-gray-400">Abre en ventana separada para mostrar al cliente</p>
                    </div>
                    <button onClick={openCustomerDisplay}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition">
                        Abrir pantalla →
                    </button>
                </div>
            )}

            {/* Dispositivos configurados */}
            {peripherals.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Dispositivos configurados</h2>
                    {peripherals.map(p => {
                        const ptype = PERIPHERAL_TYPES.find(t => t.type === p.type);
                        return (
                            <div key={p.id} className="bg-card border border-border rounded-2xl p-5">
                                {editing === p.id && ptype ? (
                                    <PeripheralForm ptype={ptype} existing={p}
                                        onSave={(name, config) => handleSave(p.type, name, config, p.id)}
                                        onCancel={() => setEditing(null)} />
                                ) : (
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{ptype?.icon}</span>
                                            <div>
                                                <p className="font-black text-sm">{p.name}</p>
                                                <p className="text-xs text-gray-400">{ptype?.label}</p>
                                                {p.config?.ip && <p className="text-[10px] font-mono text-blue-500">{p.config.ip}:{p.config.port || 9100}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {p.type === 'PRINTER_NETWORK' && (
                                                <button onClick={() => testNetworkPrinter(p.config)}
                                                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 border border-blue-200 rounded-xl text-xs font-black hover:bg-blue-100 transition">
                                                    Probar
                                                </button>
                                            )}
                                            <button onClick={() => setEditing(p.id)}
                                                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-black hover:bg-gray-200 transition">
                                                Editar
                                            </button>
                                            <button onClick={() => handleDelete(p.id, p.name)}
                                                className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 rounded-xl text-xs font-black hover:bg-red-100 transition">
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Agregar nuevo periférico */}
            <div className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Agregar dispositivo</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PERIPHERAL_TYPES.map(ptype => (
                        <div key={ptype.type} className="bg-card border border-border rounded-2xl p-5 space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="text-3xl">{ptype.icon}</span>
                                <div className="flex-1">
                                    <p className="font-black text-sm">{ptype.label}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{ptype.desc}</p>
                                </div>
                            </div>
                            {adding === ptype.type ? (
                                <PeripheralForm ptype={ptype}
                                    onSave={(name, config) => handleSave(ptype.type, name, config)}
                                    onCancel={() => setAdding(null)} />
                            ) : (
                                <button onClick={() => { setAdding(ptype.type); setEditing(null); }}
                                    className="w-full py-2 border-2 border-dashed border-border rounded-xl text-xs font-black text-gray-400 hover:border-blue-400 hover:text-blue-600 transition">
                                    + Agregar {ptype.label}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Instrucciones */}
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-5 space-y-3">
                <p className="font-black text-sm text-amber-800 dark:text-amber-400">📋 Guía de conexión</p>
                <div className="space-y-2 text-xs text-amber-700 dark:text-amber-300">
                    <p><strong>Impresora de red:</strong> Conéctala al mismo WiFi que tu computadora. Encuentra su IP en el menú de la impresora o en tu router.</p>
                    <p><strong>Impresora Bluetooth:</strong> Parear primero en Ajustes del sistema, luego configura aquí el nombre del dispositivo.</p>
                    <p><strong>Lector de barras USB:</strong> Solo enchúfalo — funciona automáticamente como teclado. Usa el botón "Probar" para verificar.</p>
                    <p><strong>Cajón de dinero:</strong> Se conecta al puerto RJ11 de la impresora. Se abre al imprimir el ticket de venta.</p>
                    <p><strong>Pantalla cliente:</strong> Conecta un monitor secundario, abre la ventana de pantalla del cliente y arrástrala a ese monitor.</p>
                </div>
            </div>
        </div>
    );
}

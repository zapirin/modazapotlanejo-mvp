import React from 'react';

export default function SellerDashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Bienvenido de nuevo, Modas Lucy</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Aquí está el resumen de tu negocio en Zapotlanejo hoy.
                </p>
            </div>

            {/* Tarjetas de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:border-blue-900 transition-colors">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Ventas del Mes (Bruto)</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">$42,500.00 MXN</p>
                    </div>
                    <div className="mt-4 flex items-center text-sm">
                        <span className="text-green-600 font-medium flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                            12.5%
                        </span>
                        <span className="text-gray-400 ml-2">vs el mes pasado</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:border-blue-900 transition-colors">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Inventario Total (Piezas)</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">1,248</p>
                    </div>
                    <div className="mt-4 flex items-center text-sm">
                        <span className="text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-md">
                            Abarcando 42 Modelos
                        </span>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:border-blue-900 transition-colors">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Saldo Pendiente (Deuda VAS/Comisión)</p>
                        <p className="text-3xl font-bold text-red-600 mt-2">-$1,500.00 MXN</p>
                    </div>
                    <div className="mt-4 flex items-center text-sm">
                        <span className="text-gray-500">Por concepto de:</span>
                        <span className="text-gray-900 ml-2 font-medium">1 Sesión de Fotos</span>
                    </div>
                </div>
            </div>

            {/* Actividad Reciente */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Actividad Logística (Cross-Docking)</h3>
                    <button className="text-sm text-blue-900 font-medium hover:underline">Ver todas</button>
                </div>
                <div className="divide-y divide-gray-100">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 font-bold">
                                    OM
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Orden de Recolección #MZ-1004{item}</p>
                                    <p className="text-xs text-gray-500">Destino: Monterrey, NL (Cliente: Boutique Valeria)</p>
                                </div>
                            </div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                Pendiente de Empacar
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

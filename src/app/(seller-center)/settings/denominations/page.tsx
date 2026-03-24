"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    getDenominations,
    createDenomination,
    updateDenomination,
    deleteDenomination,
    seedDefaultDenominations,
} from "./actions";

export default function DenominationsPage() {
    const [dens, setDens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newLabel, setNewLabel] = useState("");
    const [newValue, setNewValue] = useState("");
    const [editId, setEditId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [editValue, setEditValue] = useState("");

    const load = async () => {
        setLoading(true);
        const data = await getDenominations();
        setDens(data);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleSeedDefaults = async () => {
        const res = await seedDefaultDenominations();
        if (res.success) { toast.success("Denominaciones MXN cargadas"); load(); }
    };

    const handleAdd = async () => {
        const label = newLabel.trim();
        const value = parseFloat(newValue);
        if (!label || isNaN(value) || value <= 0) {
            toast.error("Ingresa una etiqueta y un valor válido");
            return;
        }
        const res = await createDenomination(label, value);
        if (res.success) {
            toast.success("Denominación agregada");
            setNewLabel(""); setNewValue("");
            load();
        } else toast.error(res.error || "Error");
    };

    const handleUpdate = async (id: string) => {
        const label = editLabel.trim();
        const value = parseFloat(editValue);
        if (!label || isNaN(value)) return;
        const res = await updateDenomination(id, label, value);
        if (res.success) { toast.success("Actualizado"); setEditId(null); load(); }
        else toast.error(res.error || "Error");
    };

    const handleDelete = async (id: string, label: string) => {
        if (!confirm(`¿Eliminar denominación "${label}"?`)) return;
        const res = await deleteDenomination(id);
        if (res.success) { toast.success("Eliminada"); load(); }
        else toast.error(res.error || "Error");
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground">Denominaciones de Moneda</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Configura los billetes y monedas que usas. Se usan al abrir caja y en el Corte Z.
                    </p>
                </div>
                {dens.length === 0 && !loading && (
                    <button
                        onClick={handleSeedDefaults}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition"
                    >
                        Cargar MXN por defecto
                    </button>
                )}
            </div>

            {/* Lista de denominaciones */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                            <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-400">Denominación</th>
                            <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-400">Valor</th>
                            <th className="px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={3} className="text-center py-8 text-gray-400">Cargando...</td></tr>
                        ) : dens.length === 0 ? (
                            <tr><td colSpan={3} className="text-center py-8 text-gray-400">Sin denominaciones. Carga las de MXN o agrega manualmente.</td></tr>
                        ) : dens.map(den => (
                            <tr key={den.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                <td className="px-5 py-3">
                                    {editId === den.id ? (
                                        <input
                                            value={editLabel}
                                            onChange={e => setEditLabel(e.target.value)}
                                            className="px-3 py-1.5 border border-border rounded-lg text-sm font-bold w-28 bg-input text-foreground focus:ring-2 focus:ring-blue-500/50 outline-none"
                                        />
                                    ) : (
                                        <span className="font-black text-foreground">{den.label}</span>
                                    )}
                                </td>
                                <td className="px-5 py-3">
                                    {editId === den.id ? (
                                        <input
                                            type="number"
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            className="px-3 py-1.5 border border-border rounded-lg text-sm font-bold w-28 bg-input text-foreground focus:ring-2 focus:ring-blue-500/50 outline-none"
                                        />
                                    ) : (
                                        <span className="text-gray-600 dark:text-gray-400">{den.value.toFixed(2)}</span>
                                    )}
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                        {editId === den.id ? (
                                            <>
                                                <button onClick={() => handleUpdate(den.id)} className="text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-wide">Guardar</button>
                                                <button onClick={() => setEditId(null)} className="text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-wide">Cancelar</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => { setEditId(den.id); setEditLabel(den.label); setEditValue(den.value.toString()); }}
                                                    className="text-xs font-black text-blue-500 hover:text-blue-700 uppercase tracking-wide">Editar</button>
                                                <button onClick={() => handleDelete(den.id, den.label)}
                                                    className="text-xs font-black text-red-500 hover:text-red-700 uppercase tracking-wide">Borrar</button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Agregar nueva denominación */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Añadir Denominación</h2>
                <div className="flex gap-3 items-end">
                    <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Etiqueta</label>
                        <input
                            value={newLabel}
                            onChange={e => setNewLabel(e.target.value)}
                            placeholder="$500, ¢50..."
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm font-bold text-foreground placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/50 outline-none"
                        />
                    </div>
                    <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valor numérico</label>
                        <input
                            type="number"
                            value={newValue}
                            onChange={e => setNewValue(e.target.value)}
                            placeholder="500"
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-xl text-sm font-bold text-foreground placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/50 outline-none"
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs rounded-xl transition shadow-md"
                    >
                        + Agregar
                    </button>
                </div>
            </div>
        </div>
    );
}

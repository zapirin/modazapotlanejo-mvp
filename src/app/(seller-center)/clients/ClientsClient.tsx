"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { addStoreAccountPayment } from '../products/new/actions';
import { createClient, updateClient, deleteClient } from './actions';

export default function ClientsClient({ initialClients, paymentMethods }: { initialClients: any[], paymentMethods: string[] }) {
    const [clients, setClients] = useState(initialClients);
    const [searchTerm, setSearchTerm] = useState('');
    
    // New Client Modal
    const [showNewClient, setShowNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');

    // Edit Client Modal
    const [showEditClient, setShowEditClient] = useState(false);
    const [editClientId, setEditClientId] = useState('');
    const [editClientName, setEditClientName] = useState('');
    const [editClientPhone, setEditClientPhone] = useState('');
    const [editClientEmail, setEditClientEmail] = useState('');

    // Abono Modal
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [abonoAmount, setAbonoAmount] = useState('');
    const [abonoMethod, setAbonoMethod] = useState(paymentMethods[0] || 'Efectivo');
    const [isProcessing, setIsProcessing] = useState(false);

    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                                c.phone.includes(searchTerm) || 
                                                c.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientName) return;
        setIsProcessing(true);
        const res = await createClient({ name: newClientName, phone: newClientPhone, email: newClientEmail });
        setIsProcessing(false);
        if (res.success) {
            setClients([{...res.client, salesCount: 0}, ...clients]);
            setShowNewClient(false);
            setNewClientName('');
            setNewClientPhone('');
            setNewClientEmail('');
        } else {
            alert(res.error);
        }
    };

    const handleUpdateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editClientName || !editClientId) return;
        setIsProcessing(true);
        const res = await updateClient(editClientId, { name: editClientName, phone: editClientPhone, email: editClientEmail });
        setIsProcessing(false);
        if (res.success && res.client) {
            setClients(clients.map(c => c.id === editClientId ? { ...c, ...res.client } : c));
            setShowEditClient(false);
        } else {
            alert(res.error);
        }
    };

    const handleDeleteClient = async (clientId: string) => {
        if (!window.confirm("¿Seguro que deseas eliminar este cliente permanentemente?")) return;
        setIsProcessing(true);
        const res = await deleteClient(clientId);
        setIsProcessing(false);
        if (res.success) {
            setClients(clients.filter(c => c.id !== clientId));
            alert("Cliente eliminado.");
        } else {
            alert(res.error);
        }
    };

    const handleAbono = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient || !abonoAmount || !abonoMethod) return;
        
        const amount = parseFloat(abonoAmount);
        if (isNaN(amount) || amount <= 0) return alert("Monto inválido");

        setIsProcessing(true);
        const res = await addStoreAccountPayment(selectedClient.id, amount, abonoMethod);
        setIsProcessing(false);

        if (res.success) {
            alert(`Abono por $${amount} registrado a ${selectedClient.name}. Nuevo saldo global: $${(res.newBalance || 0).toFixed(2)}`);
            setClients(clients.map(c => c.id === selectedClient.id ? { ...c, storeCredit: res.newBalance || 0 } : c));
            setSelectedClient(null);
            setAbonoAmount('');
        } else {
            alert(res.error);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Directorio de Clientes</h1>
                    <p className="text-sm text-gray-500">Administra perfiles y créditos de tienda.</p>
                </div>
                <button 
                    onClick={() => setShowNewClient(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 flex items-center gap-2 rounded-xl font-bold transition shadow-sm"
                >
                    + Nuevo Cliente
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, teléfono o email..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 text-xs uppercase text-gray-500 font-semibold border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3">Cliente</th>
                                <th className="px-6 py-3">Contacto</th>
                                <th className="px-6 py-3 text-right">Saldo a Favor / Deuda</th>
                                <th className="px-6 py-3 text-center">Ventas Globales</th>
                                <th className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredClients.map((client) => (
                                <tr key={client.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 font-bold text-gray-900">{client.name}</td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {client.phone && <div>📞 {client.phone}</div>}
                                        {client.email && <div>✉️ {client.email}</div>}
                                        {(!client.phone && !client.email) && <span className="italic text-gray-400">Sin datos</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-black px-3 py-1 rounded-md ${
                                            client.storeCredit > 0 ? "text-green-700 bg-green-50" : 
                                            client.storeCredit < 0 ? "text-red-700 bg-red-50" : 
                                            "text-gray-500 bg-gray-50"
                                        }`}>
                                            ${client.storeCredit.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-medium text-gray-700">{client.salesCount}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 items-center">
                                            <button 
                                                onClick={() => setSelectedClient(client)}
                                                className="text-white font-bold bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg transition text-xs"
                                                title="Abonar a cuenta"
                                            >
                                                💰 Abonar
                                            </button>
                                            <Link 
                                                href={`/clients/${client.id}`}
                                                className="text-blue-600 border border-blue-600/30 hover:bg-blue-50 bg-white font-bold px-3 py-1.5 rounded-lg transition text-xs flex items-center gap-1"
                                                title="Historial"
                                            >
                                                Ver
                                            </Link>
                                            <button 
                                                onClick={() => {
                                                    setEditClientId(client.id);
                                                    setEditClientName(client.name);
                                                    setEditClientPhone(client.phone || '');
                                                    setEditClientEmail(client.email || '');
                                                    setShowEditClient(true);
                                                }}
                                                className="text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-2 py-1.5 rounded-lg transition text-xs"
                                                title="Editar Cliente"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteClient(client.id)}
                                                className="text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-2 py-1.5 rounded-lg transition text-xs"
                                                title="Borrar Cliente"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredClients.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No se encontraron clientes.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREACIÓN DE CLIENTE MODAL */}
            {showNewClient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <form onSubmit={handleCreateClient} className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold">Nuevo Cliente</h3>
                            <button type="button" onClick={() => setShowNewClient(false)} className="text-gray-400 hover:text-red-500">✕</button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nombre Comercial o Completo</label>
                                <input required autoFocus type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none transition" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Teléfono / WhatsApp (Opcional)</label>
                                <input type="tel" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none transition" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Email (Opcional)</label>
                                <input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none transition" />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <button type="submit" disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50">
                                {isProcessing ? 'Guardando...' : 'Crear Perfil'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* EDITAR CLIENTE MODAL */}
            {showEditClient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <form onSubmit={handleUpdateClient} className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold">Editar Cliente</h3>
                            <button type="button" onClick={() => setShowEditClient(false)} className="text-gray-400 hover:text-red-500">✕</button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nombre Comercial o Completo</label>
                                <input required autoFocus type="text" value={editClientName} onChange={e => setEditClientName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none transition" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Teléfono / WhatsApp</label>
                                <input type="tel" value={editClientPhone} onChange={e => setEditClientPhone(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none transition" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Email</label>
                                <input type="email" value={editClientEmail} onChange={e => setEditClientEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 outline-none transition" />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                            <button type="button" onClick={() => setShowEditClient(false)} className="flex-1 bg-white border border-gray-200 text-gray-600 font-bold py-3 rounded-xl transition hover:bg-gray-100">Cancelar</button>
                            <button type="submit" disabled={isProcessing} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50">
                                {isProcessing ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ABONO / CARGO MODAL */}
            {selectedClient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <form onSubmit={handleAbono} className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="font-bold text-lg">Cuenta: {selectedClient.name}</h3>
                                <p className="text-xs text-gray-500">
                                    Saldo actual: <span className={`font-black ${selectedClient.storeCredit < 0 ? 'text-red-600' : 'text-green-600'}`}>${selectedClient.storeCredit.toFixed(2)}</span>
                                </p>
                            </div>
                            <button type="button" onClick={() => setSelectedClient(null)} className="text-gray-400 hover:text-red-500 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                <p className="text-xs text-purple-800">
                                    Ingresa el monto que el cliente está abonando a su cuenta. Este monto **subirá** su saldo a favor (o reducirá su deuda).
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Monto del Abono</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">$</span>
                                    <input required type="number" step="0.01" min="0.01" value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} className="w-full pl-8 bg-white border border-gray-200 font-black text-xl rounded-xl px-4 py-3 focus:border-purple-500 outline-none shadow-sm transition" placeholder="0.00" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Método de Abono</label>
                                <select required value={abonoMethod} onChange={e => setAbonoMethod(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:border-purple-500 outline-none transition appearance-none">
                                    {paymentMethods.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 gap-2 flex">
                            <button type="button" onClick={() => setSelectedClient(null)} className="flex-1 bg-white border border-gray-200 text-gray-600 font-bold py-3 rounded-xl transition hover:bg-gray-100">Cancelar</button>
                            <button type="submit" disabled={isProcessing} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-purple-500/20 disabled:opacity-50">
                                {isProcessing ? 'Registrando...' : 'Confirmar Abono'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

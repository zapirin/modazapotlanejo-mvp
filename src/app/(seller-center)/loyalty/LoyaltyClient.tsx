"use client";

import { useState, useTransition } from "react";
import { saveProgram, adjustCustomerPoints, getCustomerHistory } from "./actions";

type Program = {
    id: string;
    sellerId: string;
    isActive: boolean;
    earnRate: number;
    redeemRate: number;
    minRedeemPoints: number;
} | null;

type Account = {
    id: string;
    balance: number;
    buyerId: string | null;
    posClientId: string | null;
    buyer: { id: string; name: string; email: string } | null;
    posClient: { id: string; name: string; email: string | null; phone: string | null } | null;
};

type Transaction = {
    id: string;
    type: string;
    points: number;
    amountMXN: number | null;
    reason: string | null;
    createdAt: string;
};

export default function LoyaltyClient({
    initialProgram,
    initialAccounts,
}: {
    initialProgram: Program;
    initialAccounts: Account[];
}) {
    const [program, setProgram] = useState<Program>(initialProgram);
    const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
    const [pending, startTransition] = useTransition();
    const [savedMsg, setSavedMsg] = useState<string | null>(null);

    // Form state for program
    const [isActive, setIsActive] = useState(program?.isActive ?? true);
    const [earnRate, setEarnRate] = useState(String(program?.earnRate ?? 10));
    const [redeemRate, setRedeemRate] = useState(String(program?.redeemRate ?? 10));
    const [minRedeem, setMinRedeem] = useState(String(program?.minRedeemPoints ?? 0));

    // Adjust modal
    const [adjustOpen, setAdjustOpen] = useState<Account | null>(null);
    const [adjustPts, setAdjustPts] = useState("");
    const [adjustReason, setAdjustReason] = useState("");
    const [adjustErr, setAdjustErr] = useState("");

    // History modal
    const [historyOpen, setHistoryOpen] = useState<Account | null>(null);
    const [history, setHistory] = useState<Transaction[]>([]);

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        const earn = parseFloat(earnRate);
        const redeem = parseFloat(redeemRate);
        const min = parseInt(minRedeem || "0", 10);
        if (!(earn > 0) || !(redeem > 0)) {
            setSavedMsg("Las tasas deben ser mayores a 0");
            return;
        }
        startTransition(async () => {
            const res = await saveProgram({
                isActive,
                earnRate: earn,
                redeemRate: redeem,
                minRedeemPoints: isNaN(min) ? 0 : min,
            });
            if (res.success) {
                setProgram(res.program as any);
                setSavedMsg("Guardado ✓");
                setTimeout(() => setSavedMsg(null), 2500);
            } else {
                setSavedMsg(res.error);
            }
        });
    }

    function openAdjust(acc: Account) {
        setAdjustOpen(acc);
        setAdjustPts("");
        setAdjustReason("");
        setAdjustErr("");
    }

    function submitAdjust() {
        if (!adjustOpen) return;
        const pts = parseInt(adjustPts, 10);
        if (!Number.isFinite(pts) || pts === 0) {
            setAdjustErr("Puntos inválidos");
            return;
        }
        if (!adjustReason.trim()) {
            setAdjustErr("Motivo es obligatorio");
            return;
        }
        startTransition(async () => {
            const res = await adjustCustomerPoints({
                buyerId: adjustOpen.buyerId,
                posClientId: adjustOpen.posClientId,
                points: pts,
                reason: adjustReason,
            });
            if (res.success) {
                setAccounts((prev) =>
                    prev.map((a) => (a.id === adjustOpen.id ? { ...a, balance: res.balance } : a))
                );
                setAdjustOpen(null);
            } else {
                setAdjustErr(res.error);
            }
        });
    }

    async function openHistory(acc: Account) {
        setHistoryOpen(acc);
        setHistory([]);
        const txns = await getCustomerHistory({
            buyerId: acc.buyerId,
            posClientId: acc.posClientId,
        });
        setHistory(txns as any);
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight">Programa de Puntos</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Configura cómo tus clientes acumulan y canjean puntos por compras.
                </p>
            </div>

            {/* Program config */}
            <form
                onSubmit={handleSave}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-5"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black">Configuración</h2>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span className="text-sm font-bold">Activo</span>
                    </label>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Acumulación
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm">$</span>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={earnRate}
                                onChange={(e) => setEarnRate(e.target.value)}
                                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent"
                            />
                            <span className="text-sm">= 1 punto</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Canje
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={redeemRate}
                                onChange={(e) => setRedeemRate(e.target.value)}
                                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent"
                            />
                            <span className="text-sm">puntos = $1</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Mínimo para canjear
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={minRedeem}
                                onChange={(e) => setMinRedeem(e.target.value)}
                                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent"
                            />
                            <span className="text-sm">puntos</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={pending}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm"
                    >
                        {pending ? "Guardando..." : "Guardar configuración"}
                    </button>
                    {savedMsg && <span className="text-sm font-bold text-gray-600">{savedMsg}</span>}
                </div>

                <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <strong>Ejemplo:</strong> Con tasa de $
                    {earnRate || "10"} = 1 punto y {redeemRate || "10"} puntos = $1, una compra de
                    $500 da {Math.floor(500 / (parseFloat(earnRate) || 10))} puntos, y{" "}
                    {parseFloat(redeemRate) > 0
                        ? Math.floor(100 / parseFloat(redeemRate))
                        : 0}{" "}
                    pesos de descuento por cada 100 puntos.
                </div>
            </form>

            {/* Accounts list */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-black">Saldos de Clientes</h2>
                    <p className="text-xs text-gray-500 mt-1">{accounts.length} cliente(s) con puntos</p>
                </div>
                {accounts.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-500">
                        Sin clientes con puntos aún.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs font-bold uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="text-left px-6 py-3">Cliente</th>
                                    <th className="text-left px-6 py-3">Tipo</th>
                                    <th className="text-right px-6 py-3">Saldo</th>
                                    <th className="text-right px-6 py-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                {accounts.map((acc) => {
                                    const customer = acc.buyer ?? acc.posClient;
                                    return (
                                        <tr key={acc.id}>
                                            <td className="px-6 py-3">
                                                <div className="font-bold">{customer?.name ?? "—"}</div>
                                                <div className="text-xs text-gray-500">
                                                    {customer?.email ?? (acc.posClient?.phone ?? "")}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span
                                                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded ${
                                                        acc.buyerId
                                                            ? "bg-blue-100 text-blue-700"
                                                            : "bg-purple-100 text-purple-700"
                                                    }`}
                                                >
                                                    {acc.buyerId ? "Marketplace" : "POS"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right font-black">
                                                {acc.balance.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <button
                                                    onClick={() => openHistory(acc)}
                                                    className="text-xs font-bold text-gray-600 hover:text-gray-900 mr-3"
                                                >
                                                    Historial
                                                </button>
                                                <button
                                                    onClick={() => openAdjust(acc)}
                                                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                                                >
                                                    Ajustar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Adjust modal */}
            {adjustOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
                    onClick={() => setAdjustOpen(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-black mb-1">Ajustar puntos</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {(adjustOpen.buyer ?? adjustOpen.posClient)?.name} · Saldo actual:{" "}
                            <strong>{adjustOpen.balance}</strong>
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">
                                    Puntos (positivo crédito, negativo débito)
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    value={adjustPts}
                                    onChange={(e) => setAdjustPts(e.target.value)}
                                    placeholder="Ej: 50 ó -30"
                                    className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">
                                    Motivo
                                </label>
                                <input
                                    type="text"
                                    value={adjustReason}
                                    onChange={(e) => setAdjustReason(e.target.value)}
                                    placeholder="Ej: Compensación por error de envío"
                                    className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent"
                                />
                            </div>
                            {adjustErr && (
                                <p className="text-xs font-bold text-red-600">{adjustErr}</p>
                            )}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setAdjustOpen(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={submitAdjust}
                                    disabled={pending}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm"
                                >
                                    {pending ? "Aplicando..." : "Aplicar"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History modal */}
            {historyOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
                    onClick={() => setHistoryOpen(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-black">Historial</h3>
                                <p className="text-sm text-gray-500">
                                    {(historyOpen.buyer ?? historyOpen.posClient)?.name}
                                </p>
                            </div>
                            <button
                                onClick={() => setHistoryOpen(null)}
                                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="overflow-y-auto">
                            {history.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-8">Sin movimientos</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                        <tr>
                                            <th className="text-left py-2">Fecha</th>
                                            <th className="text-left py-2">Tipo</th>
                                            <th className="text-right py-2">Puntos</th>
                                            <th className="text-left py-2 pl-4">Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {history.map((t) => (
                                            <tr key={t.id}>
                                                <td className="py-2 text-xs text-gray-500">
                                                    {new Date(t.createdAt).toLocaleDateString("es-MX", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </td>
                                                <td className="py-2">
                                                    <span
                                                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                                                            t.type === "EARN"
                                                                ? "bg-green-100 text-green-700"
                                                                : t.type === "REDEEM"
                                                                ? "bg-orange-100 text-orange-700"
                                                                : "bg-gray-100 text-gray-700"
                                                        }`}
                                                    >
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td
                                                    className={`py-2 text-right font-black ${
                                                        t.points > 0 ? "text-green-600" : "text-orange-600"
                                                    }`}
                                                >
                                                    {t.points > 0 ? "+" : ""}
                                                    {t.points}
                                                </td>
                                                <td className="py-2 pl-4 text-xs text-gray-600">
                                                    {t.amountMXN ? `Compra $${t.amountMXN.toFixed(2)}` : ""}
                                                    {t.reason ? t.reason : ""}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

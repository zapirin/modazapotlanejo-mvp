"use client";

import Link from "next/link";
import { useState } from "react";

type Transaction = {
    id: string;
    type: string;
    points: number;
    amountMXN: number | null;
    reason: string | null;
    createdAt: string | Date;
};

type Account = {
    id: string;
    sellerId: string;
    balance: number;
    seller: {
        id: string;
        name: string;
        businessName: string | null;
        logoUrl: string | null;
        sellerSlug: string | null;
    };
    transactions: Transaction[];
};

export default function LoyaltyAccountClient({ accounts }: { accounts: Account[] }) {
    const [openId, setOpenId] = useState<string | null>(null);
    const totalPoints = accounts.reduce((s, a) => s + a.balance, 0);

    if (accounts.length === 0) {
        return (
            <div className="text-center py-20">
                <h1 className="text-3xl font-black mb-2">Mis Puntos</h1>
                <p className="text-gray-500">
                    Aún no tienes puntos en ninguna tienda. Compra en tiendas con programa de puntos para empezar a acumular.
                </p>
                <Link
                    href="/vendors"
                    className="inline-block mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm"
                >
                    Ver tiendas
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight">Mis Puntos</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Tienes <strong>{totalPoints.toLocaleString()}</strong> puntos repartidos en {accounts.length} tienda
                    {accounts.length === 1 ? "" : "s"}.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                {accounts.map((acc) => {
                    const storeName = acc.seller.businessName || acc.seller.name;
                    const isOpen = openId === acc.id;
                    return (
                        <div
                            key={acc.id}
                            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                        >
                            <div className="p-5 flex items-center gap-4">
                                {acc.seller.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={acc.seller.logoUrl}
                                        alt={storeName}
                                        className="w-12 h-12 rounded-xl object-contain bg-gray-50 dark:bg-gray-800"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg font-black">
                                        {storeName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-black truncate">{storeName}</p>
                                    <p className="text-xs text-gray-500">{acc.transactions.length} movimiento{acc.transactions.length === 1 ? "" : "s"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-amber-600">{acc.balance.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">puntos</p>
                                </div>
                            </div>
                            <div className="px-5 pb-3 flex gap-2">
                                {acc.seller.sellerSlug && (
                                    <Link
                                        href={`/vendor/${acc.seller.sellerSlug}`}
                                        className="flex-1 text-center px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        Ir a tienda
                                    </Link>
                                )}
                                <button
                                    onClick={() => setOpenId(isOpen ? null : acc.id)}
                                    className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 hover:bg-amber-100"
                                >
                                    {isOpen ? "Ocultar historial" : "Ver historial"}
                                </button>
                            </div>
                            {isOpen && (
                                <div className="border-t border-gray-200 dark:border-gray-800 max-h-80 overflow-y-auto">
                                    {acc.transactions.length === 0 ? (
                                        <p className="p-5 text-center text-sm text-gray-500">Sin movimientos.</p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-800/50 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                                <tr>
                                                    <th className="text-left px-4 py-2">Fecha</th>
                                                    <th className="text-left px-4 py-2">Tipo</th>
                                                    <th className="text-right px-4 py-2">Puntos</th>
                                                    <th className="text-left px-4 py-2">Detalle</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {acc.transactions.map((t) => (
                                                    <tr key={t.id}>
                                                        <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                                                            {new Date(t.createdAt).toLocaleDateString("es-MX", {
                                                                day: "numeric",
                                                                month: "short",
                                                                year: "numeric",
                                                            })}
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <span
                                                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                                                    t.type === "EARN"
                                                                        ? "bg-green-100 text-green-700"
                                                                        : t.type === "REDEEM"
                                                                        ? "bg-orange-100 text-orange-700"
                                                                        : "bg-gray-100 text-gray-700"
                                                                }`}
                                                            >
                                                                {t.type === "EARN" ? "Ganados" : t.type === "REDEEM" ? "Canjeados" : "Ajuste"}
                                                            </span>
                                                        </td>
                                                        <td
                                                            className={`px-4 py-2 text-right font-black ${
                                                                t.points > 0 ? "text-green-600" : "text-orange-600"
                                                            }`}
                                                        >
                                                            {t.points > 0 ? "+" : ""}
                                                            {t.points}
                                                        </td>
                                                        <td className="px-4 py-2 text-xs text-gray-600">
                                                            {t.amountMXN ? `Compra $${t.amountMXN.toFixed(2)}` : ""}
                                                            {t.reason || ""}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

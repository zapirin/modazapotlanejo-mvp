"use client";

export default function PrintButton() {
    return (
        <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
        >
            🖨️ Imprimir Catálogo
        </button>
    );
}

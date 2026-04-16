"use client";

import { useEffect, useRef, useState } from 'react';

interface BarcodePrintModalProps {
    products: any[];
    onClose: () => void;
}

type CodeType = 'code128' | 'qr';

interface VariantRow {
    key: string;          // unique key
    productName: string;
    barcodeValue: string; // editable
    attrs: string;        // "Color: Rojo / Talla: M"
    price: string;
    color: string;
    size: string;
    copies: number;
}

/* ─── Construye filas de variantes ──────────────────────────────── */
function buildRows(products: any[]): VariantRow[] {
    const rows: VariantRow[] = [];
    for (const p of products) {
        const baseSku = p.sku || p.id.slice(-8).toUpperCase();
        const price = `$${(p.promotionalPrice || p.price || 0).toFixed(2)}`;
        if (p.variants && p.variants.length > 0) {
            // Sort by the order defined in variantOptions (preserves CH→MED→GDE→XL, 1→3→5→7, etc.)
            const varOpts: any[] = Array.isArray(p.variantOptions) ? p.variantOptions : [];
            const getSortKey = (v: any): string => {
                if (!varOpts.length) return v.id || '';   // fallback: CUID creation order
                return varOpts.map((opt: any) => {
                    const val = (v.attributes?.[opt.name] ?? v.color ?? v.size ?? '') as string;
                    const idx = (opt.values as string[]).indexOf(val);
                    return idx >= 0 ? String(idx).padStart(4, '0') : '9999';
                }).join('-');
            };
            const sortedVariants = [...p.variants].sort((a: any, b: any) =>
                getSortKey(a).localeCompare(getSortKey(b))
            );
            sortedVariants.forEach((v: any, i: number) => {
                const parts = [v.color && `Color: ${v.color}`, v.size && `Talla: ${v.size}`].filter(Boolean);
                const suffix = [v.color?.slice(0,2).toUpperCase(), v.size?.replace(/\s/g,'').slice(0,3).toUpperCase()].filter(Boolean).join('');
                rows.push({
                    key: `${p.id}-${v.id || i}`,
                    productName: p.name,
                    barcodeValue: v.sku || (suffix ? `${baseSku}-${suffix}` : baseSku),
                    attrs: parts.join(' / ') || 'Sin atributos',
                    price,
                    color: v.color || '',
                    size:  v.size  || '',
                    copies: 1,
                });
            });
        } else {
            rows.push({
                key: p.id,
                productName: p.name,
                barcodeValue: baseSku,
                attrs: 'Sin atributos',
                price,
                color: '',
                size: '',
                copies: 1,
            });
        }
    }
    return rows;
}

/* ─── Mini preview de una etiqueta (2"×1" = 192×96 px @ 96dpi) ─ */
function LabelPreview({ row, codeType, showName, showPrice, showColor, showSize }: {
    row: VariantRow; codeType: CodeType;
    showName: boolean; showPrice: boolean; showColor: boolean; showSize: boolean;
}) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [qrUrl, setQrUrl] = useState('');

    useEffect(() => {
        if (!row.barcodeValue) return;
        if (codeType === 'code128') {
            setQrUrl('');
            import('jsbarcode').then(({ default: JsBarcode }) => {
                if (svgRef.current) {
                    try {
                        JsBarcode(svgRef.current, row.barcodeValue, {
                            format: 'CODE128', width: 1.8, height: 38,
                            displayValue: false, margin: 0, background: 'transparent',
                        });
                    } catch { /* valor inválido */ }
                }
            });
        } else {
            import('qrcode').then(({ default: QRCode }) => {
                QRCode.toDataURL(row.barcodeValue || ' ', { width: 120, margin: 1 }).then(setQrUrl);
            });
        }
    }, [row.barcodeValue, codeType]);

    const hasInfo = showName || showPrice || showColor || showSize;

    /* ── Code 128: barras arriba, info abajo ── */
    if (codeType === 'code128') {
        return (
            <div className="flex flex-col border border-gray-300 bg-white overflow-hidden rounded" style={{ width: 192, height: 96 }}>
                {/* Barras — ocupa todo el ancho, margen mínimo */}
                <div className="flex items-center justify-center" style={{ paddingTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                    <svg ref={svgRef} style={{ width: '100%', height: hasInfo ? 46 : 72, display: 'block' }} />
                </div>
                {/* SKU siempre visible bajo las barras */}
                <p style={{ fontSize: 6, fontFamily: 'monospace', color: '#333', textAlign: 'center', lineHeight: 1, paddingBottom: hasInfo ? 0 : 3 }}>
                    {row.barcodeValue}
                </p>
                {/* Info opcional */}
                {hasInfo && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '1px 5px 3px', flexWrap: 'wrap' }}>
                        {showName  && <span style={{ fontSize: Math.max(5, Math.min(7, Math.floor(60 / (row.productName.length || 1) * 2))), fontWeight: 700, color: '#000', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{row.productName}</span>}
                        {(showColor || showSize) && <span style={{ fontSize: 6, color: '#555', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{[showColor && row.color, showSize && row.size].filter(Boolean).join(' / ')}</span>}
                        {showPrice && <span style={{ fontSize: 8, fontWeight: 900, color: '#000', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{row.price}</span>}
                    </div>
                )}
            </div>
        );
    }

    /* ── QR: lado a lado (ya estaba bien) ── */
    const qrSize = hasInfo ? 78 : 184;
    return (
        <div className="flex border border-gray-300 bg-white overflow-hidden rounded" style={{ width: 192, height: 96 }}>
            <div className="flex items-center justify-center shrink-0" style={{ width: qrSize, padding: 4 }}>
                {qrUrl && <img src={qrUrl} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            </div>
            {hasInfo && (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', flex: 1, overflow: 'hidden', paddingLeft: 3, paddingRight: 4, gap: 2 }}>
                    {showName  && <p style={{ margin: 0, fontSize: Math.max(5, Math.min(8, Math.floor(55 / (row.productName.length || 1) * 2))), fontWeight: 700, color: '#000', lineHeight: 1.1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{row.productName}</p>}
                    {(showColor || showSize) && <p style={{ margin: 0, fontSize: 6, color: '#555', lineHeight: 1.1 }}>{[showColor && row.color, showSize && row.size].filter(Boolean).join(' / ')}</p>}
                    {showPrice && <p style={{ margin: 0, fontSize: 9, fontWeight: 900, color: '#000', lineHeight: 1.1 }}>{row.price}</p>}
                    <p style={{ margin: 0, fontSize: 5, fontFamily: 'monospace', color: '#888', lineHeight: 1, wordBreak: 'break-all' }}>{row.barcodeValue}</p>
                </div>
            )}
        </div>
    );
}

/* ─── Modal principal ─────────────────────────────────────────── */
export default function BarcodePrintModal({ products, onClose }: BarcodePrintModalProps) {
    const [codeType,  setCodeType]  = useState<CodeType>('code128');
    const [rows, setRows] = useState<VariantRow[]>(() => buildRows(products));
    const hasColorAttr = rows.some(r => r.color !== '');
    const hasSizeAttr  = rows.some(r => r.size  !== '');
    const [showName,  setShowName]  = useState(true);
    const [showPrice, setShowPrice] = useState(true);
    const [showColor, setShowColor] = useState(hasColorAttr);
    const [showSize,  setShowSize]  = useState(hasSizeAttr);
    const [printing, setPrinting] = useState(false);
    const [previewIdx, setPreviewIdx] = useState(0);

    const totalLabels = rows.reduce((s, r) => s + r.copies, 0);

    const updateRow = (key: string, field: keyof VariantRow, value: any) =>
        setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));

    const setAllCopies = (n: number) =>
        setRows(prev => prev.map(r => ({ ...r, copies: Math.max(1, n) })));

    /* ─── Print ───────────────────────────────────────────── */
    const handlePrint = async () => {
        setPrinting(true);
        try {
            const labelsHtml: string[] = [];
            const hasInfo = showName || showPrice || showColor || showSize;

            for (const row of rows) {
                if (row.copies < 1 || !row.barcodeValue) continue;

                let codeHtml = '';
                if (codeType === 'code128') {
                    const JsBarcode = (await import('jsbarcode')).default;
                    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    try { JsBarcode(svgEl, row.barcodeValue, { format: 'CODE128', width: 1.8, height: 40, displayValue: false, margin: 0, background: 'transparent' }); } catch { /* skip */ }
                    // Code128: barras + SKU arriba, info abajo
                    const infoHtml128 = hasInfo ? `<div class="info">
                        ${showName  ? `<span class="name">${row.productName}</span>` : ''}
                        ${(showColor || showSize) ? `<span class="attrs">${[showColor && row.color, showSize && row.size].filter(Boolean).join(' / ')}</span>` : ''}
                        ${showPrice ? `<span class="price">${row.price}</span>` : ''}
                    </div>` : '';
                    codeHtml = `<div class="code128">${svgEl.outerHTML}<p class="sku">${row.barcodeValue}</p></div>${infoHtml128}`;
                } else {
                    const QRCode = (await import('qrcode')).default;
                    const url = await QRCode.toDataURL(row.barcodeValue, { width: 120, margin: 1 });
                    const infoHtmlQr = hasInfo ? `<div class="info">
                        ${showName  ? `<p class="name">${row.productName}</p>` : ''}
                        ${(showColor || showSize) ? `<p class="attrs">${[showColor && row.color, showSize && row.size].filter(Boolean).join(' / ')}</p>` : ''}
                        ${showPrice ? `<p class="price">${row.price}</p>` : ''}
                        <p class="sku">${row.barcodeValue}</p>
                    </div>` : '';
                    codeHtml = `<div class="qr"><img src="${url}" /></div>${infoHtmlQr}`;
                }

                const labelHtml = `<div class="label ${codeType} ${hasInfo ? 'has-info' : 'no-info'}">${codeHtml}</div>`;
                for (let i = 0; i < row.copies; i++) labelsHtml.push(labelHtml);
            }

            const w = window.open('', '_blank', 'width=900,height=700');
            if (!w) { alert('Permite ventanas emergentes para imprimir'); setPrinting(false); return; }

            w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:2in 1in;margin:0}
body{background:white}
/* ── Común ── */
.label{width:2in;height:1in;overflow:hidden;page-break-after:always;break-after:page}

/* ── Code 128: columna — barras arriba, info abajo ── */
.label.code128{display:flex;flex-direction:column}
.label.code128 .code128{display:flex;flex-direction:column;align-items:center;padding:3px 4px 0}
.label.code128 .code128 svg{width:100%;height:auto;display:block}
.label.code128.has-info .code128 svg{max-height:0.46in}
.label.code128.no-info  .code128 svg{max-height:0.76in}
.label.code128 .sku{text-align:center;font-family:monospace;font-size:5.5pt;color:#333;line-height:1;padding:0 4px}
.label.code128 .info{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px;padding:1px 5px 3px}

/* ── QR: fila — QR izquierda, info derecha ── */
.label.qr{display:flex;align-items:center}
.label.qr.has-info .qr{width:0.9in;padding:3px;display:flex;align-items:center;justify-content:center}
.label.qr.has-info .qr img{width:100%;height:100%;object-fit:contain}
.label.qr.no-info  .qr{width:100%;padding:4px;display:flex;align-items:center;justify-content:center}
.label.qr.no-info  .qr img{max-width:0.88in;max-height:0.88in;object-fit:contain}
.label.qr .info{flex:1;display:flex;flex-direction:column;justify-content:center;gap:1px;padding-right:3px;overflow:hidden}

/* ── Tipografía ── */
.sku  {font-family:monospace;font-size:5.5pt;color:#333;line-height:1.1;word-break:break-all}
.name {font-size:7pt;font-weight:700;color:#000;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.attrs{font-size:6pt;color:#555;line-height:1.1;white-space:nowrap}
.price{font-size:9pt;font-weight:900;color:#000;line-height:1.1;white-space:nowrap}
</style></head><body>
${labelsHtml.join('')}
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
            w.document.close();
        } finally { setPrinting(false); }
    };

    const previewRow = rows[previewIdx] ?? rows[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl border border-border flex flex-col animate-in zoom-in-95 duration-200 max-h-[92vh]">

                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-foreground">Imprimir Etiquetas</h3>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">2&quot; × 1&quot; · Zebra y compatibles</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 transition flex items-center justify-center font-bold text-gray-500">×</button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-5">

                    {/* Tipo + campos — fila compacta */}
                    <div className="flex flex-wrap gap-4 items-start">
                        {/* Tipo de código */}
                        <div className="shrink-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Tipo</p>
                            <div className="flex gap-2">
                                {(['code128', 'qr'] as CodeType[]).map(t => (
                                    <button key={t} onClick={() => setCodeType(t)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition ${codeType === t ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700' : 'border-border text-gray-500 hover:border-gray-300'}`}>
                                        {t === 'code128' ? '▐▌▌ Code 128' : '⊞ QR Code'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Campos opcionales */}
                        <div className="flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Campos opcionales</p>
                            <div className="flex flex-wrap gap-2">
                                {([
                                    ['showName',  'Nombre',  showName,  setShowName],
                                    ['showPrice', 'Precio',  showPrice, setShowPrice],
                                    ...(hasColorAttr ? [['showColor', 'Color', showColor, setShowColor]] : []),
                                    ...(hasSizeAttr  ? [['showSize',  'Talla', showSize,  setShowSize]]  : []),
                                ] as [string, string, boolean, (v:boolean)=>void][]).map(([key, label, val, setter]) => (
                                    <label key={key} className="flex items-center gap-1.5 cursor-pointer bg-gray-100 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                                        <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600" />
                                        <span className="text-xs font-bold text-foreground">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tabla de variantes */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Variantes y cantidades</p>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 font-bold">Todas:</span>
                                <button onClick={() => setAllCopies(1)} className="px-2 py-0.5 text-[10px] font-black bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition">1</button>
                                <button onClick={() => setAllCopies(2)} className="px-2 py-0.5 text-[10px] font-black bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition">2</button>
                                <button onClick={() => setAllCopies(3)} className="px-2 py-0.5 text-[10px] font-black bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition">3</button>
                            </div>
                        </div>
                        <div className="border border-border rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-[42%]">Código de barras</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Atributos</th>
                                        <th className="px-3 py-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-20">Copias</th>
                                        <th className="px-3 py-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">Preview</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {rows.map((row, idx) => (
                                        <tr key={row.key} className={`transition-colors ${previewIdx === idx ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'}`}>
                                            <td className="px-3 py-2">
                                                <p className="text-[10px] text-gray-400 font-medium mb-0.5 truncate">{row.productName}</p>
                                                <input
                                                    type="text"
                                                    value={row.barcodeValue}
                                                    onChange={e => updateRow(row.key, 'barcodeValue', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs font-mono font-bold border border-border rounded-lg bg-white dark:bg-gray-900 text-foreground outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                                                    placeholder="Código…"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
                                                {row.attrs}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => updateRow(row.key, 'copies', Math.max(0, row.copies - 1))}
                                                        className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 font-black text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center leading-none">−</button>
                                                    <input
                                                        type="number" min={0} max={99}
                                                        value={row.copies}
                                                        onChange={e => updateRow(row.key, 'copies', Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                                                        className="w-10 text-center text-sm font-black border border-border rounded-lg py-0.5 bg-input text-foreground outline-none focus:border-blue-500"
                                                    />
                                                    <button onClick={() => updateRow(row.key, 'copies', Math.min(99, row.copies + 1))}
                                                        className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 font-black text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center leading-none">+</button>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <button onClick={() => setPreviewIdx(idx)}
                                                    className={`text-[10px] font-black px-2 py-1 rounded-lg transition ${previewIdx === idx ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'}`}>
                                                    Ver
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Vista previa */}
                    {previewRow && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                Vista previa — {previewRow.productName} · {previewRow.attrs}
                            </p>
                            <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-2xl py-6">
                                <LabelPreview row={previewRow} codeType={codeType}
                                    showName={showName} showPrice={showPrice}
                                    showColor={showColor} showSize={showSize} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border bg-gray-50/50 dark:bg-gray-900/50 shrink-0 flex items-center justify-between gap-4">
                    <p className="text-sm text-gray-500 font-bold">
                        <span className="text-foreground font-black text-lg">{totalLabels}</span> etiqueta{totalLabels !== 1 ? 's' : ''} en total
                    </p>
                    <button
                        onClick={handlePrint}
                        disabled={printing || totalLabels === 0}
                        className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black uppercase tracking-widest text-sm hover:opacity-80 transition disabled:opacity-40 flex items-center gap-2"
                    >
                        {printing
                            ? <><span className="w-4 h-4 border-2 border-white/30 dark:border-gray-900/30 border-t-white dark:border-t-gray-900 rounded-full animate-spin" /> Generando...</>
                            : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg> Imprimir {totalLabels} etiqueta{totalLabels !== 1 ? 's' : ''}</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

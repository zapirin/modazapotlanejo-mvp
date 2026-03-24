import { NextRequest, NextResponse } from 'next/server';
import { processSale } from '@/app/(seller-center)/products/new/actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sales } = body as { sales: { localId: string; data: any }[] };

        if (!sales || !Array.isArray(sales)) {
            return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
        }

        const results: { localId: string; success: boolean; error?: string }[] = [];

        for (const sale of sales) {
            try {
                const res = await processSale(sale.data);
                results.push({
                    localId: sale.localId,
                    success: res.success,
                    error: res.success ? undefined : (res.error || 'Error al procesar'),
                });
            } catch (err: any) {
                results.push({
                    localId: sale.localId,
                    success: false,
                    error: err.message || 'Error desconocido',
                });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

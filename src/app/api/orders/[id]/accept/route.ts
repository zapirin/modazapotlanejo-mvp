import { updateOrderStatus } from '@/app/actions/orders';
import { redirect } from 'next/navigation';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
    await updateOrderStatus(resolvedParams.id, 'ACCEPTED');
    redirect('/orders');
}

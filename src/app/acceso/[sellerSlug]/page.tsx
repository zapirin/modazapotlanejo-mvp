import { getSellerBySlug, checkExistingSession } from './actions';
import POSLoginClient from './POSLoginClient';
import { notFound, redirect } from 'next/navigation';

export default async function POSLoginPage({
    params,
}: {
    params: { sellerSlug: string };
}) {
    const { sellerSlug } = await params;
    const seller = await getSellerBySlug(sellerSlug);
    if (!seller) notFound();

    // Si ya hay sesión activa válida para esta tienda, ir directo al POS
    const hasSession = await checkExistingSession(seller.id);
    if (hasSession) redirect('/pos');

    return <POSLoginClient seller={seller} sellerSlug={sellerSlug} />;
}

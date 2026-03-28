import { getMarketplaceSettings } from "@/app/actions/marketplace";
import MarketplaceClient from "./MarketplaceClient";
import { getSessionUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function AdminMarketplacePage() {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
        redirect('/login?error=not_authorized');
    }

    const res = await getMarketplaceSettings();
    if (!res.success) {
        return <div className="p-10 text-red-500 font-bold">Error al cargar configuración: {res.error}</div>;
    }

    return (
        <div className="p-6 lg:p-10">
            <MarketplaceClient initialSettings={res.data} />
        </div>
    );
}

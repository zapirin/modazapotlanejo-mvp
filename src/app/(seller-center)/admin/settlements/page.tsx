import { getPendingSettlements } from "@/app/actions/settlements";
import SettlementsClient from "./SettlementsClient";

export default async function AdminSettlementsPage() {
    const pendingSettlements = await getPendingSettlements();

    return (
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
            <SettlementsClient initialData={pendingSettlements} />
        </div>
    );
}

import { getSellerBalance, getSellerSettlements } from "@/app/actions/settlements";
import EarningsClient from "./EarningsClient";
import { getSessionUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function SellerEarningsPage() {
    const user = await getSessionUser();
    if (!user || user.role !== 'SELLER') {
        redirect("/login");
    }

    const [balance, settlements] = await Promise.all([
        getSellerBalance(),
        getSellerSettlements(user.id)
    ]);

    return (
        <div className="p-6 lg:p-10">
            <EarningsClient 
                balance={balance} 
                settlements={settlements} 
            />
        </div>
    );
}

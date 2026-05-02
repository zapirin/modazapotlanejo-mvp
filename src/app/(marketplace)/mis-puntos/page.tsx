import { getSessionUser } from "@/app/actions/auth";
import { getMyLoyalty } from "@/app/actions/loyalty";
import { redirect } from "next/navigation";
import LoyaltyAccountClient from "./LoyaltyAccountClient";

export default async function MisPuntosPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    if (user.role !== "BUYER") redirect("/");
    const { accounts } = await getMyLoyalty();
    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <LoyaltyAccountClient accounts={accounts} />
        </div>
    );
}

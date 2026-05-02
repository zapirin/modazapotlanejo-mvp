import { getSessionUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { getLoyaltyData } from "./actions";
import LoyaltyClient from "./LoyaltyClient";

export default async function LoyaltyPage() {
    const user = await getSessionUser();
    if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
        redirect("/dashboard");
    }
    const { program, accounts } = await getLoyaltyData();
    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto">
            <LoyaltyClient initialProgram={program} initialAccounts={accounts} />
        </div>
    );
}

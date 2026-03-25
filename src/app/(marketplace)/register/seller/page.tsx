import { getPlans } from '@/app/actions/marketplace';
import SellerRegistrationForm from './SellerRegistrationForm';

export default async function SellerRegistrationPage() {
    const plans = await getPlans();
    return <SellerRegistrationForm plans={plans as any[]} />;
}

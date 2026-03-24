import React from 'react';
import { getSellers } from '@/app/actions/admin';
import CostsClient from './CostsClient';

export default async function AdminCostsPage() {
    const sellers = await getSellers();

    return (
        <CostsClient initialSellers={sellers} />
    );
}

import { prisma } from '@/lib/prisma';
import ApplicationsClient from './ApplicationsClient';

export default async function ApplicationsPage() {
    const applications = await prisma.sellerApplication.findMany({
        orderBy: { createdAt: 'desc' }
    });

    return <ApplicationsClient initialApplications={applications} />;
}

import ClientHistoryClient from "./ClientHistoryClient";

export const dynamic = 'force-dynamic';

export default function ClientHistoryPage({ params }: { params: { id: string } }) {
    return (
        <ClientHistoryClient clientId={params.id} />
    );
}

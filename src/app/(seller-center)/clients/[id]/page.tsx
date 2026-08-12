import ClientHistoryClient from "./ClientHistoryClient";

export const dynamic = 'force-dynamic';

// En Next.js 15+ `params` es una promesa: hay que esperarla. Leerla de forma
// síncrona devuelve undefined y la pantalla acaba mostrando otro cliente.
export default async function ClientHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <ClientHistoryClient clientId={id} />
    );
}

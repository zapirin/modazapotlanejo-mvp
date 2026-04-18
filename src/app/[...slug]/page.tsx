import { redirect, notFound } from 'next/navigation';

export default async function CatchAll({ params }: { params: Promise<{ slug: string[] }> }) {
    // Let Next.js serve static files (.html, .txt, .xml, etc.) from public/
    const { slug } = await params;
    const last = slug[slug.length - 1] || '';
    if (last.includes('.')) notFound();
    redirect('/');
}

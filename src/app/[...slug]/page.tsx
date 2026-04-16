import { redirect, notFound } from 'next/navigation';

export default function CatchAll({ params }: { params: { slug: string[] } }) {
    // Let Next.js serve static files (.html, .txt, .xml, etc.) from public/
    const last = params.slug[params.slug.length - 1] || '';
    if (last.includes('.')) notFound();
    redirect('/');
}

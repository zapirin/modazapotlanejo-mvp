import React from 'react';
import { headers } from 'next/headers';
import { getSessionUser } from '../actions/auth';
import { getBrandConfig } from '@/lib/brand';
import SidebarLayout from './SidebarLayout';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get('host');
  const brand = getBrandConfig(host);
  return {
    title: { default: brand.name, template: `%s — ${brand.name}` },
  };
}

export default async function SellerCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  const headersList = await headers();
  const host = headersList.get('host');
  const brand = getBrandConfig(host);

  // Si es cajero, obtener info del vendedor para el sidebar
  let sellerInfo = null;
  if (user?.role === 'CASHIER' && (user as any).managedBySellerId) {
    const { prisma } = await import('@/lib/prisma');
    sellerInfo = await (prisma.user as any).findUnique({
      where: { id: (user as any).managedBySellerId },
      select: { name: true, businessName: true, logoUrl: true, registeredDomain: true }
    });
  }

  if (!user) {
    // If we have a cookie but user isn't in DB, they are stuck.
    // We redirect to login with a special parameter to indicate session issues.
    redirect('/login?error=session_expired');
  }

  if (!(user as any).isActive && user.role !== 'ADMIN') {
    redirect('/login?error=account_suspended');
  }

  return (
    <SidebarLayout user={user} sellerInfo={sellerInfo} brand={brand}>
      {children}
    </SidebarLayout>
  );
}

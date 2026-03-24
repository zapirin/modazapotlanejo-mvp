import React from 'react';
import { getSessionUser } from '../actions/auth';
import SidebarLayout from './SidebarLayout';
import { redirect } from 'next/navigation';

export default async function SellerCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    // If we have a cookie but user isn't in DB, they are stuck.
    // We redirect to login with a special parameter to indicate session issues.
    redirect('/login?error=session_expired');
  }

  if (!(user as any).isActive && user.role !== 'ADMIN') {
    redirect('/login?error=account_suspended');
  }

  return (
    <SidebarLayout user={user}>
      {children}
    </SidebarLayout>
  );
}

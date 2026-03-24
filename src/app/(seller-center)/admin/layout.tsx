import React from 'react';
import { getSessionUser } from '../../actions/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user || user.role !== 'ADMIN') {
    redirect('/login?error=not_authorized');
  }

  return (
    <>
      {children}
    </>
  );
}

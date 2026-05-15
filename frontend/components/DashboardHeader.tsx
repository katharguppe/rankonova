'use client';

import { NotificationBell } from './NotificationBell';

export interface DashboardHeaderProps {
  clientId: string;
}

export function DashboardHeader({ clientId }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-end px-4 md:px-8 py-4 bg-white border-b border-slate-200">
      <NotificationBell clientId={clientId} />
    </header>
  );
}

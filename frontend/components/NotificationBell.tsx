'use client';

import { Bell } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';

interface NotificationBellProps {
  clientId: string;
  unreadCount: number;
  isOpen: boolean;
  onToggle: () => void;
  onMarkReadComplete: () => void;
}

export function NotificationBell({
  clientId,
  unreadCount,
  isOpen,
  onToggle,
  onMarkReadComplete,
}: NotificationBellProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Bell size={18} className="text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          clientId={clientId}
          onClose={onToggle}
          onMarkRead={onMarkReadComplete}
        />
      )}
    </div>
  );
}

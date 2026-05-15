'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { fetchUnreadCount } from '@/lib/services/notifications';
import { NotificationDropdown } from './NotificationDropdown';

export interface NotificationBellProps {
  clientId: string;
}

export function NotificationBell({ clientId }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count = await fetchUnreadCount(clientId);
        setUnreadCount(count);
      } catch (err) {
        console.error('Failed to load unread count', err);
      }
    };
    loadUnreadCount();
  }, [clientId]);

  const handleMarkReadComplete = async () => {
    try {
      const count = await fetchUnreadCount(clientId);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to refresh unread count', err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
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
          onClose={() => setIsOpen(false)}
          onMarkRead={handleMarkReadComplete}
        />
      )}
    </div>
  );
}

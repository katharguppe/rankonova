'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Bell } from 'lucide-react';
import { fetchNotifications } from '@/lib/services/notifications';
import { NotificationsResponse } from '@/lib/types/notifications';
import { NotificationItem } from './NotificationItem';

export interface NotificationDropdownProps {
  clientId: string;
  onClose: () => void;
  onMarkRead: () => void;
}

export function NotificationDropdown(props: NotificationDropdownProps) {
  const [data, setData] = useState<NotificationsResponse>({
    data: [],
    total: 0,
    unreadCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      setIsLoading(true);
      try {
        const result = await fetchNotifications(props.clientId);
        setData(result);
      } catch (err) {
        console.error('Failed to load notifications', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadNotifications();
  }, [props.clientId]);

  const handleMarkRead = async (notificationId: string) => {
    setData((prev) => ({
      ...prev,
      data: prev.data.map((n) => (n.id === notificationId ? { ...n, isRead: !n.isRead } : n)),
    }));
    props.onMarkRead();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      onClick={props.onClose}
    >
      <div
        className="absolute right-0 top-16 w-96 bg-white rounded-xl border border-slate-200 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-slate-50 px-5 py-3 border-b border-slate-200 rounded-t-xl">
          <h2 className="font-semibold text-slate-900">Notifications</h2>
          <button
            onClick={props.onClose}
            className="p-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X size={18} className="text-slate-600" />
          </button>
        </div>

        {/* List or Empty State */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="text-slate-400 animate-spin" />
            </div>
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Bell size={24} className="mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data?.data.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {(data?.total ?? 0) > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl text-center">
            <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
              View All ({data?.total || 0})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

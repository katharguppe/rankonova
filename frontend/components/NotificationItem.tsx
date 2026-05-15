'use client';

import { useState } from 'react';
import { Circle, CircleCheckBig, Loader2 } from 'lucide-react';
import { Notification } from '@/lib/types/notifications';
import { markAsRead } from '@/lib/services/notifications';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => Promise<void>;
}

export function NotificationItem(props: NotificationItemProps) {
  const [isMarking, setIsMarking] = useState(false);

  const handleToggleRead = async () => {
    setIsMarking(true);
    try {
      await markAsRead(props.notification.id, !props.notification.isRead);
      await props.onMarkRead(props.notification.id);
    } catch (err) {
      console.error('Mark read failed', err);
    } finally {
      setIsMarking(false);
    }
  };

  const severityColors = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-amber-100 text-amber-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-slate-100 text-slate-700',
  };

  const formatTime = (date: string | Date) => {
    const ago = Date.now() - new Date(date).getTime();
    const seconds = Math.floor(ago / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div
      className={cn(
        'px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer',
        !props.notification.isRead && 'bg-blue-50/50'
      )}
      onClick={handleToggleRead}
    >
      <div className="flex items-start gap-3">
        {/* Severity Badge */}
        <div
          className={cn(
            'px-2 py-1 rounded text-xs font-semibold mt-0.5 shrink-0',
            severityColors[props.notification.severity]
          )}
        >
          {props.notification.severity.toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 text-sm truncate">
            {props.notification.title}
          </h3>
          {props.notification.body && (
            <p className="text-xs text-slate-600 line-clamp-2 mt-1">
              {props.notification.body}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <time className="text-xs text-slate-400">
              {formatTime(props.notification.createdAt)}
            </time>
            {props.notification.deepLink && (
              <a
                href={props.notification.deepLink}
                className="text-xs text-blue-600 font-medium hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View
              </a>
            )}
          </div>
        </div>

        {/* Read Toggle */}
        <button
          disabled={isMarking}
          className="ml-2 p-1.5 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleRead();
          }}
        >
          {isMarking ? (
            <Loader2 size={16} className="animate-spin text-slate-400" />
          ) : props.notification.isRead ? (
            <CircleCheckBig size={16} className="text-slate-400" />
          ) : (
            <Circle size={16} className="text-slate-400" />
          )}
        </button>
      </div>
    </div>
  );
}

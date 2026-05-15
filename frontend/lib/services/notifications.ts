import { Notification, NotificationsResponse, UnreadCountResponse } from '../types/notifications';

export async function fetchNotifications(
  clientId: string,
  limit: number = 50,
  offset: number = 0
): Promise<NotificationsResponse> {
  const res = await fetch(
    `/api/notifications?clientId=${encodeURIComponent(clientId)}&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) throw new Error(`Fetch notifications failed: ${res.status}`);
  return res.json();
}

export async function fetchUnreadCount(clientId: string): Promise<number> {
  const res = await fetch(`/api/notifications/unread-count?clientId=${encodeURIComponent(clientId)}`);
  if (!res.ok) throw new Error(`Fetch unread count failed: ${res.status}`);
  const data = (await res.json()) as UnreadCountResponse;
  return data.unreadCount;
}

export async function markAsRead(notificationId: string, isRead: boolean): Promise<Notification> {
  const res = await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isRead }),
  });
  if (!res.ok) throw new Error(`Mark read failed: ${res.status}`);
  return res.json();
}

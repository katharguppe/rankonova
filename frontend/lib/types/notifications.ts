export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  clientId: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  deepLink?: string;
  isRead: boolean;
  emailSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationsResponse {
  data: Notification[];
  total: number;
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

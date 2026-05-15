/**
 * Notification severity levels
 * - CRITICAL: Sent immediately via email + in-app
 * - HIGH: Batched in daily digest at 9 AM IST
 * - MEDIUM: Routed to weekly brief only
 * - LOW: Low-priority informational notifications
 */
export enum NotificationSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Notification types - 13 total across three severity levels
 *
 * CRITICAL (5 types):
 * - CITATION_DROP: Citation rate drops >10 points in 24h
 * - COMPETITOR_SPIKE: Competitor mentions spike >15 points
 * - NEGATIVE_REVIEW_24H: Unanswered negative review for >24h
 * - PAYMENT_FAILED: Payment failed during subscription renewal
 * - PROMPT_FAILURE_RATE: Prompt run failure rate >20% in 1h window
 *
 * HIGH (4 types):
 * - COMMUNITY_THREAD: New community thread mentioning client with AI citation
 * - CONTENT_DRAFT_READY: Content draft generated and awaiting review
 * - GAP_REPORT: New gap report generated
 * - COMPETITOR_DOMAIN: New competitor citation source domain found
 *
 * MEDIUM (3 types):
 * - AGGREGATOR_SCORE: Aggregator score drops below 60
 * - REVIEW_BACKLOG: Unanswered review backlog exceeds 20 customers
 * - PR_OPPORTUNITY: PR opportunity detected
 */
export enum NotificationType {
  // Critical (5)
  CITATION_DROP = 'citation_drop',
  COMPETITOR_SPIKE = 'competitor_spike',
  NEGATIVE_REVIEW_24H = 'negative_review_24h',
  PAYMENT_FAILED = 'payment_failed',
  PROMPT_FAILURE_RATE = 'prompt_failure_rate',

  // High (4)
  COMMUNITY_THREAD = 'community_thread',
  CONTENT_DRAFT_READY = 'content_draft_ready',
  GAP_REPORT = 'gap_report',
  COMPETITOR_DOMAIN = 'competitor_domain',

  // Medium (3)
  AGGREGATOR_SCORE = 'aggregator_score',
  REVIEW_BACKLOG = 'review_backlog',
  PR_OPPORTUNITY = 'pr_opportunity',
}

/**
 * DTO for creating a notification
 * Required: type, severity, title, body
 * Optional: clientId, deepLink
 */
export interface CreateNotificationDto {
  clientId?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  deepLink?: string;
}

/**
 * Response DTO matching Prisma Notification model
 * Represents a single notification record with all fields in camelCase
 */
export interface NotificationResponseDto {
  id: string;
  tenantId: string;
  clientId?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  deepLink?: string;
  isRead: boolean;
  emailSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Query DTO for finding notifications
 * Required: clientId
 * Optional: limit, offset for pagination
 */
export interface FindNotificationsQueryDto {
  clientId: string;
  limit?: number;
  offset?: number;
}

/**
 * Response DTO for unread count
 */
export interface UnreadCountResponseDto {
  unreadCount: number;
}

/**
 * DTO for marking notification as read/unread
 */
export interface MarkAsReadDto {
  isRead: boolean;
}

/**
 * Result from rate limiter check
 * - allowed: whether the notification can be sent
 * - secondsUntilNext: (optional) seconds until next notification of same type is allowed
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  secondsUntilNext?: number;
}

/**
 * Payload for digest email batch processing
 * Contains notifications grouped by client for batch email generation
 */
export interface DigestEmailPayload {
  clientId: string;
  tenantId: string;
  notifications: NotificationResponseDto[];
  sentAt: Date;
}

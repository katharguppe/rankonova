import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { RateLimiterService } from './rate-limiter.service';
import { NotificationType, NotificationSeverity } from './notifications.types';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationHandler {
  private logger = new Logger(NotificationHandler.name);

  constructor(
    private notificationsService: NotificationsService,
    private rateLimiter: RateLimiterService,
    private mailService: MailService,
  ) {}

  // ============= CRITICAL EVENTS =============

  @OnEvent('citation.drop')
  async onCitationDrop(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.CITATION_DROP,
      severity: NotificationSeverity.CRITICAL,
      title: 'Citation Rate Drop Alert',
      body: `Your citation rate dropped ${event.citationDropPoints} points in the last 24 hours.`,
      deepLink: '/dashboard/analytics#citation-trends',
    });
  }

  @OnEvent('competitor.spike')
  async onCompetitorSpike(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.COMPETITOR_SPIKE,
      severity: NotificationSeverity.CRITICAL,
      title: 'Competitor Mention Spike',
      body: `Competitor mentions spiked ${event.spikePoints} points in the last 24 hours.`,
      deepLink: '/dashboard/analytics#competitor-mentions',
    });
  }

  @OnEvent('review.negative.24h')
  async onNegativeReview24h(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.NEGATIVE_REVIEW_24H,
      severity: NotificationSeverity.CRITICAL,
      title: 'Unanswered Negative Review',
      body: 'A negative review has been unanswered for over 24 hours.',
      deepLink: '/dashboard/reviews',
    });
  }

  @OnEvent('payment.failed')
  async onPaymentFailed(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.PAYMENT_FAILED,
      severity: NotificationSeverity.CRITICAL,
      title: 'Payment Failed',
      body: 'Your subscription payment failed. Please update your payment method.',
      deepLink: '/dashboard/billing',
    });
  }

  @OnEvent('prompt.failure.rate')
  async onPromptFailureRate(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.PROMPT_FAILURE_RATE,
      severity: NotificationSeverity.CRITICAL,
      title: 'High Prompt Failure Rate',
      body: `Your prompts are failing at a rate of ${event.failurePercentage}% in the last hour.`,
      deepLink: '/dashboard/prompts',
    });
  }

  // ============= HIGH EVENTS =============

  @OnEvent('community.thread')
  async onCommunityThread(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.COMMUNITY_THREAD,
      severity: NotificationSeverity.HIGH,
      title: 'New Community Mention',
      body: 'Your brand was mentioned in a community thread with AI citations.',
      deepLink: '/dashboard/offsite/community',
    });
  }

  @OnEvent('content.draft.ready')
  async onContentDraftReady(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.CONTENT_DRAFT_READY,
      severity: NotificationSeverity.HIGH,
      title: 'Content Draft Ready for Review',
      body: 'A new content draft is ready for your review and approval.',
      deepLink: '/dashboard/content/drafts',
    });
  }

  @OnEvent('gap.report.generated')
  async onGapReport(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.GAP_REPORT,
      severity: NotificationSeverity.HIGH,
      title: 'Gap Report Generated',
      body: 'A new gap analysis report is available.',
      deepLink: '/dashboard/diagnostics/gaps',
    });
  }

  @OnEvent('competitor.domain.found')
  async onCompetitorDomain(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.COMPETITOR_DOMAIN,
      severity: NotificationSeverity.HIGH,
      title: 'New Competitor Citation Source',
      body: 'A new domain citing competitors was detected.',
      deepLink: '/dashboard/analytics#competitors',
    });
  }

  // ============= MEDIUM EVENTS =============

  @OnEvent('aggregator.score.low')
  async onAggregatorScore(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.AGGREGATOR_SCORE,
      severity: NotificationSeverity.MEDIUM,
      title: 'Low Aggregator Score',
      body: 'Your aggregator score dropped below 60.',
      deepLink: '/dashboard/offsite/aggregators',
    });
  }

  @OnEvent('review.backlog')
  async onReviewBacklog(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.REVIEW_BACKLOG,
      severity: NotificationSeverity.MEDIUM,
      title: 'Review Backlog Alert',
      body: `You have ${event.backlogCount} unanswered reviews.`,
      deepLink: '/dashboard/reviews',
    });
  }

  @OnEvent('pr.opportunity')
  async onPrOpportunity(event: any) {
    await this.handleEvent({
      clientId: event.clientId,
      tenantId: event.tenantId,
      type: NotificationType.PR_OPPORTUNITY,
      severity: NotificationSeverity.MEDIUM,
      title: 'PR Opportunity Detected',
      body: 'A new PR opportunity matching your profile was found.',
      deepLink: '/dashboard/offsite/pr',
    });
  }

  // ============= INTERNAL HANDLER =============

  /**
   * Core handler that routes notifications by severity and applies rate limiting
   * - CRITICAL: Rate limit bypass, immediate email send
   * - HIGH/MEDIUM: Rate limited, stored for digest/weekly brief
   *
   * @param payload Standardized notification payload
   */
  private async handleEvent(payload: {
    clientId: string;
    tenantId: string;
    type: NotificationType;
    severity: NotificationSeverity;
    title: string;
    body: string;
    deepLink?: string;
  }) {
    // Check rate limiting (CRITICAL bypass happens in canSend)
    const rateLimitResult = await this.rateLimiter.canSend(
      payload.clientId,
      payload.type,
      payload.severity,
    );

    if (!rateLimitResult.allowed) {
      this.logger.warn(
        `Rate limit blocked: clientId=${payload.clientId}, type=${payload.type}, severity=${payload.severity}. Wait ${rateLimitResult.secondsUntilNext}s.`,
      );
      return;
    }

    try {
      // Create notification record
      const notification = await this.notificationsService.create(
        {
          clientId: payload.clientId,
          type: payload.type,
          severity: payload.severity,
          title: payload.title,
          body: payload.body,
          deepLink: payload.deepLink,
        },
        payload.tenantId,
      );

      // Route by severity
      if (payload.severity === NotificationSeverity.CRITICAL) {
        // Send immediately via email
        try {
          await this.mailService.sendNotificationEmail(
            notification,
            payload.tenantId,
          );
          this.logger.log(
            `Critical notification sent via email: clientId=${payload.clientId}, type=${payload.type}`,
          );
        } catch (emailError) {
          const message =
            emailError instanceof Error
              ? emailError.message
              : String(emailError);
          this.logger.error(
            `Failed to send critical notification email: ${message}`,
            emailError,
          );
          // Don't re-throw; resilient behavior
        }
      } else {
        // HIGH and MEDIUM notifications are queued/stored by the handler
        // Digest job will send HIGH; MEDIUM goes to weekly brief elsewhere
        this.logger.log(
          `Notification stored for digest: clientId=${payload.clientId}, type=${payload.type}, severity=${payload.severity}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to handle notification: ${message}`,
        error,
      );
      // Don't re-throw; resilient behavior
    }
  }
}

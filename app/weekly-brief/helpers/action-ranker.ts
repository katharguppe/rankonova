import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActionType, RankedAction } from '../dto/weekly-brief.types';

const WEIGHTS: Record<string, number> = {
  content_approval: 3,
  pr_approval: 2,
  reddit_reply: 2,
  review_request: 1,
  profile_update: 1,
};

@Injectable()
export class ActionRanker {
  constructor(private readonly prisma: PrismaService) {}

  async rankActions(clientId: string): Promise<RankedAction[]> {
    const actions: RankedAction[] = [];

    // Collect content_approval drafts (weight 3)
    const contentOutputs = await this.prisma.contentOutput.findMany({
      where: {
        client_id: clientId,
        status: 'draft',
      },
      select: {
        id: true,
        title: true,
        html_content: true,
        created_at: true,
      },
    });

    for (const co of contentOutputs) {
      actions.push(this.buildAction('content_approval', co.id, co.title, co.html_content, co.created_at));
    }

    // Collect pr_approval drafts (weight 2)
    const prSignals = await this.prisma.prSignal.findMany({
      where: {
        client_id: clientId,
        status: 'draft',
      },
      select: {
        id: true,
        news_title: true,
        press_release_draft: true,
        created_at: true,
      },
    });

    for (const pr of prSignals) {
      actions.push(this.buildAction('pr_approval', pr.id, pr.news_title, pr.press_release_draft, pr.created_at));
    }

    // Collect reddit_reply pending responses (weight 2)
    const communityThreads = await this.prisma.communityThread.findMany({
      where: {
        client_id: clientId,
        response_status: 'pending',
      },
      select: {
        id: true,
        thread_title: true,
        response_draft: true,
        created_at: true,
      },
    });

    for (const ct of communityThreads) {
      actions.push(this.buildAction('reddit_reply', ct.id, ct.thread_title, ct.response_draft || '', ct.created_at));
    }

    // Collect review_request pending negative reviews (weight 1)
    const reviews = await this.prisma.reviewSnapshot.findMany({
      where: {
        client_id: clientId,
        response_status: 'pending',
        is_negative: true,
      },
      select: {
        id: true,
        review_text: true,
        response_draft: true,
        created_at: true,
      },
    });

    for (const rv of reviews) {
      actions.push(this.buildAction('review_request', rv.id, 'Negative review response', rv.response_draft || '', rv.created_at));
    }

    // Collect profile_update aggregator snapshots with update_pack (weight 1)
    const aggregators = await this.prisma.aggregatorSnapshot.findMany({
      where: {
        client_id: clientId,
        update_pack: {
          not: null,
        },
      },
      select: {
        id: true,
        platform: true,
        update_pack: true,
        created_at: true,
      },
    } as never);

    for (const agg of aggregators) {
      const updatePack = (agg.update_pack as Record<string, unknown>[]) || [];
      if (Array.isArray(updatePack) && updatePack.length > 0) {
        actions.push(this.buildAction('profile_update', agg.id, `Update ${agg.platform} profile`, JSON.stringify(updatePack), agg.created_at));
      }
    }

    // Sort by impact_score DESC
    actions.sort((a, b) => b.impact_score - a.impact_score);

    // Return top 3
    return actions.slice(0, 3);
  }

  private buildAction(
    actionType: string,
    draftId: string,
    title: string,
    content: string,
    createdAt: Date,
  ): RankedAction {
    const weight = WEIGHTS[actionType] || 1;
    const recencyBonus = this.calculateRecencyBonus(createdAt);
    const impactScore = weight * (1 + recencyBonus);

    return {
      action_type: actionType as ActionType,
      draft_id: draftId,
      title,
      weight,
      impact_score: impactScore,
      draft_preview: content.substring(0, 100),
      draft_content_summary: content.substring(0, 200),
      effort_minutes: this.estimateEffort(actionType),
    };
  }

  private calculateRecencyBonus(createdAt: Date): number {
    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    if (ageHours <= 24) return 0.3;
    if (ageHours <= 72) return 0.15;
    return 0;
  }

  private estimateEffort(actionType: string): number {
    const efforts: Record<string, number> = {
      content_approval: 20,
      pr_approval: 15,
      reddit_reply: 15,
      review_request: 10,
      profile_update: 25,
    };
    return efforts[actionType] || 15;
  }
}

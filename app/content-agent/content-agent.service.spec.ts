import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentOutput, ContentStatus, ContentType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContentAgentService } from './content-agent.service';
import { PrismaService } from '../prisma/prisma.service';
import { FaqPageGeneratorService } from './generators/faq-page.generator';
import { ComparisonPageGeneratorService } from './generators/comparison-page.generator';
import { EntityAuthorityPageGeneratorService } from './generators/entity-authority-page.generator';
import { SegmentArticleGeneratorService } from './generators/segment-article.generator';
import { QualityValidatorService } from './validators/quality-validator';

const TENANT = 'tenant-1';
const OUTPUT_ID = 'output-1';

function makeOutput(status: ContentStatus): ContentOutput {
  return {
    id: OUTPUT_ID,
    client_id: 'client-1',
    target_prompt_id: null,
    type: ContentType.faq_page,
    title: 'Test',
    html_content: '<html></html>',
    schema_json: {},
    generation_prompt: '',
    status,
    review_notes: null,
    approved_by: null,
    approved_at: null,
    published_at: null,
    follow_up_scheduled_at: null,
    citation_rate_before: null,
    citation_rate_after: null,
    previous_version_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as ContentOutput;
}

describe('ContentAgentService — state machine', () => {
  let service: ContentAgentService;
  let mockPrisma: {
    contentOutput: { findFirst: jest.Mock; update: jest.Mock };
    promptRun: { count: jest.Mock };
    brandMention: { count: jest.Mock };
    notification: { create: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      contentOutput: {
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...makeOutput(data.status ?? ContentStatus.draft), ...data }),
        ),
      },
      promptRun: { count: jest.fn().mockResolvedValue(0) },
      brandMention: { count: jest.fn().mockResolvedValue(0) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentAgentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FaqPageGeneratorService, useValue: {} },
        { provide: ComparisonPageGeneratorService, useValue: {} },
        { provide: EntityAuthorityPageGeneratorService, useValue: {} },
        { provide: SegmentArticleGeneratorService, useValue: {} },
        { provide: QualityValidatorService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(ContentAgentService);
  });

  // ── approveOutput ─────────────────────────────────────────────────────────

  describe('approveOutput', () => {
    it('transitions draft → approved and sets approved_by + approved_at', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.draft));

      await service.approveOutput(TENANT, OUTPUT_ID, 'user-42');

      expect(mockPrisma.contentOutput.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: OUTPUT_ID },
          data: expect.objectContaining({
            status: ContentStatus.approved,
            approved_by: 'user-42',
          }),
        }),
      );
    });

    it('throws 400 when transitioning published → approved', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.published));

      await expect(service.approveOutput(TENANT, OUTPUT_ID, 'user-1'))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.contentOutput.update).not.toHaveBeenCalled();
    });

    it('throws 400 when transitioning rejected → approved', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.rejected));

      await expect(service.approveOutput(TENANT, OUTPUT_ID, 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws 404 when output not found for tenant', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(null);

      await expect(service.approveOutput(TENANT, OUTPUT_ID, 'user-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── requestRevision ───────────────────────────────────────────────────────

  describe('requestRevision', () => {
    it('transitions draft → revision_requested with review_notes', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.draft));

      await service.requestRevision(TENANT, OUTPUT_ID, 'needs more numbers');

      expect(mockPrisma.contentOutput.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ContentStatus.revision_requested,
            review_notes: 'needs more numbers',
          }),
        }),
      );
    });

    it('transitions approved → revision_requested', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.approved));

      await service.requestRevision(TENANT, OUTPUT_ID, 'revise comparison table');

      expect(mockPrisma.contentOutput.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ContentStatus.revision_requested }),
        }),
      );
    });

    it('throws 400 when transitioning published → revision_requested', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.published));

      await expect(service.requestRevision(TENANT, OUTPUT_ID, 'notes'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── rejectOutput ──────────────────────────────────────────────────────────

  describe('rejectOutput', () => {
    it('transitions draft → rejected', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.draft));

      await service.rejectOutput(TENANT, OUTPUT_ID);

      expect(mockPrisma.contentOutput.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: OUTPUT_ID },
          data: expect.objectContaining({ status: ContentStatus.rejected }),
        }),
      );
    });

    it('throws 400 when transitioning approved → rejected', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.approved));

      await expect(service.rejectOutput(TENANT, OUTPUT_ID))
        .rejects.toThrow(BadRequestException);
    });

    it('throws 400 when transitioning published → rejected', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.published));

      await expect(service.rejectOutput(TENANT, OUTPUT_ID))
        .rejects.toThrow(BadRequestException);
    });

    it('throws 404 when output not found', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(null);

      await expect(service.rejectOutput(TENANT, OUTPUT_ID))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── publishOutput ─────────────────────────────────────────────────────────

  describe('publishOutput', () => {
    it('transitions approved → published and sets follow_up_scheduled_at ~60 days out', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.approved));

      await service.publishOutput(TENANT, OUTPUT_ID);

      const call = mockPrisma.contentOutput.update.mock.calls[0][0];
      expect(call.data.status).toBe(ContentStatus.published);
      expect(call.data.published_at).toBeInstanceOf(Date);
      const diffDays = Math.round(
        (call.data.follow_up_scheduled_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBeCloseTo(60, 0);
    });

    it('throws 400 when transitioning draft → published directly', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.draft));

      await expect(service.publishOutput(TENANT, OUTPUT_ID))
        .rejects.toThrow(BadRequestException);
    });

    it('throws 400 when transitioning rejected → published', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(makeOutput(ContentStatus.rejected));

      await expect(service.publishOutput(TENANT, OUTPUT_ID))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── VALID_TRANSITIONS exhaustiveness ─────────────────────────────────────

  describe('invalid source states', () => {
    it('throws 400 for any transition out of revision_requested via approve', async () => {
      mockPrisma.contentOutput.findFirst.mockResolvedValue(
        makeOutput(ContentStatus.revision_requested),
      );
      await expect(service.approveOutput(TENANT, OUTPUT_ID, 'u'))
        .rejects.toThrow(BadRequestException);
    });
  });
});

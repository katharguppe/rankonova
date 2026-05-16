import { Test } from '@nestjs/testing';
import { IterationService } from './iteration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PE_REDIS } from '../prompt-engine.constants';

const mockPrisma = {
  promptIteration: {
    create: jest.fn(),
    aggregate: jest.fn(),
    update: jest.fn(),
  },
  promptRun: { updateMany: jest.fn() },
};

const mockRedis = {
  set: jest.fn(),
  decr: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
};

describe('IterationService', () => {
  let service: IterationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IterationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PE_REDIS, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<IterationService>(IterationService);
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  describe('create()', () => {
    it('sets iteration_number to 1 when no prior iterations exist', async () => {
      mockPrisma.promptIteration.aggregate.mockResolvedValue({ _max: { iteration_number: null } });
      mockPrisma.promptIteration.create.mockResolvedValue({
        id: 'iter1',
        client_id: 'c1',
        iteration_number: 1,
        status: 'running',
        started_at: new Date(),
        completed_at: null,
      });

      const result = await service.create('c1');

      expect(mockPrisma.promptIteration.create).toHaveBeenCalledWith({
        data: { client_id: 'c1', iteration_number: 1, status: 'running' },
      });
      expect(result.iteration_number).toBe(1);
    });

    it('increments iteration_number from last value', async () => {
      mockPrisma.promptIteration.aggregate.mockResolvedValue({ _max: { iteration_number: 4 } });
      mockPrisma.promptIteration.create.mockResolvedValue({
        id: 'iter5',
        client_id: 'c1',
        iteration_number: 5,
        status: 'running',
        started_at: new Date(),
        completed_at: null,
      });

      await service.create('c1');

      expect(mockPrisma.promptIteration.create).toHaveBeenCalledWith({
        data: { client_id: 'c1', iteration_number: 5, status: 'running' },
      });
    });
  });

  describe('setCounter()', () => {
    it('sets Redis remaining counter with 2h TTL', async () => {
      await service.setCounter('c1', 'iter1', 125);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'iteration:c1:current', 'iter1', 'EX', 7200,
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'iteration:c1:remaining', 125, 'EX', 7200,
      );
    });
  });

  describe('tick()', () => {
    it('decrements counter and does NOT call complete when counter > 0', async () => {
      mockRedis.decr.mockResolvedValue(10);
      const completeSpy = jest.spyOn(service, 'complete').mockResolvedValue(undefined);

      await service.tick('c1', 'iter1');

      expect(mockRedis.decr).toHaveBeenCalledWith('iteration:c1:remaining');
      expect(completeSpy).not.toHaveBeenCalled();
    });

    it('calls complete() when counter reaches 0', async () => {
      mockRedis.decr.mockResolvedValue(0);
      const completeSpy = jest.spyOn(service, 'complete').mockResolvedValue(undefined);

      await service.tick('c1', 'iter1');

      expect(completeSpy).toHaveBeenCalledWith('iter1', 'c1');
    });

    it('calls complete() when counter goes negative (safety net)', async () => {
      mockRedis.decr.mockResolvedValue(-1);
      const completeSpy = jest.spyOn(service, 'complete').mockResolvedValue(undefined);

      await service.tick('c1', 'iter1');

      expect(completeSpy).toHaveBeenCalledWith('iter1', 'c1');
    });
  });

  describe('complete()', () => {
    it('updates DB status to completed with completed_at', async () => {
      mockPrisma.promptIteration.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(2);

      await service.complete('iter1', 'c1');

      expect(mockPrisma.promptIteration.update).toHaveBeenCalledWith({
        where: { id: 'iter1' },
        data: { status: 'completed', completed_at: expect.any(Date) },
      });
    });

    it('deletes both Redis keys', async () => {
      mockPrisma.promptIteration.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(2);

      await service.complete('iter1', 'c1');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'iteration:c1:current',
        'iteration:c1:remaining',
      );
    });

    it('does not call DB update when Redis keys already deleted (idempotency guard)', async () => {
      mockRedis.del.mockResolvedValue(0);

      await service.complete('iter1', 'c1');

      expect(mockPrisma.promptIteration.update).not.toHaveBeenCalled();
    });

    it('fires agent-reco POST fire-and-forget (does not throw if POST fails)', async () => {
      mockPrisma.promptIteration.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(2);
      global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

      await expect(service.complete('iter1', 'c1')).resolves.not.toThrow();
    });
  });
});

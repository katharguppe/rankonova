import { AiEngine } from '@prisma/client';

export interface PromptRunJobPayload {
  promptRunId: string;
  promptId: string;
  clientId: string;
  tenantId: string;
  engine: AiEngine;
  iterationId?: string;
}

export interface EngineResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface IEngineAdapter {
  execute(promptText: string): Promise<EngineResult>;
}

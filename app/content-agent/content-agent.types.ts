export interface GeneratedContent {
  title: string;
  htmlContent: string;
  schemaJson: object;
  generationPrompt: string;
}

export interface ValidationIssue {
  rule: string;
  message: string;
  suggestion?: string;
  fatal: boolean;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

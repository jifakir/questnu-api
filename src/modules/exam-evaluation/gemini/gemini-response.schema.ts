import { z } from 'zod';

export const grammarErrorSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
});

export const sentenceImprovementSchema = z.object({
  original: z.string(),
  improved: z.string(),
  explanation: z.string(),
});

export const vocabularySuggestionSchema = z.object({
  original_word: z.string(),
  suggested_word: z.string(),
  reason: z.string(),
});

export const unclearSectionSchema = z.object({
  approx_text: z.string(),
  reason: z.string(),
});

export const geminiResponseSchema = z.object({
  overall_score: z.number(),
  grammar_errors: z.array(grammarErrorSchema),
  sentence_improvements: z.array(sentenceImprovementSchema),
  vocabulary_suggestions: z.array(vocabularySuggestionSchema),
  unclear_sections: z.array(unclearSectionSchema),
  summary_feedback: z.string(),
});

export type GeminiResponsePayload = z.infer<typeof geminiResponseSchema>;

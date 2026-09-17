export function extractJsonObjectFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const inner = fence ? fence[1].trim() : trimmed;
  return JSON.parse(inner);
}

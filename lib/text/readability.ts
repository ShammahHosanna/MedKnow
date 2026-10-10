/**
 * Readability helpers for summaryPlain (EF-08 / CA-08.1).
 * ≤ 150 words, sentences ≤ 20 words. The server caps the summary instead of
 * rejecting the whole analysis when the model is slightly verbose.
 */

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function maxSentenceWords(text: string): number {
  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return 0;
  return Math.max(...sentences.map((s) => countWords(s)));
}

/**
 * Trims a summary to at most `maxWords` words, cutting on sentence boundaries
 * and appending a final period. Sentences longer than `maxSentenceLen` words
 * are kept (trimming them mid-sentence would corrupt meaning); the route logs
 * the overflow anonymously.
 */
export function capSummary(text: string, maxWords = 150): string {
  const trimmed = text.trim();
  if (countWords(trimmed) <= maxWords) return trimmed;

  const sentences = trimmed.split(/(?<=[.!?…])\s+/);
  const kept: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    const n = countWords(sentence);
    if (words + n > maxWords) break;
    kept.push(sentence);
    words += n;
  }
  const result = kept.join(' ').trim();
  if (!result) {
    // Degenerate case: first sentence alone exceeds the budget.
    return trimmed.split(/\s+/).slice(0, maxWords).join(' ') + '…';
  }
  return result;
}

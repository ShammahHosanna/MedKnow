'use client';

/**
 * SpeechController (spec EF-09 / § 6.2). Wraps speechSynthesis with:
 * - sentence chunking (≤ 200 chars) to survive Chrome's long-text cutoff (A4)
 * - a sentence queue with callbacks so the UI can highlight progress
 * - pause / resume / stop and speed control (0.75× / 1× / 1.25×)
 * - availability and voice detection (A1/A2); iOS-safe: always started from a
 *   user gesture (A3); everything stops on language change or unmount (A5).
 */

const MAX_CHUNK = 200;

export const SPEEDS = [0.75, 1, 1.25] as const;
export type Speed = (typeof SPEEDS)[number];

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Splits text into sentence chunks of at most MAX_CHUNK characters. */
export function chunkText(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= MAX_CHUNK) {
      chunks.push(sentence);
      continue;
    }
    // Split long sentences on spaces near the limit.
    let remaining = sentence;
    while (remaining.length > MAX_CHUNK) {
      let cut = remaining.lastIndexOf(' ', MAX_CHUNK);
      if (cut <= 0) cut = MAX_CHUNK;
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) chunks.push(remaining);
  }
  return chunks;
}

export interface SpeechCallbacks {
  onChunkStart?: (index: number, total: number) => void;
  onEnd?: () => void;
  onError?: () => void;
}

export class SpeechController {
  private queue: string[] = [];
  private index = 0;
  private speed: Speed = 1;
  private callbacks: SpeechCallbacks = {};
  private stopped = true;
  private lang = 'en';

  constructor(private readonly langProvider: () => string) {}

  isSpeaking(): boolean {
    return speechSupported() && !this.stopped;
  }

  /** True when at least one voice exists for the language (EF-09 A2). */
  hasVoiceFor(langCode: string): boolean {
    if (!speechSupported()) return false;
    return window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith(langCode));
  }

  speak(text: string, lang: string, callbacks: SpeechCallbacks = {}): void {
    this.stop();
    if (!speechSupported()) {
      callbacks.onError?.();
      return;
    }
    this.queue = chunkText(text);
    this.index = 0;
    this.lang = lang;
    this.callbacks = callbacks;
    this.stopped = false;
    if (this.queue.length === 0) {
      this.stopped = true;
      callbacks.onEnd?.();
      return;
    }
    this.speakNext();
  }

  private speakNext(): void {
    if (this.stopped || this.index >= this.queue.length) {
      const ended = !this.stopped;
      this.stopped = true;
      if (ended) this.callbacks.onEnd?.();
      return;
    }
    const chunk = this.queue[this.index];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = this.lang; // CA-09.1
    utterance.rate = this.speed;
    utterance.onstart = () => this.callbacks.onChunkStart?.(this.index, this.queue.length);
    utterance.onend = () => {
      if (this.stopped) return;
      this.index += 1;
      this.speakNext();
    };
    utterance.onerror = () => {
      const wasStopped = this.stopped;
      this.stopped = true;
      if (!wasStopped) this.callbacks.onError?.();
    };
    window.speechSynthesis.speak(utterance);
  }

  pause(): void {
    if (speechSupported()) window.speechSynthesis.pause();
  }

  resume(): void {
    if (speechSupported()) window.speechSynthesis.resume();
  }

  /** Hard stop — effective within ~300 ms (CA-09.2). */
  stop(): void {
    this.stopped = true;
    this.queue = [];
    this.index = 0;
    if (speechSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    // Restart the current chunk at the new rate for immediate feedback.
    if (this.isSpeaking() && speechSupported()) {
      window.speechSynthesis.cancel();
      this.speakNext();
    }
  }

  currentLang(): string {
    return this.lang || this.langProvider();
  }
}

import { z } from "zod";

import type { StructuredEntry } from "../types.js";

const structuredEntrySchema = z.object({
  title: z.string().min(1).max(40),
  summary: z.string().min(1),
  todos: z.array(z.string()),
  raw_text: z.string().min(1)
});

const fillerPattern = /^(嗯+|啊+|就是|然后|那个|这个|我觉得|我想|其实|先说一下|先讲一下)+/;

export function parseStructuredEntry(payload: string, rawText: string): StructuredEntry {
  const parsed = JSON.parse(payload) as unknown;
  const entry = structuredEntrySchema.parse(parsed);
  const fallbackTodos = inferTodos(rawText);
  const sanitizedTodos = entry.todos.map((item) => sanitizeText(item, 40)).filter(Boolean);
  const todos = chooseTodos(sanitizedTodos, fallbackTodos);

  return {
    title: sanitizeText(entry.title, 20),
    summary: sanitizeSummary(entry.summary),
    todos,
    raw_text: entry.raw_text || rawText
  };
}

export function buildFallbackStructuredEntry(rawText: string): StructuredEntry {
  const normalized = rawText.trim();
  const cleaned = normalized.replace(/\s+/g, " ").replace(fillerPattern, "").trim();
  const titleSource = cleaned || normalized || "语音记录";
  const summary = toSummary(normalized);

  return {
    title: sanitizeText(titleSource, 18) || "语音记录",
    summary,
    todos: inferTodos(normalized),
    raw_text: normalized
  };
}

function inferTodos(rawText: string): string[] {
  const normalized = rawText.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return [];
  }

  const triggerTodos = inferTriggerTodos(normalized);
  if (triggerTodos.length > 0) {
    return triggerTodos;
  }

  const markerPattern =
    /(?:^|[，。！？!?；;、,:：\s]+)(?:第[一二三四五六七八九十\d]+个(?:是|就是)|第[一二三四五六七八九十\d]+件事情(?:是|就是)?|[一二三四五六七八九十\d]+是)/g;
  const markers = Array.from(normalized.matchAll(markerPattern)).map((match) => {
    const fullMatch = match[0];
    const prefix = fullMatch.match(/^[，。！？!?；;、,:：\s]+/u)?.[0] ?? "";
    const marker = fullMatch.slice(prefix.length);
    return {
      index: (match.index ?? 0) + prefix.length,
      marker
    };
  });

  if (markers.length === 0) {
    return [];
  }

  const todos: string[] = [];
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const start = marker.index + marker.marker.length;
    const end = index + 1 < markers.length ? markers[index + 1].index : normalized.length;
    const segment = normalized.slice(start, end);
    const todo = sanitizeTodoSegment(segment);
    if (todo) {
      todos.push(todo);
    }
  }

  return todos;
}

function inferTriggerTodos(rawText: string): string[] {
  const triggerMatch = rawText.match(/(?:^|[，。！？!?；;、,:：\s]+)(?:今日)?待办事项[，。！？!?；;、,:：\s]+(.+)/u);
  if (!triggerMatch?.[1]) {
    return [];
  }

  const remainder = triggerMatch[1].trim();
  if (!remainder) {
    return [];
  }

  const markerPattern =
    /(?:^|[，。！？!?；;、,:：\s]+)(?:第[一二三四五六七八九十\d]+个(?:是|就是)|第[一二三四五六七八九十\d]+件事情(?:是|就是)?|第[一二三四五六七八九十\d]+是|[一二三四五六七八九十\d]+是)/g;
  const markers = Array.from(remainder.matchAll(markerPattern)).map((match) => {
    const fullMatch = match[0];
    const prefix = fullMatch.match(/^[，。！？!?；;、,:：\s]+/u)?.[0] ?? "";
    const marker = fullMatch.slice(prefix.length);
    return {
      index: (match.index ?? 0) + prefix.length,
      marker
    };
  });

  if (markers.length === 0) {
    const todo = sanitizeTodoSegment(remainder);
    return todo ? [todo] : [];
  }

  const todos: string[] = [];
  const leading = sanitizeTodoSegment(remainder.slice(0, markers[0]?.index ?? 0));
  if (leading) {
    todos.push(leading);
  }

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const start = marker.index + marker.marker.length;
    const end = index + 1 < markers.length ? markers[index + 1].index : remainder.length;
    const todo = sanitizeTodoSegment(remainder.slice(start, end));
    if (todo) {
      todos.push(todo);
    }
  }

  return todos;
}

function chooseTodos(modelTodos: string[], fallbackTodos: string[]): string[] {
  if (modelTodos.length === 0) {
    return fallbackTodos;
  }

  if (fallbackTodos.length === 0) {
    return modelTodos;
  }

  const mergedNumberedTask = modelTodos.some((todo) => /第[一二三四五六七八九十\d]+件事情/u.test(todo));
  if (mergedNumberedTask) {
    return fallbackTodos;
  }

  if (fallbackTodos.length > modelTodos.length) {
    return fallbackTodos;
  }

  return modelTodos;
}

function sanitizeTodoSegment(input: string): string {
  return input
    .replace(/^[，。！？!?；;、,:：\s]+/u, "")
    .replace(/[，。！？!?；;]+$/u, "")
    .replace(/要去/u, "去")
    .replace(/^(?:就是|要|需要|先|再|然后)/u, "")
    .trim();
}

function sanitizeSummary(input: string): string {
  const normalized = input.trim().replace(/\s+/g, " ");
  return normalized || "未生成摘要。";
}

function sanitizeText(input: string, maxLength: number): string {
  return input.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function toSummary(rawText: string): string {
  const normalized = rawText.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "未识别到有效内容。";
  }

  const firstSentence = normalized.split(/(?<=[。！？!?])/u)[0];
  const summary = firstSentence || normalized;
  return summary.slice(0, 120);
}

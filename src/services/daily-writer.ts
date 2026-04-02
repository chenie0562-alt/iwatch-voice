import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StructuredEntry } from "../types.js";

type DailyEntryContext = {
  timestamp: Date;
  displayDate?: string;
  displayTime?: string;
  sourcePath?: string;
};

export class DailyWriter {
  constructor(
    private readonly dailyDir: string,
    private readonly timezone = "Asia/Shanghai"
  ) {}

  async append(entry: StructuredEntry, context: DailyEntryContext): Promise<string> {
    await mkdir(this.dailyDir, { recursive: true });

    const fileName = `${context.displayDate ?? formatDate(context.timestamp, this.timezone)}.md`;
    const notePath = path.join(this.dailyDir, fileName);
    const existing = await readIfExists(notePath);
    const block = renderEntry(entry, context, this.timezone);
    const next = existing ? `${existing.trimEnd()}\n\n${block}\n` : `${block}\n`;
    const tempPath = `${notePath}.tmp`;

    await writeFile(tempPath, next, "utf8");
    await rename(tempPath, notePath);

    return notePath;
  }
}

function renderEntry(entry: StructuredEntry, context: DailyEntryContext, timezone: string): string {
  const lines = [
    `## ${context.displayTime ?? formatTime(context.timestamp, timezone)} - ${entry.title}`,
    ""
  ];

  if (context.sourcePath) {
    const sourceName = path.basename(context.sourcePath);
    lines.push("### 录音", `[${sourceName}](${toFileUrl(context.sourcePath)})`, "");
  }

  lines.push("### 摘要", entry.summary);

  if (entry.todos.length > 0) {
    lines.push("", "### 待办", ...entry.todos.map((todo) => `- [ ] ${todo}`));
  }

  lines.push("", "### 原文", entry.raw_text);
  return lines.join("\n");
}

async function readIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function toFileUrl(filePath: string): string {
  return `file://${encodeURI(filePath)}`;
}

function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

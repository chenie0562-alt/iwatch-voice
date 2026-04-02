import "dotenv/config";

import path from "node:path";

import type { AppConfig } from "./types.js";

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const root = process.cwd();
  const watchFolder = env("WATCH_FOLDER", path.join(root, "runtime", "inbox"));
  const archiveFolder = env("ARCHIVE_FOLDER", path.join(root, "runtime", "archive"));
  const failedFolder = env("FAILED_FOLDER", path.join(root, "runtime", "failed"));

  return {
    doubaoApiKey: env("DOUBAO_API_KEY"),
    doubaoAsrAppId: env("DOUBAO_ASR_APP_ID"),
    doubaoAsrAccessToken: env("DOUBAO_ASR_ACCESS_TOKEN"),
    doubaoAsrResourceId: env("DOUBAO_ASR_RESOURCE_ID", "volc.bigasr.auc_turbo"),
    doubaoTextModel: env("DOUBAO_TEXT_MODEL"),
    watchFolder,
    archiveFolder,
    failedFolder,
    obsidianDailyDir: env("OBSIDIAN_DAILY_DIR", path.join(root, "runtime", "daily")),
    stateDbPath: env("STATE_DB_PATH", path.join(root, "runtime", "state.sqlite")),
    timezone: env("TIMEZONE", "Asia/Shanghai"),
    doubaoAsrUrl: env(
      "DOUBAO_ASR_URL",
      "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash"
    ),
    doubaoTextBaseUrl: env(
      "DOUBAO_TEXT_BASE_URL",
      "https://operator.las.cn-beijing.volces.com"
    ),
    pollIntervalMs: Number.parseInt(env("POLL_INTERVAL_MS", "5000"), 10),
    ffmpegPath: env("FFMPEG_PATH", "ffmpeg"),
    voiceMemosShortcutEnabled: (process.env.VOICE_MEMOS_SHORTCUT_ENABLED ?? "false") === "true",
    voiceMemosShortcutName: process.env.VOICE_MEMOS_SHORTCUT_NAME ?? null,
    preserveSourceFiles: (process.env.PRESERVE_SOURCE_FILES ?? "true") === "true",
    remindersEnabled: (process.env.REMINDERS_ENABLED ?? "true") === "true",
    remindersListName: env("REMINDERS_LIST_NAME", "工作"),
    remindersTriggerKeywords: env("REMINDERS_TRIGGER_KEYWORDS", "待办事项")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

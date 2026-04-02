import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VoiceSyncService } from "../src/services/voice-sync-service.js";
import { ProcessingStore } from "../src/storage/processing-store.js";
import type { AppConfig } from "../src/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

function makeConfig(root: string): AppConfig {
  return {
    doubaoApiKey: "test-key",
    doubaoAsrAppId: "test-app",
    doubaoAsrAccessToken: "test-token",
    doubaoAsrResourceId: "test-resource",
    doubaoTextModel: "test-model",
    watchFolder: path.join(root, "watch"),
    archiveFolder: path.join(root, "archive"),
    failedFolder: path.join(root, "failed"),
    obsidianDailyDir: path.join(root, "daily"),
    stateDbPath: path.join(root, "state.sqlite"),
    timezone: "Asia/Shanghai",
    doubaoAsrUrl: "https://example.com/asr",
    doubaoTextBaseUrl: "https://example.com/text",
    pollIntervalMs: 1,
    ffmpegPath: "/usr/bin/false",
    voiceMemosShortcutEnabled: false,
    voiceMemosShortcutName: null,
    preserveSourceFiles: true,
    remindersEnabled: true,
    remindersListName: "工作",
    remindersTriggerKeywords: ["待办事项"]
  };
}

describe("VoiceSyncService reminders integration", () => {
  it("creates reminders only when the raw text includes the trigger keyword", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "voice-sync-reminders-"));
    tempDirs.push(root);

    const store = await ProcessingStore.open(path.join(root, "state.sqlite"));
    const service = new VoiceSyncService(makeConfig(root), store) as any;
    const addMissing = vi.fn().mockResolvedValue({ created: ["待会口播"], skipped: [] });

    service.reminders = { addMissing };

    await service.syncReminders({
      todos: ["待会口播"],
      raw_text: "今日待办事项：待会口播"
    });
    await service.syncReminders({
      todos: ["晚上吃饭"],
      raw_text: "晚上吃饭"
    });
    await service.syncReminders({
      todos: [],
      raw_text: "待办事项："
    });

    await store.close();

    expect(addMissing).toHaveBeenCalledTimes(1);
    expect(addMissing).toHaveBeenCalledWith(["待会口播"]);
  });
});

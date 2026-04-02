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

describe("VoiceSyncService", () => {
  it("processes only the latest file whose filename matches today", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "voice-sync-"));
    tempDirs.push(root);

    const store = await ProcessingStore.open(path.join(root, "state.sqlite"));
    const service = new VoiceSyncService(makeConfig(root), store) as any;

    const sync = vi.fn().mockResolvedValue(undefined);
    const nextBatch = vi.fn().mockResolvedValue([
      "/tmp/20260401 223010-A35BE115.m4a",
      "/tmp/20260402 120136-FF9CC090.m4a",
      "/tmp/20260402 125648-30A5A347.m4a",
      "/tmp/20260402 132740-3E0E3198.m4a"
    ]);
    const markUnseen = vi.fn();
    const processFile = vi.fn().mockResolvedValue(undefined);

    service.importer = { sync };
    service.watcher = { nextBatch, markUnseen };
    service.processFile = processFile;

    await service.pollOnce();
    await store.close();

    expect(sync).toHaveBeenCalledTimes(1);
    expect(processFile).toHaveBeenCalledTimes(1);
    expect(processFile).toHaveBeenCalledWith("/tmp/20260402 132740-3E0E3198.m4a");
    expect(markUnseen).toHaveBeenCalledTimes(2);
    expect(markUnseen).toHaveBeenCalledWith("/tmp/20260402 120136-FF9CC090.m4a");
    expect(markUnseen).toHaveBeenCalledWith("/tmp/20260402 125648-30A5A347.m4a");
    expect(markUnseen).not.toHaveBeenCalledWith("/tmp/20260401 223010-A35BE115.m4a");
  });
});

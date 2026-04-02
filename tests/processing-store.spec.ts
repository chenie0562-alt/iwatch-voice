import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ProcessingStore } from "../src/storage/processing-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("ProcessingStore", () => {
  it("persists processed hashes and prevents duplicate processing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "store-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "state.sqlite");

    const store = await ProcessingStore.open(dbPath);
    await store.markSucceeded({
      hash: "abc123",
      sourcePath: "/tmp/input.m4a",
      archivePath: "/tmp/archive/input.m4a",
      dailyNotePath: "/tmp/2026-04-02.md",
      title: "搭建语音日记服务"
    });

    const existing = await store.getByHash("abc123");
    await store.close();

    const reopened = await ProcessingStore.open(dbPath);
    const persisted = await reopened.getByHash("abc123");
    await reopened.close();

    expect(existing?.status).toBe("succeeded");
    expect(persisted?.daily_note_path).toBe("/tmp/2026-04-02.md");
    expect(persisted?.title).toBe("搭建语音日记服务");
  });
});

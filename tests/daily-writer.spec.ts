import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DailyWriter } from "../src/services/daily-writer.js";
import type { StructuredEntry } from "../src/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }));
  }
});

describe("DailyWriter", () => {
  it("writes a Chinese daily entry and omits todos when there are none", async () => {
    const dailyDir = await mkdtemp(path.join(os.tmpdir(), "daily-"));
    tempDirs.push(dailyDir);
    const writer = new DailyWriter(dailyDir);
    const entry: StructuredEntry = {
      title: "搭建语音日记服务",
      summary: "今天确定了双阶段处理方案，先转写再结构化。",
      todos: [],
      raw_text: "今天确定了双阶段处理方案，先转写再结构化。"
    };

    const notePath = await writer.append(entry, {
      timestamp: new Date("2026-04-02T09:41:00+08:00"),
      displayDate: "2026-04-02",
      displayTime: "13:27",
      sourcePath: "/Users/chenie/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/20260402 132740-3E0E3198.m4a"
    });
    const contents = await readFile(notePath, "utf8");

    expect(path.basename(notePath)).toBe("2026-04-02.md");
    expect(contents).toContain("## 13:27 - 搭建语音日记服务");
    expect(contents).toContain(
      "### 录音\n[20260402 132740-3E0E3198.m4a](file:///Users/chenie/Library/Group%20Containers/group.com.apple.VoiceMemos.shared/Recordings/20260402%20132740-3E0E3198.m4a)"
    );
    expect(contents).toContain("### 摘要");
    expect(contents).toContain("### 原文");
    expect(contents).not.toContain("### 待办");
  });

  it("appends later entries to the same daily note", async () => {
    const dailyDir = await mkdtemp(path.join(os.tmpdir(), "daily-"));
    tempDirs.push(dailyDir);
    const writer = new DailyWriter(dailyDir);
    const morning: StructuredEntry = {
      title: "先做转写",
      summary: "先把 ASR 打通。",
      todos: ["验证接口"],
      raw_text: "先把 ASR 打通。"
    };
    const evening: StructuredEntry = {
      title: "再做结构化",
      summary: "把原文转成标题和摘要。",
      todos: [],
      raw_text: "把原文转成标题和摘要。"
    };

    const notePath = await writer.append(morning, {
      timestamp: new Date("2026-04-02T09:41:00+08:00"),
      displayDate: "2026-04-02",
      displayTime: "09:41",
      sourcePath: "/tmp/20260402 094100-AAAA1111.m4a"
    });
    await writer.append(evening, {
      timestamp: new Date("2026-04-02T20:15:00+08:00"),
      displayDate: "2026-04-02",
      displayTime: "20:15",
      sourcePath: "/tmp/20260402 201500-BBBB2222.m4a"
    });
    const contents = await readFile(notePath, "utf8");

    expect(contents).toContain("## 09:41 - 先做转写");
    expect(contents).toContain("## 20:15 - 再做结构化");
  });
});

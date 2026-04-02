import { describe, expect, it } from "vitest";

import { buildFallbackStructuredEntry, parseStructuredEntry } from "../src/services/structuring.js";

describe("parseStructuredEntry", () => {
  it("parses valid JSON returned by the structuring model", () => {
    const rawText = "今天想到要把语音备忘录自动转成 Obsidian 日记，还要接入豆包。";
    const result = parseStructuredEntry(
      JSON.stringify({
        title: "搭建语音日记服务",
        summary: "记录了把语音备忘录自动转写并写入 Obsidian 的想法。",
        todos: ["验证豆包 ASR", "补上 Daily 写入"],
        raw_text: rawText
      }),
      rawText
    );

    expect(result).toEqual({
      title: "搭建语音日记服务",
      summary: "记录了把语音备忘录自动转写并写入 Obsidian 的想法。",
      todos: ["验证豆包 ASR", "补上 Daily 写入"],
      raw_text: rawText
    });
  });

  it("falls back to a safe structured entry when model output is invalid", () => {
    const rawText = "嗯我今天想到先把录音导出来，再接豆包，最后写到 daily 里面。";

    const result = buildFallbackStructuredEntry(rawText);

    expect(result.title.length).toBeGreaterThan(0);
    expect(result.title.length).toBeLessThanOrEqual(18);
    expect(result.summary).toContain("先把录音导出来");
    expect(result.todos).toEqual([]);
    expect(result.raw_text).toBe(rawText);
  });

  it("infers todos from raw text when model output leaves todos empty", () => {
    const rawText =
      "我今天下午主要做几件事情。第一个是待会要去口播，第二个就是把今天上午说要做的客服项目的话完成。第三个就是总结。";

    const result = parseStructuredEntry(
      JSON.stringify({
        title: "下午安排",
        summary: "今天下午主要有几件事要处理。",
        todos: [],
        raw_text: rawText
      }),
      rawText
    );

    expect(result.todos).toEqual(["待会去口播", "把今天上午说要做的客服项目的话完成", "总结"]);
  });

  it("infers todos from raw text with 第一件事情 phrasing", () => {
    const rawText =
      "今天下午主要有三件事情。第一件事情待会录口播，第二件事情就是去 爬山，第三件事情就是 回家吃饭。";

    const result = parseStructuredEntry(
      JSON.stringify({
        title: "下午安排",
        summary: "今天下午主要有三件事情。",
        todos: [],
        raw_text: rawText
      }),
      rawText
    );

    expect(result.todos).toEqual(["待会录口播", "去 爬山", "回家吃饭"]);
  });

  it("prefers fallback todos when model todos merge multiple numbered tasks together", () => {
    const rawText =
      "今天下午有三件事情。第一件事情是待会口播，第二件事情是待会改客服的代码，第三件事情是晚上吃饭。";

    const result = parseStructuredEntry(
      JSON.stringify({
        title: "下午安排",
        summary: "今天下午有三件事情。",
        todos: ["待会口播，第二件事情是待会改客服的代码", "晚上吃饭"],
        raw_text: rawText
      }),
      rawText
    );

    expect(result.todos).toEqual(["待会口播", "待会改客服的代码", "晚上吃饭"]);
  });

  it("infers todos from raw text with 一是二是 phrasing", () => {
    const rawText = "今日待办事项，一是晚上回去吃饭。二是晚上早点休息。";

    const result = parseStructuredEntry(
      JSON.stringify({
        title: "今日待办事项",
        summary: "今晚有两件待办。",
        todos: [],
        raw_text: rawText
      }),
      rawText
    );

    expect(result.todos).toEqual(["晚上回去吃饭", "晚上早点休息"]);
  });

  it("infers a single todo from trigger phrasing without numbering", () => {
    const rawText = "待办事项，明天下午2点开会。";

    const result = parseStructuredEntry(
      JSON.stringify({
        title: "待办事项",
        summary: "明天下午有一个会议。",
        todos: [],
        raw_text: rawText
      }),
      rawText
    );

    expect(result.todos).toEqual(["明天下午2点开会"]);
  });

  it("infers a single todo when the trigger keyword is followed by a full stop", () => {
    const rawText = "待办事项。晚上跳绳。";

    const result = parseStructuredEntry(
      JSON.stringify({
        title: "待办事项",
        summary: "今晚要跳绳。",
        todos: [],
        raw_text: rawText
      }),
      rawText
    );

    expect(result.todos).toEqual(["晚上跳绳"]);
  });

  it("splits multiple todos after the trigger keyword when later items are numbered", () => {
    const rawText = "待办事项，今天晚上跳绳。第二是明天下午2点开会。";

    const result = parseStructuredEntry(
      JSON.stringify({
        title: "待办事项",
        summary: "今晚跳绳，明天下午开会。",
        todos: [],
        raw_text: rawText
      }),
      rawText
    );

    expect(result.todos).toEqual(["今天晚上跳绳", "明天下午2点开会"]);
  });
});

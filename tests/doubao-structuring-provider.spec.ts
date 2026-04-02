import { describe, expect, it, vi, afterEach } from "vitest";

import { DoubaoStructuringProvider } from "../src/providers/doubao-structuring-provider.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DoubaoStructuringProvider", () => {
  it("sends a system prompt that prioritizes extracting actionable todos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "下午安排",
                summary: "今天下午主要有三件事情。",
                todos: ["待会录口播", "去爬山", "回家吃饭"],
                raw_text: "今天下午主要有三件事情。"
              })
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new DoubaoStructuringProvider({
      apiKey: "test-key",
      model: "test-model",
      baseUrl: "https://example.com"
    });

    await provider.format("今天下午主要有三件事情。", "2026-04-02T14:42:08+08:00");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    const systemPrompt = body.messages[0].content as string;

    expect(systemPrompt).toContain("todos 是核心输出");
    expect(systemPrompt).toContain("优先提取明确行动项");
    expect(systemPrompt).toContain("第一件事情");
    expect(systemPrompt).toContain("待会录口播");
  });
});

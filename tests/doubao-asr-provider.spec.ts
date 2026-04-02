import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DoubaoAsrProvider } from "../src/providers/doubao-asr-provider.js";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("DoubaoAsrProvider", () => {
  it("uses APP ID and Access Token headers for flash recognition", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "doubao-asr-"));
    tempDirs.push(dir);
    const audioPath = path.join(dir, "sample.mp3");
    await writeFile(audioPath, Buffer.from("hello-audio"));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          text: "测试转写结果"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new DoubaoAsrProvider({
      appId: "9428628243",
      accessToken: "test-access-token",
      resourceId: "volc.bigasr.auc_turbo",
      endpoint: "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash"
    });

    const text = await provider.transcribe(audioPath);

    expect(text).toBe("测试转写结果");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    const body = JSON.parse(options.body as string);

    expect(headers["X-Api-App-Key"]).toBe("9428628243");
    expect(headers["X-Api-Access-Key"]).toBe("test-access-token");
    expect(headers["X-Api-Resource-Id"]).toBe("volc.bigasr.auc_turbo");
    expect(body.user.uid).toBe("9428628243");
    expect(body.audio.data).toBe(Buffer.from("hello-audio").toString("base64"));
  });
});

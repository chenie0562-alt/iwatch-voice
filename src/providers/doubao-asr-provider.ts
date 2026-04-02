import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

type DoubaoAsrOptions = {
  appId: string;
  accessToken: string;
  resourceId: string;
  endpoint: string;
};

type DoubaoAsrResponse = {
  result?: {
    text?: string;
  };
};

export class DoubaoAsrProvider {
  constructor(private readonly options: DoubaoAsrOptions) {}

  async transcribe(filePath: string): Promise<string> {
    const audio = await readFile(filePath);
    const response = await fetch(this.options.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-App-Key": this.options.appId,
        "X-Api-Access-Key": this.options.accessToken,
        "X-Api-Resource-Id": this.options.resourceId,
        "X-Api-Request-Id": randomUUID(),
        "X-Api-Sequence": "-1"
      },
      body: JSON.stringify({
        user: {
          uid: this.options.appId
        },
        audio: {
          data: audio.toString("base64")
        },
        request: {
          model_name: "bigmodel"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Doubao ASR request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as DoubaoAsrResponse;
    const text = payload.result?.text?.trim();

    if (!text) {
      throw new Error("Doubao ASR returned empty text");
    }

    return text;
  }
}

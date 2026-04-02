import type { StructuredEntry } from "../types.js";
import { buildFallbackStructuredEntry, parseStructuredEntry } from "../services/structuring.js";

type DoubaoStructuringOptions = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const SYSTEM_PROMPT = `你是语音笔记整理助手。输入是一段中文口语转写文本。
请将其整理为 JSON，字段固定为 title、summary、todos、raw_text。

要求：
1. 只返回 JSON，不要包含 markdown、解释或代码块。
2. title 用中文短标题，10到20字以内，适合日记回看。
3. summary 用中文总结 1 到 3 句，不要空话，不要编造事实。
4. todos 是核心输出，优先提取明确行动项。只要原文里出现“要做 / 待会 / 之后 / 第一件事情 / 第二件事情 / 第三个 / 去做 / 完成 / 处理 / 记得 / 安排”这类可执行事项，就应尽量写入 todos。
5. todos 每一项都要是简短、可执行、可勾选的短句，不要照抄整段原话，不要带“第一件事情”“第二件事情”这类编号前缀。
6. 如果原文明确描述了 1 个或多个待办，不要返回空数组。只有完全没有可执行事项时才返回空数组。
7. raw_text 必须保留原始输入内容，不可改写。

示例：
输入：今天下午主要有三件事情。第一件事情待会录口播，第二件事情就是去爬山，第三件事情就是回家吃饭。
输出：{"title":"下午安排","summary":"今天下午主要有三件事情。","todos":["待会录口播","去爬山","回家吃饭"],"raw_text":"保持原文"}

输入：今天想到产品方向还不错，整体继续推进。
输出：{"title":"产品方向记录","summary":"记录了对产品方向的判断。","todos":[],"raw_text":"保持原文"}`;

export class DoubaoStructuringProvider {
  constructor(private readonly options: DoubaoStructuringOptions) {}

  async format(rawText: string, timestamp: string): Promise<StructuredEntry> {
    const response = await fetch(`${this.options.baseUrl}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              timestamp,
              raw_text: rawText
            })
          }
        ],
        temperature: 0.2,
        response_format: {
          type: "json_object"
        }
      })
    });

    if (!response.ok) {
      return buildFallbackStructuredEntry(rawText);
    }

    const payload = (await response.json()) as ChatResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      return buildFallbackStructuredEntry(rawText);
    }

    try {
      return parseStructuredEntry(content, rawText);
    } catch {
      return buildFallbackStructuredEntry(rawText);
    }
  }
}

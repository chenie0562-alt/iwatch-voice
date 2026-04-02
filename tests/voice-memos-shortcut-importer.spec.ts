import { describe, expect, it, vi } from "vitest";

import { VoiceMemosShortcutImporter } from "../src/services/voice-memos-shortcut-importer.js";

describe("VoiceMemosShortcutImporter", () => {
  it("runs the configured shortcut when enabled", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const importer = new VoiceMemosShortcutImporter({
      enabled: true,
      shortcutName: "导出语音备忘录到 Inbox"
    }, run);

    await importer.sync();

    expect(run).toHaveBeenCalledWith("导出语音备忘录到 Inbox");
  });

  it("does nothing when shortcut sync is disabled", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const importer = new VoiceMemosShortcutImporter({
      enabled: false,
      shortcutName: "导出语音备忘录到 Inbox"
    }, run);

    await importer.sync();

    expect(run).not.toHaveBeenCalled();
  });
});

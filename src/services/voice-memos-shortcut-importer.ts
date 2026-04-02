import { execFile } from "node:child_process";

type VoiceMemosShortcutImporterOptions = {
  enabled: boolean;
  shortcutName: string | null;
};

type ShortcutRunner = (shortcutName: string) => Promise<void>;

export class VoiceMemosShortcutImporter {
  constructor(
    private readonly options: VoiceMemosShortcutImporterOptions,
    private readonly runShortcut: ShortcutRunner = defaultShortcutRunner
  ) {}

  async sync(): Promise<void> {
    if (!this.options.enabled || !this.options.shortcutName) {
      return;
    }

    await this.runShortcut(this.options.shortcutName);
  }
}

async function defaultShortcutRunner(shortcutName: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile("/usr/bin/shortcuts", ["run", shortcutName], (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

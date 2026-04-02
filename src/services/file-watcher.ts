import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".m4a", ".mp3", ".mp4", ".wav", ".ogg"]);

export class FileWatcher {
  private readonly seen = new Set<string>();

  constructor(private readonly watchDir: string) {}

  async nextBatch(): Promise<string[]> {
    return this.scanDir(this.watchDir);
  }

  async scanDir(targetDir: string): Promise<string[]> {
    await mkdir(targetDir, { recursive: true });
    const entries = await readdir(targetDir, { withFileTypes: true });
    const pending = entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(targetDir, entry.name))
      .filter((filePath) => SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
      .filter((filePath) => !this.seen.has(filePath));

    pending.forEach((filePath) => this.seen.add(filePath));
    return pending;
  }

  async allFiles(targetDir: string): Promise<string[]> {
    await mkdir(targetDir, { recursive: true });
    const entries = await readdir(targetDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(targetDir, entry.name))
      .filter((filePath) => SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()));
  }

  markUnseen(filePath: string): void {
    this.seen.delete(filePath);
  }
}

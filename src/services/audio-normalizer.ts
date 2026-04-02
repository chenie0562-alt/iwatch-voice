import { access, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export class AudioNormalizer {
  constructor(private readonly ffmpegPath: string) {}

  async normalize(inputPath: string): Promise<string> {
    await access(inputPath);
    const dir = await mkdtemp(path.join(os.tmpdir(), "iwatch-voice-"));
    const outputPath = path.join(dir, `${path.basename(inputPath, path.extname(inputPath))}.mp3`);

    await run(this.ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-codec:a",
      "libmp3lame",
      outputPath
    ]);

    return outputPath;
  }
}

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(" ")} (exit ${code ?? "unknown"})`));
    });
  });
}

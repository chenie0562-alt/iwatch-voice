import { appendFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import type { StructuredEntry, AppConfig } from "../types.js";
import { DailyWriter } from "./daily-writer.js";
import { FileArchiver } from "./file-archiver.js";
import { FileWatcher } from "./file-watcher.js";
import { sha256File } from "./hash.js";
import { ProcessingStore } from "../storage/processing-store.js";
import { AudioNormalizer } from "./audio-normalizer.js";
import { DoubaoAsrProvider } from "../providers/doubao-asr-provider.js";
import { DoubaoStructuringProvider } from "../providers/doubao-structuring-provider.js";
import { RemindersWriter } from "./reminders-writer.js";
import { VoiceMemosShortcutImporter } from "./voice-memos-shortcut-importer.js";

export class VoiceSyncService {
  private readonly watcher: FileWatcher;
  private readonly normalizer: AudioNormalizer;
  private readonly asr: DoubaoAsrProvider;
  private readonly structurer: DoubaoStructuringProvider;
  private readonly writer: DailyWriter;
  private readonly archiver: FileArchiver;
  private readonly importer: VoiceMemosShortcutImporter;
  private readonly reminders: RemindersWriter;

  constructor(
    private readonly config: AppConfig,
    private readonly store: ProcessingStore
  ) {
    this.watcher = new FileWatcher(config.watchFolder);
    this.normalizer = new AudioNormalizer(config.ffmpegPath);
    this.asr = new DoubaoAsrProvider({
      appId: config.doubaoAsrAppId,
      accessToken: config.doubaoAsrAccessToken,
      resourceId: config.doubaoAsrResourceId,
      endpoint: config.doubaoAsrUrl
    });
    this.structurer = new DoubaoStructuringProvider({
      apiKey: config.doubaoApiKey,
      model: config.doubaoTextModel,
      baseUrl: config.doubaoTextBaseUrl
    });
    this.writer = new DailyWriter(config.obsidianDailyDir, config.timezone);
    this.archiver = new FileArchiver(config.archiveFolder, config.failedFolder, {
      preserveSourceFiles: config.preserveSourceFiles
    });
    this.importer = new VoiceMemosShortcutImporter({
      enabled: config.voiceMemosShortcutEnabled,
      shortcutName: config.voiceMemosShortcutName
    });
    this.reminders = new RemindersWriter({
      enabled: config.remindersEnabled,
      listName: config.remindersListName,
      triggerKeywords: config.remindersTriggerKeywords
    });
  }

  async watch(): Promise<void> {
    for (;;) {
      await this.pollOnce();
      await sleep(this.config.pollIntervalMs);
    }
  }

  async pollOnce(): Promise<void> {
    await this.importer.sync().catch(() => undefined);
    const files = (await this.watcher.nextBatch()).filter((file) => this.isTodayFile(file));
    if (files.length === 0) {
      return;
    }

    const latestFile = [...files].sort().at(-1);
    if (!latestFile) {
      return;
    }

    for (const file of files) {
      if (file !== latestFile) {
        this.watcher.markUnseen(file);
      }
    }

    await this.processFile(latestFile).catch(() => undefined);
  }

  async backfill(): Promise<void> {
    await this.importer.sync().catch(() => undefined);
    const files = await this.watcher.allFiles(this.config.watchFolder);
    for (const file of files) {
      await this.processFile(file).catch(() => undefined);
    }
  }

  async replayFailed(): Promise<void> {
    const files = await this.watcher.allFiles(this.config.failedFolder);
    for (const file of files) {
      await this.processFile(file).catch(() => undefined);
    }
  }

  async processFile(filePath: string): Promise<void> {
    const hash = await sha256File(filePath);
    const existing = await this.store.getByHash(hash);
    if (existing?.status === "succeeded") {
      return;
    }

    await this.store.markProcessing(hash, filePath);

    try {
      const normalizedPath = await this.normalizer.normalize(filePath);
      const rawText = await this.asr.transcribe(normalizedPath);
      const recordedAt = await this.getRecordedAt(filePath);
      const structured = await this.structurer.format(rawText, recordedAt.toISOString());
      await this.syncReminders(structured).catch((error) => this.logReminderFailure(error));
      const dailyNotePath = await this.writer.append(structured, {
        timestamp: recordedAt,
        displayDate: this.getRecordedDateFromName(filePath),
        displayTime: this.getRecordedTimeFromName(filePath),
        sourcePath: filePath
      });
      const archivePath = await this.archiver.archive(filePath);

      await this.store.markSucceeded({
        hash,
        sourcePath: filePath,
        archivePath,
        dailyNotePath,
        title: structured.title
      });
      await this.log(`processed ${filePath} -> ${dailyNotePath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.archiver.moveToFailed(filePath).catch(() => undefined);
      await this.store.markFailed({ hash, sourcePath: filePath, errorMessage: message });
      this.watcher.markUnseen(filePath);
      await this.log(`failed ${filePath}: ${message}`);
      throw error;
    }
  }

  private async log(message: string): Promise<void> {
    await mkdir("runtime", { recursive: true });
    await appendFile("runtime/service.log", `${new Date().toISOString()} ${message}\n`, "utf8");
  }

  async syncReminders(entry: Pick<StructuredEntry, "todos" | "raw_text">): Promise<void> {
    if (!this.shouldCreateReminders(entry.raw_text)) {
      await this.log("reminders skipped: trigger keyword not found");
      return;
    }

    if (entry.todos.length === 0) {
      await this.log("reminders skipped: no todos extracted");
      return;
    }

    const result = await this.reminders.addMissing(entry.todos);
    if (result.created.length > 0) {
      await this.log(`reminders created: ${result.created.join(", ")}`);
    }
    if (result.skipped.length > 0) {
      await this.log(`reminders skipped duplicates: ${result.skipped.join(", ")}`);
    }
  }

  private shouldCreateReminders(rawText: string): boolean {
    if (!this.config.remindersEnabled) {
      return false;
    }

    return this.config.remindersTriggerKeywords.some((keyword) => rawText.includes(keyword));
  }

  private async logReminderFailure(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.log(`reminders failed: ${message}`);
  }

  private isTodayFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const now = new Date();
    const todayPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")} `;
    return fileName.startsWith(todayPrefix);
  }

  private async getRecordedAt(filePath: string): Promise<Date> {
    const fromName = this.getRecordedDateTimeFromName(filePath);
    if (fromName) {
      return fromName;
    }

    const fileStat = await stat(filePath);
    return fileStat.mtime;
  }

  private getRecordedDateFromName(filePath: string): string | undefined {
    const match = path.basename(filePath).match(/^(\d{4})(\d{2})(\d{2}) \d{6}-/);
    if (!match) {
      return undefined;
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  private getRecordedTimeFromName(filePath: string): string | undefined {
    const match = path.basename(filePath).match(/^\d{8} (\d{2})(\d{2})\d{2}-/);
    if (!match) {
      return undefined;
    }
    return `${match[1]}:${match[2]}`;
  }

  private getRecordedDateTimeFromName(filePath: string): Date | null {
    const match = path.basename(filePath).match(/^(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})(\d{2})-/);
    if (!match) {
      return null;
    }

    const [, year, month, day, hour, minute, second] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`);
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import type {
  ProcessFailureInput,
  ProcessingRecord,
  ProcessSuccessInput
} from "../types.js";

export class ProcessingStore {
  private constructor(private readonly db: DatabaseSync) {}

  static async open(dbPath: string): Promise<ProcessingStore> {
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    const store = new ProcessingStore(db);
    store.migrate();
    return store;
  }

  async getByHash(hash: string): Promise<ProcessingRecord | null> {
    const row = this.db
      .prepare(
        `SELECT hash, source_path, archive_path, daily_note_path, title, status, processed_at, error_message
         FROM processing_records WHERE hash = ?`
      )
      .get(hash) as ProcessingRecord | undefined;

    return row ?? null;
  }

  async markProcessing(hash: string, sourcePath: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO processing_records(hash, source_path, status)
         VALUES (?, ?, 'processing')
         ON CONFLICT(hash) DO UPDATE SET source_path = excluded.source_path, status = 'processing', error_message = NULL`
      )
      .run(hash, sourcePath);
  }

  async markSucceeded(input: ProcessSuccessInput): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO processing_records(hash, source_path, archive_path, daily_note_path, title, status, processed_at, error_message)
         VALUES (?, ?, ?, ?, ?, 'succeeded', CURRENT_TIMESTAMP, NULL)
         ON CONFLICT(hash) DO UPDATE SET
           source_path = excluded.source_path,
           archive_path = excluded.archive_path,
           daily_note_path = excluded.daily_note_path,
           title = excluded.title,
           status = 'succeeded',
           processed_at = CURRENT_TIMESTAMP,
           error_message = NULL`
      )
      .run(input.hash, input.sourcePath, input.archivePath, input.dailyNotePath, input.title);
  }

  async markFailed(input: ProcessFailureInput): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO processing_records(hash, source_path, status, processed_at, error_message)
         VALUES (?, ?, 'failed', CURRENT_TIMESTAMP, ?)
         ON CONFLICT(hash) DO UPDATE SET
           source_path = excluded.source_path,
           status = 'failed',
           processed_at = CURRENT_TIMESTAMP,
           error_message = excluded.error_message`
      )
      .run(input.hash, input.sourcePath, input.errorMessage);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processing_records (
        hash TEXT PRIMARY KEY,
        source_path TEXT NOT NULL,
        archive_path TEXT,
        daily_note_path TEXT,
        title TEXT,
        status TEXT NOT NULL,
        processed_at TEXT,
        error_message TEXT
      );
    `);
  }
}

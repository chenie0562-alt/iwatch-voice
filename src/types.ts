export type StructuredEntry = {
  title: string;
  summary: string;
  todos: string[];
  raw_text: string;
};

export type ProcessStatus = "processing" | "succeeded" | "failed";

export type ProcessingRecord = {
  hash: string;
  source_path: string;
  archive_path: string | null;
  daily_note_path: string | null;
  title: string | null;
  status: ProcessStatus;
  processed_at: string | null;
  error_message: string | null;
};

export type ProcessSuccessInput = {
  hash: string;
  sourcePath: string;
  archivePath: string;
  dailyNotePath: string;
  title: string;
};

export type ProcessFailureInput = {
  hash: string;
  sourcePath: string;
  errorMessage: string;
};

export type AppConfig = {
  doubaoApiKey: string;
  doubaoAsrAppId: string;
  doubaoAsrAccessToken: string;
  doubaoAsrResourceId: string;
  doubaoTextModel: string;
  watchFolder: string;
  archiveFolder: string;
  failedFolder: string;
  obsidianDailyDir: string;
  stateDbPath: string;
  timezone: string;
  doubaoAsrUrl: string;
  doubaoTextBaseUrl: string;
  pollIntervalMs: number;
  ffmpegPath: string;
  voiceMemosShortcutEnabled: boolean;
  voiceMemosShortcutName: string | null;
  preserveSourceFiles: boolean;
  remindersEnabled: boolean;
  remindersListName: string;
  remindersTriggerKeywords: string[];
};

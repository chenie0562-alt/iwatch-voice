import { loadConfig } from "./config.js";
import { ProcessingStore } from "./storage/processing-store.js";
import { VoiceSyncService } from "./services/voice-sync-service.js";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "watch";
  const target = process.argv[3];
  const config = loadConfig();
  const store = await ProcessingStore.open(config.stateDbPath);
  const service = new VoiceSyncService(config, store);

  try {
    if (command === "watch") {
      await service.watch();
      return;
    }

    if (command === "process") {
      if (!target) {
        throw new Error("Usage: npm run process -- <audio-file>");
      }
      await service.processFile(target);
      return;
    }

    if (command === "backfill") {
      await service.backfill();
      return;
    }

    if (command === "replay") {
      await service.replayFailed();
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } finally {
    await store.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

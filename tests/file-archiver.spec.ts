import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { FileArchiver } from "../src/services/file-archiver.js";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("FileArchiver", () => {
  it("copies the source file into archive when preserveSourceFiles is enabled", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "archiver-"));
    tempDirs.push(root);
    const sourceDir = path.join(root, "source");
    const archiveDir = path.join(root, "archive");
    const failedDir = path.join(root, "failed");
    await import("node:fs/promises").then((fs) => fs.mkdir(sourceDir, { recursive: true }));

    const sourcePath = path.join(sourceDir, "recording.m4a");
    await writeFile(sourcePath, "voice-bytes", "utf8");

    const archiver = new FileArchiver(archiveDir, failedDir, { preserveSourceFiles: true });
    const archivedPath = await archiver.archive(sourcePath);

    await expect(access(sourcePath)).resolves.toBeUndefined();
    await expect(readFile(archivedPath, "utf8")).resolves.toBe("voice-bytes");
  });
});

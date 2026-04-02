import { copyFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

type FileArchiverOptions = {
  preserveSourceFiles?: boolean;
};

export class FileArchiver {
  constructor(
    private readonly archiveDir: string,
    private readonly failedDir: string,
    private readonly options: FileArchiverOptions = {}
  ) {}

  async archive(filePath: string): Promise<string> {
    return moveInto(filePath, this.archiveDir, this.options.preserveSourceFiles ?? false);
  }

  async moveToFailed(filePath: string): Promise<string> {
    return moveInto(filePath, this.failedDir, this.options.preserveSourceFiles ?? false);
  }
}

async function moveInto(sourcePath: string, targetDir: string, preserveSourceFiles: boolean): Promise<string> {
  await mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, path.basename(sourcePath));
  if (preserveSourceFiles) {
    await copyFile(sourcePath, targetPath);
    return targetPath;
  }

  await rename(sourcePath, targetPath);
  return targetPath;
}

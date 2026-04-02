import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function sha256File(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

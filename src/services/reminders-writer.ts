import { execFile } from "node:child_process";

type RemindersWriterOptions = {
  enabled: boolean;
  listName: string;
  triggerKeywords: string[];
};

type ScriptRunner = (script: string) => Promise<string>;

type AddMissingResult = {
  created: string[];
  skipped: string[];
};

export class RemindersWriter {
  constructor(
    private readonly options: RemindersWriterOptions,
    private readonly runScript: ScriptRunner = defaultScriptRunner
  ) {}

  isTriggered(rawText: string): boolean {
    if (!this.options.enabled) {
      return false;
    }

    return this.options.triggerKeywords.some((keyword) => rawText.includes(keyword));
  }

  async listTitles(): Promise<string[]> {
    if (!this.options.enabled) {
      return [];
    }

    const script = `
tell application "Reminders"
  set targetList to list "${escapeAppleScriptString(this.options.listName)}"
  set reminderNames to {}
  repeat with r in reminders of targetList
    copy name of r to end of reminderNames
  end repeat
  set AppleScript's text item delimiters to linefeed
  return reminderNames as text
end tell`;
    const output = await this.runScript(script);
    return output
      .split(/\r?\n/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async addMissing(todos: string[]): Promise<AddMissingResult> {
    if (!this.options.enabled || todos.length === 0) {
      return { created: [], skipped: [] };
    }

    const existing = new Set(await this.listTitles());
    const created: string[] = [];
    const skipped: string[] = [];

    for (const todo of todos) {
      if (existing.has(todo)) {
        skipped.push(todo);
        continue;
      }

      const dueDate = parseReminderDate(todo);
      const script = dueDate
        ? buildDatedReminderScript(this.options.listName, todo, dueDate)
        : `
tell application "Reminders"
  tell list "${escapeAppleScriptString(this.options.listName)}"
    make new reminder with properties {name:"${escapeAppleScriptString(todo)}"}
  end tell
end tell`;
      await this.runScript(script);
      existing.add(todo);
      created.push(todo);
    }

    return { created, skipped };
  }
}

async function defaultScriptRunner(script: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    execFile("/usr/bin/osascript", ["-e", script], (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function escapeAppleScriptString(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildDatedReminderScript(listName: string, todo: string, dueDate: Date): string {
  return `
tell application "Reminders"
  set dueDate to current date
  set year of dueDate to ${dueDate.getFullYear()}
  set month of dueDate to ${dueDate.getMonth() + 1}
  set day of dueDate to ${dueDate.getDate()}
  set hours of dueDate to ${dueDate.getHours()}
  set minutes of dueDate to ${dueDate.getMinutes()}
  set seconds of dueDate to 0
  tell list "${escapeAppleScriptString(listName)}"
    make new reminder with properties {name:"${escapeAppleScriptString(todo)}", due date:dueDate, remind me date:dueDate}
  end tell
end tell`;
}

function parseReminderDate(input: string, now = new Date()): Date | null {
  const normalized = input.trim().replace(/\s+/g, "");
  const match = normalized.match(/(今天|明天|后天)(早上|上午|中午|下午|晚上)?(\d{1,2})点(?:(\d{1,2})分|半)?/u);
  if (!match) {
    return null;
  }

  const [, dayWord, periodWord, hourText, minuteText] = match;

  if (!dayWord || !hourText) {
    return null;
  }

  const dueDate = new Date(now);
  dueDate.setSeconds(0, 0);
  dueDate.setDate(dueDate.getDate() + dayOffset(dayWord));
  dueDate.setHours(applyPeriodToHour(Number.parseInt(hourText, 10), periodWord ?? undefined), parseMinute(minuteText, normalized), 0, 0);
  return dueDate;
}

function dayOffset(dayWord: string): number {
  if (dayWord === "明天") {
    return 1;
  }
  if (dayWord === "后天") {
    return 2;
  }
  return 0;
}

function applyPeriodToHour(hour: number, periodWord?: string): number {
  if (!periodWord) {
    return hour;
  }

  if ((periodWord === "下午" || periodWord === "晚上") && hour < 12) {
    return hour + 12;
  }

  if (periodWord === "中午" && hour < 11) {
    return hour + 12;
  }

  return hour;
}

function parseMinute(minuteText: string | undefined, normalized: string): number {
  if (normalized.includes("点半")) {
    return 30;
  }

  if (!minuteText) {
    return 0;
  }

  return Number.parseInt(minuteText, 10);
}

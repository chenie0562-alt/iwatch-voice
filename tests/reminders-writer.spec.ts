import { afterEach, describe, expect, it, vi } from "vitest";

import { RemindersWriter } from "../src/services/reminders-writer.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RemindersWriter", () => {
  it("reads existing reminder titles from the target list", async () => {
    const runScript = vi.fn()
      .mockResolvedValueOnce("待会口播\n待会改客服的代码\n");
    const writer = new RemindersWriter({ enabled: true, listName: "工作", triggerKeywords: ["待办事项"] }, runScript);

    const titles = await writer.listTitles();

    expect(titles).toEqual(["待会口播", "待会改客服的代码"]);
    expect(runScript).toHaveBeenCalledTimes(1);
  });

  it("creates only missing reminders and skips duplicates", async () => {
    const runScript = vi.fn()
      .mockResolvedValueOnce("待会口播\n")
      .mockResolvedValueOnce("");
    const writer = new RemindersWriter({ enabled: true, listName: "工作", triggerKeywords: ["待办事项"] }, runScript);

    const result = await writer.addMissing(["待会口播", "晚上吃饭"]);

    expect(result).toEqual({
      created: ["晚上吃饭"],
      skipped: ["待会口播"]
    });
    expect(runScript).toHaveBeenCalledTimes(2);
  });

  it("sets a due date when the todo text includes a concrete time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T15:00:00+08:00"));

    const runScript = vi.fn()
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("");
    const writer = new RemindersWriter({ enabled: true, listName: "工作", triggerKeywords: ["待办事项"] }, runScript);

    await writer.addMissing(["明天下午2点开会"]);

    expect(runScript).toHaveBeenCalledTimes(2);
    expect(runScript.mock.calls[1]?.[0]).toContain('name:"明天下午2点开会"');
    expect(runScript.mock.calls[1]?.[0]).toContain("due date:dueDate");
    expect(runScript.mock.calls[1]?.[0]).toContain("remind me date:dueDate");
    expect(runScript.mock.calls[1]?.[0]).toContain("set year of dueDate to 2026");
    expect(runScript.mock.calls[1]?.[0]).toContain("set month of dueDate to 4");
    expect(runScript.mock.calls[1]?.[0]).toContain("set day of dueDate to 3");
    expect(runScript.mock.calls[1]?.[0]).toContain("set hours of dueDate to 14");
    expect(runScript.mock.calls[1]?.[0]).toContain("set minutes of dueDate to 0");
  });
});

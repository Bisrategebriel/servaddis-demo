import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DAY_MS,
  advanceClock,
  clockOffsetMs,
  loadClockOffset,
  now,
  setClockOffset,
} from "@/server/clock";
import { db } from "@/server/db";
import { resetDb } from "./helpers";

const storedOffset = async () =>
  (await db.demoSetting.findUnique({ where: { key: "clock_offset_ms" } }))?.value;

describe("demo clock", () => {
  beforeEach(async () => {
    await resetDb();
    await loadClockOffset();
  });
  afterEach(() => {
    process.env.DEMO_MODE = "1";
  });

  it("starts at real time after a reset", () => {
    expect(clockOffsetMs()).toBe(0);
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it("now() honours the offset and persists it", async () => {
    await setClockOffset(3 * DAY_MS);
    expect(Math.abs(now().getTime() - (Date.now() + 3 * DAY_MS))).toBeLessThan(1000);
    expect(await storedOffset()).toBe(String(3 * DAY_MS));
  });

  it("advanceClock adds to the current offset", async () => {
    await advanceClock(DAY_MS);
    await advanceClock(14 * DAY_MS);
    expect(clockOffsetMs()).toBe(15 * DAY_MS);
  });

  it("reloads the persisted offset (server restart)", async () => {
    await db.demoSetting.update({
      where: { key: "clock_offset_ms" },
      data: { value: String(30 * DAY_MS) },
    });
    expect(await loadClockOffset()).toBe(30 * DAY_MS);
  });

  it("ignores any offset and refuses changes outside demo mode", async () => {
    await setClockOffset(5 * DAY_MS);
    process.env.DEMO_MODE = "0";
    expect(clockOffsetMs()).toBe(0);
    await expect(setClockOffset(DAY_MS)).rejects.toThrow(/DEMO_MODE/);
  });
});

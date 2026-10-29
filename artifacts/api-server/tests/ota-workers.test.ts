import { afterEach, expect, it, vi } from "vitest";
vi.mock("@workspace/db", () => ({
  db: {},
  otaBookingsTable: {},
  otaEventsTable: {},
  siteSettingsTable: {},
  otaDuffelEventsTable: {},
  otaPaymentJobsTable: {},
}));
vi.mock("../src/utils/email", () => ({ sendEmail: vi.fn() }));
vi.mock("../src/lib/logger", () => ({ logger: { warn: vi.fn() } }));
import { startOtaMaintenance } from "../src/services/ota/maintenance";

afterEach(() => vi.useRealTimers());
it("keeps independent OTA stages running while another stage is blocked or fails", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const slow = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const failing = vi.fn().mockRejectedValue(new Error("Supplier unavailable"));
  const notifications = vi.fn().mockResolvedValue(undefined);
  const stop = startOtaMaintenance([
    { name: "slow payments", run: slow },
    { name: "failed supplier", run: failing },
    { name: "notifications", run: notifications },
  ]);
  try {
    await vi.advanceTimersByTimeAsync(60000);
    expect(slow).toHaveBeenCalledTimes(1);
    expect(failing).toHaveBeenCalledTimes(1);
    expect(notifications).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(slow).toHaveBeenCalledTimes(1);
    expect(failing).toHaveBeenCalledTimes(2);
    expect(notifications).toHaveBeenCalledTimes(2);
  } finally {
    stop();
    release();
  }
  await vi.advanceTimersByTimeAsync(60000);
  expect(notifications).toHaveBeenCalledTimes(2);
});

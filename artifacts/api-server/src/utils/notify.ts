import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { randomUUID } from "crypto";

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "booking" | "payment" | "document" | "support" | "system",
): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      id: randomUUID(),
      userId,
      title,
      message,
      type,
      isRead: false,
    });
  } catch (_) {
    // Non-blocking — never let notification failure break the main flow
  }
}

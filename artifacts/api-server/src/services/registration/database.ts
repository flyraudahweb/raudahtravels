import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@workspace/db";

type Executor = Pick<typeof db, "query" | "execute" | "select" | "insert" | "update" | "delete">;
const context = new AsyncLocalStorage<Executor>();

// All intake/review writes share the caller's transaction, including nested
// booking creation. AsyncLocalStorage isolates simultaneous requests.
export const registrationDb = new Proxy({} as Executor, {
  get(_target, key) {
    const executor = context.getStore() ?? db;
    const value = Reflect.get(executor, key);
    return typeof value === "function" ? value.bind(executor) : value;
  },
});

export async function registrationTransaction<T>(action: () => Promise<T>): Promise<T> {
  if (context.getStore()) return action();
  return db.transaction((tx) => context.run(tx, action));
}

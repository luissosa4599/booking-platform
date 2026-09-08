import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// A booking code scanned while offline. Confirmed against the server later —
// on scan-screen mount, on app foreground, and after any successful scan.
const KEY = "tempo.checkinqueue.v1";
const MAX = 25;

export interface QueuedCheckin {
  code: string;
  queuedAt: string;
}

async function read(): Promise<QueuedCheckin[]> {
  let raw: string | null = null;
  if (Platform.OS === "web") {
    try {
      raw = window.localStorage.getItem(KEY);
    } catch {
      raw = null;
    }
  } else {
    raw = await SecureStore.getItemAsync(KEY);
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedCheckin[]) : [];
  } catch {
    return [];
  }
}

async function write(queue: QueuedCheckin[]): Promise<void> {
  const value = JSON.stringify(queue.slice(-MAX));
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      /* private mode */
    }
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

export async function enqueueCheckin(code: string): Promise<void> {
  const queue = await read();
  const norm = code.trim().toUpperCase();
  if (queue.some((q) => q.code === norm)) return;
  queue.push({ code: norm, queuedAt: new Date().toISOString() });
  await write(queue);
}

export async function queuedCheckinCount(): Promise<number> {
  return (await read()).length;
}

/**
 * Runs `submit` for each queued code. `submit` returns "resolved" (drop it —
 * the server answered, whatever it said) or "retry" (keep it — still offline).
 */
export async function drainCheckinQueue(
  submit: (code: string) => Promise<"resolved" | "retry">,
): Promise<number> {
  const queue = await read();
  if (queue.length === 0) return 0;

  const remaining: QueuedCheckin[] = [];
  let resolved = 0;
  for (const item of queue) {
    let outcome: "resolved" | "retry" = "retry";
    try {
      outcome = await submit(item.code);
    } catch {
      outcome = "retry";
    }
    if (outcome === "resolved") resolved++;
    else remaining.push(item);
  }
  await write(remaining);
  return resolved;
}

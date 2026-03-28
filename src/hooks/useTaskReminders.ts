import { useEffect, useRef } from "react";
import type { Todo } from "../store/todos";

/**
 * Schedules a browser Notification for every todo that has a future dueAt.
 * Uses one setTimeout per task — it fires exactly at the due moment.
 * Cleared and re-registered whenever the todos list changes.
 * Past-due tasks on page load are silently skipped.
 */
export function useTaskReminders(todos: Todo[]) {
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Request notification permission once (requires secure context).
  // We call it in an effect so it only runs in the browser.
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Permission must be requested from a user gesture in most browsers;
      // this effect fires on first mount which may be blocked by some browsers.
      // The NotificationBanner component in App.tsx handles the button-click path.
    }
  }, []);

  // Sync one setTimeout per todo with a future dueAt.
  useEffect(() => {
    if (!("Notification" in window)) return;

    const now = Date.now();
    const activeIds = new Set(todos.map((t) => t.id));

    // Remove timeouts for tasks that were deleted.
    for (const id of timeoutsRef.current.keys()) {
      if (!activeIds.has(id)) {
        clearTimeout(timeoutsRef.current.get(id));
        timeoutsRef.current.delete(id);
      }
    }

    for (const item of todos) {
      // No reminder needed if completed or no due date.
      if (item.completed || !item.dueAt) {
        if (timeoutsRef.current.has(item.id)) {
          clearTimeout(timeoutsRef.current.get(item.id));
          timeoutsRef.current.delete(item.id);
        }
        continue;
      }

      const delay = item.dueAt.getTime() - now;

      // Skip tasks that are already past due — avoids spam on page reload.
      if (delay <= 0) {
        if (timeoutsRef.current.has(item.id)) {
          clearTimeout(timeoutsRef.current.get(item.id));
          timeoutsRef.current.delete(item.id);
        }
        continue;
      }

      // Always re-register so a changed dueAt is respected.
      if (timeoutsRef.current.has(item.id)) {
        clearTimeout(timeoutsRef.current.get(item.id));
      }

      const { id, task } = item;
      const timeoutId = setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification("⏰ Task Due!", {
            body: task,
            icon: "/favicon.ico",
            tag: `todo-reminder-${id}`,
          });
        }
        timeoutsRef.current.delete(id);
      }, delay);

      timeoutsRef.current.set(item.id, timeoutId);
    }
  }, [todos]);

  // Cleanup all pending timeouts when the component unmounts.
  useEffect(() => {
    return () => {
      for (const timeoutId of timeoutsRef.current.values()) {
        clearTimeout(timeoutId);
      }
    };
  }, []);
}

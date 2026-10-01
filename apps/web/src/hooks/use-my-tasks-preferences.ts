import { useCallback, useEffect, useState } from "react";
import { normalizePreferences } from "@/lib/my-tasks/preferences";
import {
  DEFAULT_PREFERENCES,
  type MyTasksPreferences,
} from "@/lib/my-tasks/types";

const storageKey = (workspaceId: string) => `kaneo:my-tasks:${workspaceId}`;

function readPreferences(key: string): MyTasksPreferences {
  try {
    const stored = window.localStorage.getItem(key);
    return stored
      ? normalizePreferences(JSON.parse(stored))
      : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function useMyTasksPreferences(workspaceId: string) {
  const key = storageKey(workspaceId);
  const [prefs, setPrefs] = useState(() => readPreferences(key));
  const [loadedKey, setLoadedKey] = useState(key);

  // Another workspace: load its settings before rendering with them.
  if (loadedKey !== key) {
    setLoadedKey(key);
    setPrefs(readPreferences(key));
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(prefs));
    } catch {
      // Storage may be unavailable or full; keep the settings in memory.
    }
  }, [key, prefs]);

  const update = useCallback((patch: Partial<MyTasksPreferences>) => {
    setPrefs((current) => ({ ...current, ...patch }));
  }, []);

  return [prefs, update] as const;
}

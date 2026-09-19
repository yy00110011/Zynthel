"use client";

import { useSyncExternalStore } from "react";
import { workspaceRepository } from "./repository";
import { createDefaultWorkspace } from "./schema";

const serverSnapshot = createDefaultWorkspace("2026-01-01T00:00:00.000Z");

export function useWorkspace() {
  return useSyncExternalStore(
    workspaceRepository.subscribe,
    workspaceRepository.get,
    () => serverSnapshot,
  );
}

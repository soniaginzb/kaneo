export type MyTasksPageState = "loading" | "error" | "empty" | "tasks";

// A failed background refresh (e.g. right after waking from sleep) keeps the
// tasks already on screen; only a failed first load shows the error.
export function myTasksPageState({
  isLoading,
  isError,
  hasData,
  visibleCount,
}: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  visibleCount: number;
}): MyTasksPageState {
  if (isLoading) return "loading";
  if (isError && !hasData) return "error";
  return visibleCount === 0 ? "empty" : "tasks";
}

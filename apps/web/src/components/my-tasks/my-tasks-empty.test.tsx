import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import MyTasksEmpty from "./my-tasks-empty";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));
afterEach(cleanup);

describe("MyTasksEmpty", () => {
  it("says how many tasks the filters hide and clears them", () => {
    const onClearFilters = vi.fn();
    render(<MyTasksEmpty hiddenCount={5} onClearFilters={onClearFilters} />);
    expect(
      screen.getByText('tasks:myTasks.hiddenByFilters {"count":5}'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:myTasks.clearFilters" }),
    );
    expect(onClearFilters).toHaveBeenCalled();
  });

  it("shows the empty message when nothing is hidden", () => {
    render(<MyTasksEmpty hiddenCount={0} onClearFilters={vi.fn()} />);
    expect(screen.getByText("tasks:myTasks.emptyTitle")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

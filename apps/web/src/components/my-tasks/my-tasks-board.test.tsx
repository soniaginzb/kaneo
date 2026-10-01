import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { groupMyTasks } from "@/lib/my-tasks/group-tasks";
import { makeProject, makeTask } from "@/lib/my-tasks/test-fixtures";
import type { GroupBy, MyTask } from "@/lib/my-tasks/types";
import MyTasksBoard from "./my-tasks-board";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
afterEach(cleanup);

const NOW = new Date(2026, 9, 7, 10);
const projects = [
  makeProject({ id: "p1", name: "Content" }),
  makeProject({ id: "p2", name: "Client A", position: 1 }),
];

function renderBoard(tasks: MyTask[], groupBy: GroupBy) {
  const onOpen = vi.fn();
  const groups = groupMyTasks(tasks, groupBy, {
    projects,
    now: NOW,
    weekStartsOn: 1,
    showCompleted: false,
  });
  render(
    <MyTasksBoard
      groups={groups}
      groupBy={groupBy}
      projects={projects}
      now={NOW}
      onOpen={onOpen}
      onToggleComplete={vi.fn()}
      onDrop={vi.fn()}
    />,
  );
  return { onOpen };
}

describe("MyTasksBoard", () => {
  it("shows every due-date column, even empty ones", () => {
    renderBoard([makeTask()], "dueDate");
    expect(screen.getAllByRole("region")).toHaveLength(6);
    expect(
      screen.getByRole("region", { name: "tasks:myTasks.due.overdue" }),
    ).toBeInTheDocument();
  });

  it("shows every status column so cards can be dropped into empty ones", () => {
    renderBoard([makeTask()], "status");
    expect(
      screen
        .getAllByRole("region")
        .map((region) => region.getAttribute("aria-label")),
    ).toEqual(["To Do", "In Progress", "Done"]);
  });

  it("shows only project columns that have tasks", () => {
    renderBoard([makeTask({ projectId: "p1" })], "project");
    expect(
      screen
        .getAllByRole("region")
        .map((region) => region.getAttribute("aria-label")),
    ).toEqual(["Content"]);
  });

  it("opens a card", () => {
    const task = makeTask({ title: "Write post" });
    const { onOpen } = renderBoard([task], "none");
    fireEvent.click(screen.getByRole("button", { name: /Write post/ }));
    expect(onOpen).toHaveBeenCalledWith(task);
  });
});

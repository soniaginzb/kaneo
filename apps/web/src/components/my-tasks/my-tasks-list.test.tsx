import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { groupMyTasks } from "@/lib/my-tasks/group-tasks";
import { makeProject, makeTask } from "@/lib/my-tasks/test-fixtures";
import type { MyTask, MyTaskProject } from "@/lib/my-tasks/types";
import MyTasksList from "./my-tasks-list";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
afterEach(cleanup);

const NOW = new Date(2026, 9, 7, 10);
const today = new Date(2026, 9, 7).toISOString();

function renderList(
  tasks: MyTask[],
  projects: MyTaskProject[] = [makeProject()],
) {
  const onOpen = vi.fn();
  const onToggleComplete = vi.fn();
  const groups = groupMyTasks(tasks, "dueDate", {
    projects,
    now: NOW,
    weekStartsOn: 1,
    showCompleted: false,
  });
  render(
    <MyTasksList
      groups={groups}
      groupBy="dueDate"
      projects={projects}
      now={NOW}
      onOpen={onOpen}
      onToggleComplete={onToggleComplete}
    />,
  );
  return { onOpen, onToggleComplete };
}

describe("MyTasksList", () => {
  it("shows only groups that have tasks, with counts", () => {
    renderList([
      makeTask({ id: "a", title: "Due today", dueDate: today }),
      makeTask({ id: "b", title: "Whenever" }),
    ]);
    expect(
      screen.getByRole("button", { name: /tasks:myTasks.due.today/ }),
    ).toHaveTextContent("1");
    expect(
      screen.getByRole("button", { name: /tasks:myTasks.due.noDate/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /tasks:myTasks.due.overdue/ }),
    ).toBeNull();
  });

  it("opens and completes a task with separate controls", () => {
    const task = makeTask({ title: "Write post", number: 4 });
    const { onOpen, onToggleComplete } = renderList([task]);

    fireEvent.click(screen.getByRole("button", { name: /Write post/ }));
    expect(onOpen).toHaveBeenCalledWith(task);
    expect(screen.getByText("CNT-4")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:myTasks.complete" }),
    );
    expect(onToggleComplete).toHaveBeenCalledWith(task);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows a subtask's parent", () => {
    renderList([makeTask({ parent: { id: "p", title: "Newsletter" } })]);
    expect(
      screen.getByText('tasks:myTasks.subtaskOf {"title":"Newsletter"}'),
    ).toBeInTheDocument();
  });

  it("disables the circle when the project has no Done column", () => {
    const noDone = makeProject({
      columns: [
        { id: "c1", name: "To Do", slug: "to-do", position: 0, isFinal: false },
      ],
    });
    renderList([makeTask()], [noDone]);
    expect(
      screen.getByRole("button", { name: "tasks:myTasks.noDoneColumn" }),
    ).toBeDisabled();
  });

  it("collapses a group", () => {
    renderList([makeTask({ title: "Write post" })]);
    fireEvent.click(
      screen.getByRole("button", { name: /tasks:myTasks.due.noDate/ }),
    );
    expect(screen.queryByText("Write post")).toBeNull();
  });
});

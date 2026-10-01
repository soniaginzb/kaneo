import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { makeProject } from "@/lib/my-tasks/test-fixtures";
import {
  DEFAULT_FILTERS,
  DEFAULT_PREFERENCES,
  type MyTasksPreferences,
} from "@/lib/my-tasks/types";
import MyTasksToolbar from "./my-tasks-toolbar";
import ViewSwitch from "./view-switch";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));
afterEach(cleanup);

const prefs: MyTasksPreferences = {
  ...DEFAULT_PREFERENCES,
  completed: "7d",
  filters: { ...DEFAULT_FILTERS, projects: ["p1"] },
};

function renderToolbar() {
  const onChange = vi.fn();
  const onSearchChange = vi.fn();
  render(
    <MyTasksToolbar
      prefs={prefs}
      onChange={onChange}
      search=""
      onSearchChange={onSearchChange}
      projects={[makeProject()]}
      labelOptions={[]}
    />,
  );
  return { onChange, onSearchChange };
}

describe("MyTasksToolbar", () => {
  it("reports search typing", () => {
    const { onSearchChange } = renderToolbar();
    fireEvent.change(
      screen.getByRole("textbox", { name: "tasks:myTasks.searchPlaceholder" }),
      { target: { value: "post" } },
    );
    expect(onSearchChange).toHaveBeenCalledWith("post");
  });

  it("counts active filters and removes one from its chip", () => {
    const { onChange } = renderToolbar();
    expect(
      screen.getByRole("button", { name: /tasks:myTasks.filter.button/ }),
    ).toHaveTextContent("2");
    fireEvent.click(
      screen.getByRole("button", {
        name: 'tasks:myTasks.filter.remove {"name":"Content"}',
      }),
    );
    expect(onChange).toHaveBeenCalledWith({
      filters: { ...prefs.filters, projects: [] },
    });
  });
});

describe("ViewSwitch", () => {
  it("switches between list and board", () => {
    const onChange = vi.fn();
    render(<ViewSwitch view="list" onChange={onChange} />);
    expect(
      screen.getByRole("button", { name: /tasks:myTasks.view.list/ }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      screen.getByRole("button", { name: /tasks:myTasks.view.board/ }),
    );
    expect(onChange).toHaveBeenCalledWith("board");
  });
});

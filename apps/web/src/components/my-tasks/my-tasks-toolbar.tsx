import { ArrowDownAZ, Filter, Layers, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { filterChips } from "@/lib/my-tasks/filter-chips";
import {
  countActiveFilters,
  type LabelOption,
} from "@/lib/my-tasks/filter-tasks";
import {
  ASSIGNEE_FILTERS,
  COMPLETED_WINDOWS,
  type CompletedWindow,
  DUE_FILTERS,
  GROUP_BYS,
  type GroupBy,
  type MyTaskProject,
  type MyTasksFilters,
  type MyTasksPreferences,
  PRIORITIES,
  SORT_FIELDS,
  type SortDirection,
  type SortField,
} from "@/lib/my-tasks/types";

const triggerClass =
  "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none hover:bg-accent/60";
const sectionLabelClass = "text-[11px] uppercase tracking-wide";

type MyTasksToolbarProps = {
  prefs: MyTasksPreferences;
  onChange: (patch: Partial<MyTasksPreferences>) => void;
  search: string;
  onSearchChange: (value: string) => void;
  projects: MyTaskProject[];
  labelOptions: LabelOption[];
};

export default function MyTasksToolbar({
  prefs,
  onChange,
  search,
  onSearchChange,
  projects,
  labelOptions,
}: MyTasksToolbarProps) {
  const { t } = useTranslation();
  const { filters } = prefs;
  const activeCount = countActiveFilters(prefs);
  const chips = filterChips(prefs, projects, labelOptions, t);

  const toggle = (
    field: keyof MyTasksFilters,
    value: string,
    checked: boolean,
  ) => {
    const current = filters[field] as string[];
    const next = checked
      ? [...current, value]
      : current.filter((item) => item !== value);
    onChange({ filters: { ...filters, [field]: next } as MyTasksFilters });
  };

  const checkboxes = (
    field: keyof MyTasksFilters,
    options: Array<{ value: string; label: string }>,
  ) =>
    options.map((option) => (
      <DropdownMenuCheckboxItem
        key={option.value}
        checked={(filters[field] as string[]).includes(option.value)}
        onCheckedChange={(checked) => toggle(field, option.value, checked)}
      >
        {option.label}
      </DropdownMenuCheckboxItem>
    ));

  return (
    <div className="flex flex-col gap-2 pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("tasks:myTasks.searchPlaceholder")}
            aria-label={t("tasks:myTasks.searchPlaceholder")}
            className="h-7 pl-8 text-xs"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button type="button" className={triggerClass} />}
          >
            <Layers className="size-3" />
            {t("tasks:myTasks.groupBy.label")}:{" "}
            {t(`tasks:myTasks.groupBy.${prefs.groupBy}`)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup
              value={prefs.groupBy}
              onValueChange={(value) => onChange({ groupBy: value as GroupBy })}
            >
              {GROUP_BYS.map((groupBy) => (
                <DropdownMenuRadioItem key={groupBy} value={groupBy}>
                  {t(`tasks:myTasks.groupBy.${groupBy}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button type="button" className={triggerClass} />}
          >
            <ArrowDownAZ className="size-3" />
            {t("tasks:myTasks.sort.label")}:{" "}
            {t(`tasks:myTasks.sort.${prefs.sort.field}`)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup
              value={prefs.sort.field}
              onValueChange={(value) =>
                onChange({ sort: { ...prefs.sort, field: value as SortField } })
              }
            >
              {SORT_FIELDS.map((field) => (
                <DropdownMenuRadioItem key={field} value={field}>
                  {t(`tasks:myTasks.sort.${field}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={prefs.sort.direction}
              onValueChange={(value) =>
                onChange({
                  sort: { ...prefs.sort, direction: value as SortDirection },
                })
              }
            >
              {(["asc", "desc"] as const).map((direction) => (
                <DropdownMenuRadioItem key={direction} value={direction}>
                  {t(`tasks:myTasks.sort.${direction}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button type="button" className={triggerClass} />}
          >
            <Filter className="size-3" />
            {t("tasks:myTasks.filter.button")}
            {activeCount > 0 && (
              <span className="rounded bg-primary px-1 text-[10px] text-primary-foreground">
                {activeCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-96 w-60 overflow-y-auto"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className={sectionLabelClass}>
                {t("tasks:myTasks.filter.assignee")}
              </DropdownMenuLabel>
              {checkboxes(
                "assignee",
                ASSIGNEE_FILTERS.map((value) => ({
                  value,
                  label: t(`tasks:myTasks.assignee.${value}`),
                })),
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={sectionLabelClass}>
                {t("tasks:myTasks.filter.project")}
              </DropdownMenuLabel>
              {checkboxes(
                "projects",
                projects.map((project) => ({
                  value: project.id,
                  label: project.name,
                })),
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={sectionLabelClass}>
                {t("tasks:myTasks.filter.priority")}
              </DropdownMenuLabel>
              {checkboxes(
                "priorities",
                PRIORITIES.map((value) => ({
                  value,
                  label: t(`tasks:priority.${value}`),
                })),
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={sectionLabelClass}>
                {t("tasks:myTasks.filter.due")}
              </DropdownMenuLabel>
              {checkboxes(
                "due",
                DUE_FILTERS.map((value) => ({
                  value,
                  label: t(`tasks:myTasks.due.${value}`),
                })),
              )}
            </DropdownMenuGroup>
            {labelOptions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className={sectionLabelClass}>
                    {t("tasks:myTasks.filter.label")}
                  </DropdownMenuLabel>
                  {checkboxes(
                    "labels",
                    labelOptions.map((option) => ({
                      value: option.key,
                      label: option.name,
                    })),
                  )}
                </DropdownMenuGroup>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={sectionLabelClass}>
                {t("tasks:myTasks.filter.completed")}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={prefs.completed}
                onValueChange={(value) =>
                  onChange({ completed: value as CompletedWindow })
                }
              >
                {COMPLETED_WINDOWS.map((window) => (
                  <DropdownMenuRadioItem key={window} value={window}>
                    {t(`tasks:myTasks.completed.${window}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted/50 px-2 text-xs"
            >
              {chip.label}
              <button
                type="button"
                aria-label={t("tasks:myTasks.filter.remove", {
                  name: chip.label,
                })}
                onClick={() => onChange(chip.next)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

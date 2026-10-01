import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type MyTasksEmptyProps = {
  hiddenCount: number;
  onClearFilters: () => void;
};

export default function MyTasksEmpty({
  hiddenCount,
  onClearFilters,
}: MyTasksEmptyProps) {
  const { t } = useTranslation();

  if (hiddenCount > 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {t("tasks:myTasks.hiddenByFilters", { count: hiddenCount })}
          </EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            {t("tasks:myTasks.clearFilters")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ListChecks />
        </EmptyMedia>
        <EmptyTitle>{t("tasks:myTasks.emptyTitle")}</EmptyTitle>
        <EmptyDescription>
          {t("tasks:myTasks.emptyDescription")}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

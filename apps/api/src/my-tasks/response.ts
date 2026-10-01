import { z } from "../openapi";

const myTaskSchema = z
  .object({
    id: z.string(),
    number: z.number().nullable(),
    title: z.string(),
    status: z.string().openapi({ description: "Column slug, or planned." }),
    priority: z.string(),
    startDate: z.string().nullable(),
    dueDate: z.string().nullable(),
    createdAt: z.string(),
    projectId: z.string(),
    assignee: z
      .object({
        id: z.string(),
        name: z.string(),
        image: z.string().nullable(),
      })
      .nullable(),
    labels: z.array(
      z.object({ id: z.string(), name: z.string(), color: z.string() }),
    ),
    parent: z
      .object({ id: z.string(), title: z.string() })
      .nullable()
      .openapi({ description: "The parent task when this is a subtask." }),
    isRecurring: z.boolean(),
    completed: z.boolean(),
    completedAt: z.string().nullable().openapi({
      description:
        "Time of the latest status change for completed tasks (falls back to the last edit).",
    }),
  })
  .openapi("MyTask");

const myTasksProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    icon: z.string().nullable(),
    position: z.number(),
    columns: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        position: z.number(),
        isFinal: z.boolean(),
      }),
    ),
  })
  .openapi("MyTasksProject");

export const myTasksSchema = z
  .object({
    tasks: z.array(myTaskSchema),
    projects: z.array(myTasksProjectSchema),
    truncated: z.boolean().openapi({
      description:
        "True when more than 2000 tasks matched and the rest were left out.",
    }),
  })
  .openapi("MyTasks");

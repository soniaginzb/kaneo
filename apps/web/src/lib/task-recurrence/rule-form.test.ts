import { describe, expect, it } from "vite-plus/test";
import {
  defaultForm,
  formToRrule,
  monthlyOptions,
  rruleToForm,
} from "./rule-form";

// Local-time dates, like the due dates the browser saves.
const monday5Oct = new Date(2026, 9, 5);
const friday30Oct = new Date(2026, 9, 30);

describe("rule form", () => {
  it("defaults to weekly on the reference weekday", () => {
    expect(defaultForm(monday5Oct)).toEqual({
      frequency: "WEEKLY",
      interval: 1,
      weekdays: ["MO"],
      monthlyMode: "day",
    });
  });

  it("builds rules from the form and reference date", () => {
    expect(
      formToRrule(
        { frequency: "DAILY", interval: 3, weekdays: [], monthlyMode: "day" },
        monday5Oct,
      ),
    ).toBe("FREQ=DAILY;INTERVAL=3");
    expect(
      formToRrule(
        {
          frequency: "WEEKLY",
          interval: 1,
          weekdays: ["TH", "MO"],
          monthlyMode: "day",
        },
        monday5Oct,
      ),
    ).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH");
    expect(
      formToRrule(
        { frequency: "MONTHLY", interval: 1, weekdays: [], monthlyMode: "day" },
        monday5Oct,
      ),
    ).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5");
    expect(
      formToRrule(
        {
          frequency: "MONTHLY",
          interval: 1,
          weekdays: [],
          monthlyMode: "weekday",
        },
        monday5Oct,
      ),
    ).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO");
    expect(
      formToRrule(
        {
          frequency: "MONTHLY",
          interval: 1,
          weekdays: [],
          monthlyMode: "last-weekday",
        },
        friday30Oct,
      ),
    ).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR");
    expect(
      formToRrule(
        { frequency: "YEARLY", interval: 1, weekdays: [], monthlyMode: "day" },
        monday5Oct,
      ),
    ).toBe("FREQ=YEARLY;INTERVAL=1;BYMONTH=10;BYMONTHDAY=5");
  });

  it("only offers monthly modes that exist for the reference date", () => {
    expect(monthlyOptions(monday5Oct)).toEqual(["day", "weekday"]);
    expect(monthlyOptions(friday30Oct)).toEqual(["day", "last-weekday"]);
    expect(monthlyOptions(new Date(2026, 9, 26))).toEqual([
      "day",
      "weekday",
      "last-weekday",
    ]);
  });

  it("reads saved rules back into the form", () => {
    expect(
      rruleToForm("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH", monday5Oct),
    ).toEqual({
      frequency: "WEEKLY",
      interval: 2,
      weekdays: ["MO", "TH"],
      monthlyMode: "day",
    });
    expect(
      rruleToForm("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR", friday30Oct),
    ).toMatchObject({
      frequency: "MONTHLY",
      monthlyMode: "last-weekday",
      weekdays: ["FR"],
    });
    // A saved "first Monday" rule on a task now due the 30th falls back to "day".
    expect(
      rruleToForm("FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO", friday30Oct).monthlyMode,
    ).toBe("day");
    // Switching a saved daily rule to monthly starts from "on day X".
    expect(rruleToForm("FREQ=DAILY;INTERVAL=1", monday5Oct)).toEqual({
      frequency: "DAILY",
      interval: 1,
      weekdays: ["MO"],
      monthlyMode: "day",
    });
  });
});

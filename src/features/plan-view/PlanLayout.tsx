import { useState } from "react";
import type { Task } from "@/lib/types";
import { CarryoverBanner } from "@/features/carryover/CarryoverBanner";
import { MonthColumn } from "@/features/month/MonthColumn";
import { WeekColumn } from "@/features/week/WeekColumn";
import { DayColumn } from "@/features/day/DayColumn";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { MOCK_CARRYOVER_MONTH } from "@/mock/data";
import styles from "./PlanLayout.module.css";

export interface PlanLayoutProps {
  allTasks: Task[];
  selectedDate: string;
  month: string;
}

type MobileTab = "month" | "week" | "day";

export function PlanLayout({ allTasks, selectedDate, month }: PlanLayoutProps) {
  const [tab, setTab] = useState<MobileTab>("month");

  return (
    <main className={styles.page}>
      <CarryoverBanner
        fromLabel="從上月延續"
        summary={`${MOCK_CARRYOVER_MONTH.fromMonth} 沒做完的任務`}
        count={MOCK_CARRYOVER_MONTH.count}
        actions={["→ 本月三件事", "→ 本月其他", "丟回 backlog"]}
      />

      <div className={styles.mobileTabs}>
        <SegmentedControl<MobileTab>
          value={tab}
          onValueChange={setTab}
          size="sm"
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
            { value: "day", label: "Day" },
          ]}
        />
      </div>

      <div className={styles.grid}>
        <div
          className={[styles.cell, tab !== "month" && styles.mobileHidden]
            .filter(Boolean)
            .join(" ")}
        >
          <MonthColumn allTasks={allTasks} month={month} selectedDate={selectedDate} />
        </div>
        <div
          className={[styles.cell, tab !== "week" && styles.mobileHidden].filter(Boolean).join(" ")}
        >
          <WeekColumn allTasks={allTasks} selectedDate={selectedDate} />
        </div>
        <div
          className={[styles.cell, tab !== "day" && styles.mobileHidden].filter(Boolean).join(" ")}
        >
          <DayColumn allTasks={allTasks} selectedDate={selectedDate} variant="plan-narrow" interactive />
        </div>
      </div>
    </main>
  );
}

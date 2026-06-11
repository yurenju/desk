import { createFileRoute } from "@tanstack/react-router";
import { todayISO } from "@/lib/date";
import { TodayView } from "./focus";

function TodayIndexRoute() {
  return <TodayView date={todayISO()} />;
}

export const Route = createFileRoute("/focus/")({
  component: TodayIndexRoute,
});

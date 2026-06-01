import { createFileRoute } from "@tanstack/react-router";
import { todayISO } from "@/lib/date";
import { TodayView } from "./today";

function TodayIndexRoute() {
  return <TodayView date={todayISO()} />;
}

export const Route = createFileRoute("/today/")({
  component: TodayIndexRoute,
});

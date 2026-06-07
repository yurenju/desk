import { createFileRoute } from "@tanstack/react-router";
import { currentMonthISO } from "@/lib/date";
import { PlanView } from "./plan";

function PlanIndexRoute() {
  return <PlanView month={currentMonthISO()} />;
}

export const Route = createFileRoute("/plan/")({
  component: PlanIndexRoute,
});

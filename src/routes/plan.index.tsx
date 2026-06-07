import { createFileRoute } from "@tanstack/react-router";
import { todayISO } from "@/lib/date";
import { PlanView } from "./plan";

function PlanIndexRoute() {
  return <PlanView date={todayISO()} />;
}

export const Route = createFileRoute("/plan/")({
  component: PlanIndexRoute,
});

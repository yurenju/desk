import { createFileRoute } from "@tanstack/react-router";
import { PlanPage } from "@/pages/PlanPage";

export const Route = createFileRoute("/plan")({
  component: PlanPage,
});

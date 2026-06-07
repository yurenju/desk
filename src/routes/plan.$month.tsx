import { createFileRoute, redirect } from "@tanstack/react-router";
import { isValidMonthParam } from "@/lib/date";
import { PlanView } from "./plan";

function PlanMonthRoute() {
  const { month } = Route.useParams();
  return <PlanView month={month} />;
}

export const Route = createFileRoute("/plan/$month")({
  beforeLoad: ({ params }) => {
    if (!isValidMonthParam(params.month)) throw redirect({ to: "/plan" });
  },
  component: PlanMonthRoute,
});

import { createFileRoute, redirect } from "@tanstack/react-router";
import { isValidDateParam } from "@/lib/date";
import { PlanView } from "./plan";

function PlanDateRoute() {
  const { date } = Route.useParams();
  return <PlanView date={date} />;
}

export const Route = createFileRoute("/plan/$date")({
  beforeLoad: ({ params }) => {
    if (!isValidDateParam(params.date)) throw redirect({ to: "/plan" });
  },
  component: PlanDateRoute,
});

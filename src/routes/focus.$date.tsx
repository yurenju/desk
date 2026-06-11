import { createFileRoute, redirect } from "@tanstack/react-router";
import { isValidDateParam } from "@/lib/date";
import { TodayView } from "./focus";

function TodayDateRoute() {
  const { date } = Route.useParams();
  return <TodayView date={date} />;
}

export const Route = createFileRoute("/focus/$date")({
  beforeLoad: ({ params }) => {
    if (!isValidDateParam(params.date)) throw redirect({ to: "/focus" });
  },
  component: TodayDateRoute,
});

import { createFileRoute, redirect } from "@tanstack/react-router";
import { isValidDateParam } from "@/lib/date";
import { TodayView } from "./today";

function TodayDateRoute() {
  const { date } = Route.useParams();
  return <TodayView date={date} />;
}

export const Route = createFileRoute("/today/$date")({
  beforeLoad: ({ params }) => {
    if (!isValidDateParam(params.date)) throw redirect({ to: "/today" });
  },
  component: TodayDateRoute,
});

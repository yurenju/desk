import { createFileRoute } from "@tanstack/react-router";
import { TodayView } from "./today";

function TodayDateRoute() {
  const { date } = Route.useParams();
  return <TodayView date={date} />;
}

export const Route = createFileRoute("/today/$date")({
  component: TodayDateRoute,
});

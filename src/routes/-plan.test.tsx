import { render, screen } from "@testing-library/react";
import { PlanView } from "./plan";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

it("renders the given month's tasks", () => {
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
  render(<PlanView month="2026-05" />);
  expect(screen.getByText("推出 desk.yurenju.me MVP")).toBeInTheDocument();
});

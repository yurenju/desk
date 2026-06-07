import { useLocation, useNavigate } from "@tanstack/react-router";
import { SegmentedControl } from "@/ui/SegmentedControl";

type Mode = "plan" | "today";

export function ModeToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const current: Mode = location.pathname.startsWith("/plan") ? "plan" : "today";

  return (
    <SegmentedControl<Mode>
      value={current}
      onValueChange={(v) => navigate({ to: v === "plan" ? "/plan" : "/today" })}
      ariaLabel="Mode"
      options={[
        { value: "plan", label: "規劃" },
        { value: "today", label: "專注" },
      ]}
    />
  );
}

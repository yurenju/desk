import { useLocation, useNavigate } from "@tanstack/react-router";
import { SegmentedControl } from "@/ui/SegmentedControl";

type Mode = "plan" | "focus";

export function ModeToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const current: Mode = location.pathname.startsWith("/plan") ? "plan" : "focus";

  return (
    <SegmentedControl<Mode>
      value={current}
      onValueChange={(v) => navigate({ to: v === "plan" ? "/plan" : "/focus" })}
      ariaLabel="Mode"
      options={[
        { value: "plan", label: "規劃" },
        { value: "focus", label: "專注" },
      ]}
    />
  );
}

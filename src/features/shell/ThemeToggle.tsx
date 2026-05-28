import { useTheme, type ThemePref } from "@/lib/theme";
import { SegmentedControl } from "@/ui/SegmentedControl";

export function ThemeToggle() {
  const { pref, setPref } = useTheme();

  return (
    <SegmentedControl<ThemePref>
      value={pref}
      onValueChange={setPref}
      size="sm"
      ariaLabel="Theme"
      options={[
        { value: "auto", label: "Auto" },
        { value: "light", label: "亮" },
        { value: "dark", label: "暗" },
      ]}
    />
  );
}

import { useEntryMode } from "@/lib/entryMode";
import styles from "./EntryModeChip.module.css";

export function EntryModeChip() {
  const [mode, setMode] = useEntryMode();
  const isAdhoc = mode === "adhoc";
  return (
    <button
      type="button"
      className={[styles.chip, isAdhoc ? styles.adhoc : styles.planned].join(" ")}
      aria-pressed={isAdhoc}
      aria-label={
        isAdhoc ? "新增模式:臨時,點擊切換為計畫中" : "新增模式:計畫中,點擊切換為臨時"
      }
      onClick={() => setMode(isAdhoc ? "planned" : "adhoc")}
    >
      {isAdhoc ? "⚡ 臨時" : "📅 計畫中"}
    </button>
  );
}

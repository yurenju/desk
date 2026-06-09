import { Dialog } from "@base-ui/react/dialog";
import { useTasksStore } from "@/store/tasks";
import { todayISO } from "@/lib/date";
import { Checkbox } from "@/ui/Checkbox";
import { useTaskDetailStore } from "./store";
import { useTaskDetail } from "./useTaskDetail";
import { DescriptionEditor } from "./DescriptionEditor";
import { SubtaskList } from "./SubtaskList";
import styles from "./TaskDetailModal.module.css";

const PRIORITY_LABEL: Record<string, string> = { "1": "① 今日第一", "2": "② 今日第二", "3": "③ 今日第三" };

export function TaskDetailModal() {
  const openId = useTaskDetailStore((s) => s.openId);
  const close = useTaskDetailStore((s) => s.close);
  const task = useTasksStore((s) => s.tasks.find((t) => t.id === openId) ?? null);

  const toggleDone = useTasksStore((s) => s.toggleDone);
  const editTitle = useTasksStore((s) => s.editTitle);
  const editDescription = useTasksStore((s) => s.editDescription);
  const deleteTask = useTasksStore((s) => s.deleteTask);

  const detail = useTaskDetail(openId);

  const open = Boolean(openId && task);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup} aria-label="任務詳情">
          {task && (
            <>
              <div className={styles.header}>
                <Checkbox
                  checked={task.status === "done"}
                  onCheckedChange={() => toggleDone(task.id)}
                  aria-label="完成任務"
                />
                <input
                  className={styles.title}
                  defaultValue={task.title}
                  key={task.id}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== task.title) editTitle(task.id, v);
                  }}
                  aria-label="任務標題"
                />
                <Dialog.Close className={styles.close} aria-label="關閉">✕</Dialog.Close>
              </div>

              <div className={styles.chips}>
                {task.custom_fields.daily_priority && (
                  <span className={`${styles.chip} ${styles.pri}`}>
                    {PRIORITY_LABEL[task.custom_fields.daily_priority]}
                  </span>
                )}
                {task.custom_fields.scheduled_dates?.length ? (
                  <span className={styles.chip}>
                    排到 {task.custom_fields.scheduled_dates[task.custom_fields.scheduled_dates.length - 1].slice(5)}
                  </span>
                ) : null}
                {task.custom_fields.scheduled_months?.includes(todayISO().slice(0, 7)) && (
                  <span className={styles.chip}>本月</span>
                )}
              </div>

              <section className={styles.section}>
                <div className={styles.label}>描述</div>
                <DescriptionEditor
                  value={task.description ?? ""}
                  onSave={(text) => editDescription(task.id, text)}
                />
              </section>

              <section className={styles.section}>
                <div className={styles.label}>子任務</div>
                {detail.status === "error" ? (
                  <p className={styles.muted}>子任務載入失敗</p>
                ) : (
                  <SubtaskList
                    subtasks={detail.subtasks}
                    onToggle={detail.toggle}
                    onRename={detail.rename}
                    onRemove={detail.remove}
                    onAdd={detail.add}
                  />
                )}
              </section>

              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => { deleteTask(task.id); close(); }}
                >
                  🗑 刪除任務
                </button>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

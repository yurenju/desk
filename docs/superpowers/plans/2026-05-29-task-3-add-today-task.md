# Task 3: taskOps — addTodayTask (純函式) & Review Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `addTodayTask` pure function and apply code reviewer feedback to the `toggleDone` function in `src/store/taskOps.ts`, ensuring complete test coverage and verification.

**Architecture:** Maintain clean pure functions in `src/store/taskOps.ts`. Use immutable updates, ensuring that references are preserved when no changes occur, and that `custom_fields` does not contain `undefined` properties.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Apply Reviewer Feedback to `toggleDone`

Modify `toggleDone` to check for task existence first, clean up `undefined` properties in `custom_fields`, and test these behaviors.

**Files:**
- Modify: `src/store/taskOps.ts`
- Modify: `src/store/taskOps.test.ts`

- [ ] **Step 1: Write the failing tests**
  Add tests at the end of the `toggleDone` suite in `src/store/taskOps.test.ts`:
  ```typescript
  it("returns the original array reference when the id is not found", () => {
    const tasks = [makeTask({ id: "a" })];
    const next = toggleDone(tasks, "not-found", NOW);
    expect(next).toBe(tasks);
  });

  it("cleans up done_on property from custom_fields if it is undefined", () => {
    const tasks = [
      makeTask({ id: "a", status: "done", custom_fields: { done_on: NOW, is_adhoc: "true" } }),
    ];
    const next = toggleDone(tasks, "a", NOW);
    expect("done_on" in next[0].custom_fields).toBe(false);
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**
  Run: `npm test -- --run src/store/taskOps.test.ts`
  Expected: FAIL (2 failing tests)

- [ ] **Step 3: Modify `toggleDone` implementation**
  Update `toggleDone` and its helper `patch` in `src/store/taskOps.ts`:
  ```typescript
  function patch(t: Task, cf: Partial<TaskCustomFields>, now?: string): Task {
    const newCustomFields = { ...t.custom_fields, ...cf };
    // Clean up undefined properties to keep in-memory data clean
    for (const key in newCustomFields) {
      if (newCustomFields[key as keyof TaskCustomFields] === undefined) {
        delete newCustomFields[key as keyof TaskCustomFields];
      }
    }
    return {
      ...t,
      ...(now ? { updated_at: now } : {}),
      custom_fields: newCustomFields,
    };
  }

  export function toggleDone(tasks: Task[], id: string, now: string): Task[] {
    if (!tasks.some((t) => t.id === id)) return tasks;
    return tasks.map((t) => {
      if (t.id !== id) return t;
      const isDone = t.status === "done";
      return {
        ...patch(t, { done_on: isDone ? undefined : now }, now),
        status: isDone ? "open" : "done",
      };
    });
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm test -- --run src/store/taskOps.test.ts`
  Expected: PASS (5 tests in toggleDone suite)

- [ ] **Step 5: Commit changes**
  Run: `git add src/store/taskOps.ts src/store/taskOps.test.ts`
  Run: `git commit -m "pref(slice-1): apply code reviewer feedback to toggleDone"`

---

### Task 2: Implement `addTodayTask`

Write the tests and minimal code to implement the `addTodayTask` function.

**Files:**
- Modify: `src/store/taskOps.ts`
- Modify: `src/store/taskOps.test.ts`

- [ ] **Step 1: Write the failing tests**
  Add the test suite for `addTodayTask` to the end of `src/store/taskOps.test.ts`:
  ```typescript
  import { addTodayTask } from "./taskOps";

  describe("addTodayTask", () => {
    it("appends an adhoc task scheduled for today", () => {
      const next = addTodayTask([], "回電話", "2026-05-22", "new-id", NOW);
      expect(next).toHaveLength(1);
      expect(next[0]).toMatchObject({
        id: "new-id",
        title: "回電話",
        status: "open",
        created_at: NOW,
        custom_fields: { scheduled_dates: ["2026-05-22"], is_adhoc: "true" },
      });
    });

    it("trims the title", () => {
      const next = addTodayTask([], "  買菜  ", "2026-05-22", "x", NOW);
      expect(next[0].title).toBe("買菜");
    });

    it("ignores a blank title", () => {
      const next = addTodayTask([], "   ", "2026-05-22", "x", NOW);
      expect(next).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**
  Run: `npm test -- --run src/store/taskOps.test.ts`
  Expected: FAIL, import fails or `addTodayTask is not a function`.

- [ ] **Step 3: Implement `addTodayTask`**
  Add `addTodayTask` to the end of `src/store/taskOps.ts`:
  ```typescript
  export function addTodayTask(
    tasks: Task[],
    title: string,
    today: string,
    id: string,
    now: string,
  ): Task[] {
    const trimmed = title.trim();
    if (!trimmed) return tasks;
    const task: Task = {
      id,
      title: trimmed,
      status: "open",
      parent_id: null,
      created_at: now,
      updated_at: now,
      custom_fields: { scheduled_dates: [today], is_adhoc: "true" },
    };
    return [...tasks, task];
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm test -- --run src/store/taskOps.test.ts`
  Expected: PASS (8 tests total in taskOps.test.ts)

- [ ] **Step 5: Commit changes**
  Run: `git add src/store/taskOps.ts src/store/taskOps.test.ts`
  Run: `git commit -m "feat(slice-1): taskOps.addTodayTask 純函式"`

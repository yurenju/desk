import { describe, it, expect, beforeEach } from "vitest";
import { useTaskDetailStore } from "./store";

beforeEach(() => useTaskDetailStore.setState({ openId: null }));

describe("useTaskDetailStore", () => {
  it("opens and closes by task id", () => {
    useTaskDetailStore.getState().open("t1");
    expect(useTaskDetailStore.getState().openId).toBe("t1");
    useTaskDetailStore.getState().close();
    expect(useTaskDetailStore.getState().openId).toBeNull();
  });
});

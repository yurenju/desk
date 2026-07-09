import { describe, it, expect, beforeEach } from "vitest";
import { useTaskDetailStore } from "./store";

beforeEach(() => useTaskDetailStore.setState({ openId: null, trail: [] }));

describe("useTaskDetailStore", () => {
  it("opens and closes by task id", () => {
    useTaskDetailStore.getState().open("t1");
    expect(useTaskDetailStore.getState().openId).toBe("t1");
    useTaskDetailStore.getState().close();
    expect(useTaskDetailStore.getState().openId).toBeNull();
  });

  it("open resets the trail", () => {
    useTaskDetailStore.setState({ openId: "a", trail: ["x"] });
    useTaskDetailStore.getState().open("b");
    expect(useTaskDetailStore.getState()).toMatchObject({ openId: "b", trail: [] });
  });

  it("push moves the current task onto the trail", () => {
    useTaskDetailStore.getState().open("parent");
    useTaskDetailStore.getState().push("child");
    expect(useTaskDetailStore.getState()).toMatchObject({ openId: "child", trail: ["parent"] });
  });

  it("back pops the trail back to the parent", () => {
    useTaskDetailStore.setState({ openId: "child", trail: ["parent"] });
    useTaskDetailStore.getState().back();
    expect(useTaskDetailStore.getState()).toMatchObject({ openId: "parent", trail: [] });
  });

  it("back with an empty trail closes the modal", () => {
    useTaskDetailStore.setState({ openId: "only", trail: [] });
    useTaskDetailStore.getState().back();
    expect(useTaskDetailStore.getState().openId).toBeNull();
  });

  it("close clears the trail", () => {
    useTaskDetailStore.setState({ openId: "child", trail: ["parent"] });
    useTaskDetailStore.getState().close();
    expect(useTaskDetailStore.getState()).toMatchObject({ openId: null, trail: [] });
  });
});

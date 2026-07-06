import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { TaskComment } from "@/lib/types";
import { CommentSection } from "./CommentSection";

const base: TaskComment = {
  id: "c1",
  content: "line1\nline2",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

const noop = () => {};

function renderSection(overrides: Partial<Parameters<typeof CommentSection>[0]> = {}) {
  return render(
    <CommentSection
      comments={[]}
      status="ready"
      onAdd={noop}
      onEdit={noop}
      onRemove={noop}
      {...overrides}
    />,
  );
}

describe("CommentSection", () => {
  it("shows only the input when there are no comments", () => {
    renderSection();
    expect(screen.getByPlaceholderText("新增留言…")).toBeInTheDocument();
    expect(screen.queryByLabelText("刪除留言")).not.toBeInTheDocument();
  });

  it("renders comment content preserving newlines", () => {
    renderSection({ comments: [base] });
    const el = screen.getByText((_, node) => node?.textContent === "line1\nline2");
    expect(el).toBeInTheDocument();
  });

  it("marks edited comments", () => {
    renderSection({ comments: [{ ...base, updated_at: "2026-07-02T00:00:00.000Z" }] });
    expect(screen.getByText(/已編輯/)).toBeInTheDocument();
  });

  it("submits a new comment on Enter and clears the input", () => {
    const onAdd = vi.fn();
    renderSection({ onAdd });
    const input = screen.getByPlaceholderText("新增留言…");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("hello");
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("does not submit on Shift+Enter", () => {
    const onAdd = vi.fn();
    renderSection({ onAdd });
    const input = screen.getByPlaceholderText("新增留言…");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("edits a comment via the edit button, committing on Enter", () => {
    const onEdit = vi.fn();
    renderSection({ comments: [base], onEdit });
    fireEvent.click(screen.getByLabelText("編輯留言"));
    const area = screen.getByLabelText("編輯留言內容");
    expect((area as HTMLTextAreaElement).value).toBe("line1\nline2");
    fireEvent.change(area, { target: { value: "edited" } });
    fireEvent.blur(area);
    expect(onEdit).toHaveBeenCalledWith("c1", "edited");
  });

  it("cancels an edit on Escape", () => {
    const onEdit = vi.fn();
    renderSection({ comments: [base], onEdit });
    fireEvent.click(screen.getByLabelText("編輯留言"));
    const area = screen.getByLabelText("編輯留言內容");
    fireEvent.keyDown(area, { key: "Escape" });
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("編輯留言")).toBeInTheDocument();
  });

  it("removes a comment via the delete button", () => {
    const onRemove = vi.fn();
    renderSection({ comments: [base], onRemove });
    fireEvent.click(screen.getByLabelText("刪除留言"));
    expect(onRemove).toHaveBeenCalledWith("c1");
  });

  it("shows loading and error states", () => {
    const { rerender } = renderSection({ status: "loading" });
    expect(screen.getByText("載入中…")).toBeInTheDocument();
    rerender(
      <CommentSection comments={[]} status="error" onAdd={noop} onEdit={noop} onRemove={noop} />,
    );
    expect(screen.getByText("留言載入失敗")).toBeInTheDocument();
  });
});

import { describe, it } from "vitest";
import { render } from "@testing-library/react";
import { DeleteUndoToast } from "./DeleteUndoToast";

// Undo-after-delete was removed in Slice 2b (delete is now a server soft-delete).
// DeleteUndoToast is a no-op stub; the only test that remains is that it renders
// without throwing.
describe("DeleteUndoToast", () => {
  it("renders without throwing", () => {
    render(<DeleteUndoToast />);
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "./Menu";

describe("Menu", () => {
  it("opens on trigger click and fires item onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu
        ariaLabel="動作"
        trigger={<button type="button">⋯</button>}
        items={[
          { key: "a", label: "移到計畫內", onSelect },
          { key: "b", label: "刪除", onSelect: () => {}, danger: true },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "⋯" }));
    await user.click(await screen.findByRole("menuitem", { name: "移到計畫內" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders action-mode items as menuitem (not menuitemradio)", async () => {
    const user = userEvent.setup();
    render(
      <Menu
        ariaLabel="動作"
        trigger={<button type="button">⋯</button>}
        items={[
          { key: "a", label: "移到計畫內", onSelect: () => {} },
          { key: "b", label: "刪除", onSelect: () => {}, danger: true },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "⋯" }));
    expect(await screen.findAllByRole("menuitem")).toHaveLength(2);
    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });

  it("single-select mode uses menuitemradio with announced checked state", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu
        ariaLabel="優先權"
        selectedKey="2"
        trigger={<button type="button">2</button>}
        items={[
          { key: "1", label: "今日第一", onSelect },
          { key: "2", label: "今日第二", onSelect: () => {} },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "2" }));
    const selected = await screen.findByRole("menuitemradio", { name: /今日第二/ });
    expect(selected).toHaveAttribute("aria-checked", "true");
    const other = screen.getByRole("menuitemradio", { name: /今日第一/ });
    expect(other).toHaveAttribute("aria-checked", "false");
    await user.click(other);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("fires onSelect when a radio item is chosen", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu
        ariaLabel="優先權"
        selectedKey="1"
        trigger={<button type="button">1</button>}
        items={[
          { key: "1", label: "今日第一", onSelect: () => {} },
          { key: "2", label: "今日第二", onSelect },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /今日第二/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not fire onSelect for a disabled radio item", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu
        ariaLabel="優先權"
        selectedKey="1"
        trigger={<button type="button">1</button>}
        items={[
          { key: "1", label: "今日第一", onSelect: () => {} },
          { key: "2", label: "今日第二", onSelect, disabled: true },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /今日第二/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

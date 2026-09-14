// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Anchor } from "@/entities/project";

import { AnchorReferencePicker } from "./anchor-reference-picker";

const anchor: Anchor = {
  id: "anchor-a",
  label: "A",
  lift: 0.5,
  lift_axis: "world_up",
  surface_normal: [0, 1, 0],
  surface_position: [0, 0, 0],
};

describe("AnchorReferencePicker", () => {
  afterEach(cleanup);

  it("selects once while preserving textarea focus", () => {
    const onSelect = vi.fn();
    render(
      <>
        <textarea aria-label="Message" />
        <AnchorReferencePicker anchors={[anchor]} onSelect={onSelect} />
      </>,
    );
    const textarea = screen.getByRole("textbox", { name: "Message" });
    const helper = screen.getByRole("button", { name: "A" });
    textarea.focus();

    fireEvent.pointerDown(helper);
    fireEvent.click(helper);

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(anchor);
    expect(document.activeElement).toBe(textarea);

    fireEvent.keyDown(document.activeElement!, { code: "Space", key: " " });
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("is excluded from the Tab order", () => {
    render(<AnchorReferencePicker anchors={[anchor]} onSelect={vi.fn()} />);

    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "A" }).tabIndex,
    ).toBe(-1);
  });

  it("keeps button semantics without submitting its parent form", () => {
    const onSelect = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <AnchorReferencePicker anchors={[anchor]} onSelect={onSelect} />
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "A" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "A" }).getAttribute("type")).toBe(
      "button",
    );
  });
});

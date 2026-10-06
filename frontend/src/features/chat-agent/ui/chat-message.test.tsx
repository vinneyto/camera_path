// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { ChatMessage } from "./chat-message";

afterEach(cleanup);

it("renders assistant Markdown and GFM inside the chat message", () => {
  const content = `# Camera plan

Move **slowly** and *smoothly* using \`speed\`.

- Start at A
- Finish at B

1. Check the path
2. Play it

> Keep the camera level.

[Documentation](https://example.com/docs)

\`\`\`ts
const position = [1, 2, 3];
  move(position);
\`\`\`

| Anchor | Speed |
| :--- | ---: |
| A | 2 |
`;
  const { container } = render(
    <ChatMessage id="message" content={content} role="assistant" />,
  );

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Camera plan",
  );
  expect(screen.getAllByRole("list")).toHaveLength(2);
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(container.querySelector("strong")?.textContent).toBe("slowly");
  expect(container.querySelector("em")?.textContent).toBe("smoothly");
  expect(container.querySelector("blockquote")?.textContent).toContain(
    "camera level",
  );
  expect(container.querySelector("code")?.textContent).toBe("speed");
  expect(screen.getByLabelText("Code block").textContent).toBe(
    "const position = [1, 2, 3];\n  move(position);\n",
  );
  expect(screen.getByLabelText("Code block").getAttribute("tabindex")).toBe(
    "0",
  );
  expect(screen.getByRole("table").parentElement).toBe(
    screen.getByRole("region", { name: "Table" }),
  );
  expect(
    screen.getAllByRole("columnheader").map((cell) => cell.textContent),
  ).toEqual(["Anchor", "Speed"]);
  expect(
    screen.getByRole("columnheader", { name: "Speed" }).style.textAlign,
  ).toBe("right");
  const link = screen.getByRole("link", { name: "Documentation" });
  expect(link.getAttribute("href")).toBe("https://example.com/docs");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});

it("renders partial responses safely and matches the reopened final message", () => {
  const { container, rerender, unmount } = render(
    <ChatMessage
      id="message"
      content={"## Plan\n\n**Moving"}
      role="assistant"
    />,
  );
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Plan");
  expect(container.textContent).toContain("Moving");

  rerender(
    <ChatMessage
      id="message"
      content={"## Plan\n\n```ts\nmove("}
      role="assistant"
    />,
  );
  expect(screen.getByLabelText("Code block").textContent).toBe("move(\n");

  const content = "## Plan\n\n```ts\nmove([1, 2, 3]);\n```\n\n**Done**";
  rerender(<ChatMessage id="message" content={content} role="assistant" />);
  const completed = container.innerHTML;
  unmount();
  const reopened = render(
    <ChatMessage id="message" content={content} role="assistant" />,
  );
  expect(reopened.container.innerHTML).toBe(completed);
});

it("ignores raw HTML and unsafe links while preserving literal code", () => {
  const content = `<script>alert('unsafe')</script>

<iframe src="https://example.com"></iframe>

<img src="x" onerror="alert('unsafe')" />

[Unsafe](javascript:alert%281%29) [Data](data:text/html,unsafe)

\`<script>alert('example')</script>\`

\`\`\`html
<img src="x" onerror="alert('example')" />
\`\`\``;
  const { container } = render(
    <ChatMessage id="message" content={content} role="assistant" />,
  );
  expect(container.querySelector("script,iframe,img")).toBeNull();
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(container.querySelector("code")?.textContent).toBe(
    "<script>alert('example')</script>",
  );
  expect(screen.getByLabelText("Code block").textContent).toContain("onerror");
});

it("keeps user messages as literal text", () => {
  const content = "# Heading\n**literal**\n<script>literal</script>";
  const { container } = render(
    <ChatMessage id="message" content={content} role="user" />,
  );
  expect(container.querySelector("p")?.textContent).toBe(content);
  expect(container.querySelector("h1,strong,script")).toBeNull();
});

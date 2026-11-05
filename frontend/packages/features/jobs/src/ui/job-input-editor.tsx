"use client";

import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useTheme } from "@camera-path/ui-kit/theme/theme-provider";

const extensions = [
  json(),
  linter(jsonParseLinter()),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ "aria-label": "Job input JSON" }),
];

export default function JobInputEditor({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
}) {
  const { theme } = useTheme();

  return (
    <CodeMirror
      className="overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring"
      value={value}
      onChange={onChange}
      minHeight="10rem"
      maxHeight="22rem"
      theme={theme}
      readOnly={readOnly}
      editable={!readOnly}
      extensions={extensions}
    />
  );
}

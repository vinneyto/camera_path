"use client";

import { ArrowLeft, Search } from "lucide-react";
import { useId, useRef, useState } from "react";

export interface CommandPaletteItem {
  id: string;
  label: string;
  searchText?: string;
}

export type CommandPaletteCommand =
  | { id: string; label: string; onSelect: () => void }
  | {
      id: string;
      label: string;
      items: CommandPaletteItem[];
      onSelectItem: (id: string) => void;
      loading?: boolean;
      error?: string;
      emptyMessage: string;
    };

interface CommandPaletteProps {
  commands: CommandPaletteCommand[];
  disabled?: boolean;
}

export function CommandPalette({
  commands,
  disabled = false,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const command = commands.find((item) => item.id === commandId);
  const items = command && "items" in command ? command.items : commands;
  const filtered = items.filter((item) =>
    `${item.label} ${"searchText" in item ? (item.searchText ?? "") : ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const loading = command && "items" in command && command.loading;
  const error = command && "items" in command && command.error;

  function choose(index: number) {
    const item = filtered[index];
    if (!item || disabled) return;
    if (command && "items" in command) {
      command.onSelectItem(item.id);
      setOpen(false);
      setCommandId(null);
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.blur();
    } else {
      const selected = commands.find((candidate) => candidate.id === item.id);
      if (!selected) return;
      if ("items" in selected) {
        setCommandId(selected.id);
        setQuery("");
        setActiveIndex(0);
        inputRef.current?.focus();
      } else {
        selected.onSelect();
        setOpen(false);
        setQuery("");
        setActiveIndex(0);
        inputRef.current?.blur();
      }
    }
  }

  function goBack() {
    setCommandId(null);
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  return (
    <div
      className="relative rounded-lg border bg-background/95 text-xs shadow-lg"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setCommandId(null);
          setQuery("");
        }
      }}
    >
      <div className="flex items-center gap-2 px-3">
        {commandId ? (
          <button
            aria-label="Back to commands"
            className="rounded p-1 hover:bg-accent"
            onClick={goBack}
            type="button"
          >
            <ArrowLeft className="size-4" />
          </button>
        ) : (
          <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        )}
        <input
          aria-controls={listId}
          aria-expanded={open}
          aria-label={
            commandId
              ? `Search ${command?.label ?? "items"}`
              : "Search commands"
          }
          className="h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              if (commandId) goBack();
              else {
                setOpen(false);
                setQuery("");
                inputRef.current?.blur();
              }
            } else if (event.key === "ArrowDown" && filtered.length) {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % filtered.length);
              setOpen(true);
            } else if (event.key === "ArrowUp" && filtered.length) {
              event.preventDefault();
              setActiveIndex(
                (index) => (index - 1 + filtered.length) % filtered.length,
              );
              setOpen(true);
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (open) choose(activeIndex);
              else setOpen(true);
            }
          }}
          placeholder={
            commandId
              ? `Search ${command?.label ?? "items"}…`
              : "Search commands…"
          }
          ref={inputRef}
          role="combobox"
          value={query}
        />
      </div>
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-background p-1 shadow-lg"
          id={listId}
          role="listbox"
        >
          {commandId && (
            <p className="px-2 py-1 font-medium text-muted-foreground">
              {command?.label}
            </p>
          )}
          {loading ? (
            <p className="px-2 py-2 text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="px-2 py-2 text-destructive" role="alert">
              {error}
            </p>
          ) : filtered.length ? (
            filtered.map((item, index) => (
              <button
                aria-selected={activeIndex === index}
                className="block w-full rounded px-2 py-2 text-left hover:bg-accent aria-selected:bg-accent"
                key={item.id}
                onClick={() => choose(index)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                {item.label}
              </button>
            ))
          ) : (
            <p className="px-2 py-2 text-muted-foreground">
              {command && "items" in command && !query
                ? command.emptyMessage
                : "No matches."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

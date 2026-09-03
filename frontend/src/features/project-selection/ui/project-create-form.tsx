"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";

import { Button, Input } from "@/shared/ui";

interface ProjectCreateFormProps {
  disabled?: boolean;
  onCreate: (name: string) => Promise<boolean>;
}

export function ProjectCreateForm({ disabled, onCreate }: ProjectCreateFormProps) {
  const [name, setName] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (await onCreate(trimmedName)) setName("");
  }

  return (
    <form className="flex gap-2" onSubmit={handleSubmit}>
      <Input
        aria-label="Project name"
        placeholder="New project name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button disabled={disabled || !name.trim()} type="submit">
        <Plus className="size-3.5" />
        Create
      </Button>
    </form>
  );
}

"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { LibraryAsset } from "@/shared/api/generated/model";
import { Button, ConfirmationDialog, DropdownMenu } from "@/shared/ui";
import type { useDeleteLibraryAssets } from "../api/use-delete-library-assets";

interface LibrarySelectionActionsProps {
  selected: LibraryAsset[];
  onDeleted: () => void;
  deletion: ReturnType<typeof useDeleteLibraryAssets>;
}

export function LibrarySelectionActions({
  selected,
  onDeleted,
  deletion,
}: LibrarySelectionActionsProps) {
  const [confirmation, setConfirmation] = useState<LibraryAsset[] | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function confirmDelete() {
    if (!confirmation?.length || deletion.isPending) return;
    deletion.mutate(
      confirmation.map((asset) => asset.id),
      {
        onSuccess: () => {
          setConfirmation(null);
          onDeleted();
        },
      },
    );
  }

  return (
    <>
      <DropdownMenu
        trigger={
          <Button
            ref={trigger}
            variant="outline"
            size="sm"
            disabled={deletion.isPending}
            type="button"
          >
            Actions <ChevronDown className="size-3.5" />
          </Button>
        }
        items={[
          {
            label: "Delete selected",
            destructive: true,
            disabled: !selected.length,
            onSelect: () => {
              deletion.reset();
              setConfirmation([...selected]);
            },
          },
        ]}
        onCloseAutoFocus={(event) => {
          if (confirmation) event.preventDefault();
        }}
      />
      <ConfirmationDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={`Delete ${confirmation?.length ?? 0} library ${confirmation?.length === 1 ? "file" : "files"}?`}
        description="These files and every instance of them will be removed from all projects. This action cannot be undone."
        confirmLabel="Delete selected"
        pending={deletion.isPending}
        error={
          deletion.error
            ? "Could not delete the selected files. Please try again or reload the library."
            : undefined
        }
        onConfirm={confirmDelete}
        returnFocusRef={trigger}
      >
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
          {confirmation?.map((asset) => (
            <li className="break-words" key={asset.id}>
              {asset.name}
            </li>
          ))}
        </ul>
      </ConfirmationDialog>
    </>
  );
}

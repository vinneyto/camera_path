export interface CommandPaletteItem {
  id: string;
  label: string;
  searchText?: string;
}
export type CommandPaletteCommand =
  | { id: string; label: string; onSelect: () => void; checked?: boolean }
  | {
      id: string;
      label: string;
      items: CommandPaletteItem[];
      onSelectItem: (id: string) => void;
      loading?: boolean;
      error?: string;
      emptyMessage: string;
    };
export interface CommandState {
  readonly commands: CommandPaletteCommand[];
  readonly disabled: boolean;
  readonly error: string | null;
}

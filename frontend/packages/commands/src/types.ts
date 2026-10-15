export interface CommandPaletteItem {
  id: string;
  label: string;
  searchText?: string;
  disabled?: boolean;
}
export type CommandPaletteCommand = CommandPaletteItem &
  (
    | { onSelect: () => void; checked?: boolean }
    | {
        items: CommandPaletteItem[];
        onSelectItem: (id: string) => void;
        loading?: boolean;
        error?: string;
        emptyMessage: string;
      }
  );
export interface CommandState {
  readonly commands: readonly CommandPaletteCommand[];
  readonly disabled: boolean;
  readonly error: string | null;
}

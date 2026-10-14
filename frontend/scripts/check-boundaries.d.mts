export function checkSource(
  fileName: string,
  source: string,
  resolve: (specifier: string, fileName: string) => string | undefined,
): string[];
export function checkWorkspace(root: string): string[];

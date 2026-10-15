import { Slot } from "@camera-path/slots";
import { ResourceScopeProvider } from "@camera-path/store";
import { AuthControl } from "@host/ui/header";
export default async function LibraryAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  return (
    <ResourceScopeProvider key={assetId} assetId={assetId}>
      <div className="mx-auto max-w-3xl px-5 pt-8">
        <div className="flex justify-end">
          <AuthControl />
        </div>
      </div>
      <Slot name="library.details" />
    </ResourceScopeProvider>
  );
}

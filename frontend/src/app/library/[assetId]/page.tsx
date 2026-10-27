import { Slot } from "@camera-path/slots";
import { ResourceScopeProvider } from "@camera-path/store";

export default async function LibraryAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  return (
    <ResourceScopeProvider key={assetId} assetId={assetId}>
      <Slot name="library.details" />
    </ResourceScopeProvider>
  );
}

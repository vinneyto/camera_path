import { ExtensionSlot } from "@camera-path/extension-api";
import { LibraryAssetHostProvider } from "@host/runtime/library-asset-host-provider";

interface LibraryAssetPageProps {
  params: Promise<{ assetId: string }>;
}

export default async function LibraryAssetPage({
  params,
}: LibraryAssetPageProps) {
  const { assetId } = await params;
  return (
    <LibraryAssetHostProvider key={assetId} assetId={assetId}>
      <ExtensionSlot name="library.details" />
    </LibraryAssetHostProvider>
  );
}

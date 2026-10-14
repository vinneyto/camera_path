import { LibraryAssetDetails } from "@camera-path/feature-library";
import { LibraryAssetHostProvider } from "@host/runtime/library-asset-host-provider";
import { AuthControl } from "@host/ui/header";

interface LibraryAssetPageProps {
  params: Promise<{ assetId: string }>;
}

export default async function LibraryAssetPage({
  params,
}: LibraryAssetPageProps) {
  const { assetId } = await params;
  return (
    <LibraryAssetHostProvider key={assetId} assetId={assetId}>
      <LibraryAssetDetails assetId={assetId} header={<AuthControl />} />
    </LibraryAssetHostProvider>
  );
}

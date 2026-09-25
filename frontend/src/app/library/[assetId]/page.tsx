import { LibraryAssetDetails } from "@/features/library";

interface LibraryAssetPageProps {
  params: Promise<{ assetId: string }>;
}

export default async function LibraryAssetPage({
  params,
}: LibraryAssetPageProps) {
  const { assetId } = await params;
  return <LibraryAssetDetails assetId={assetId} />;
}

import { FeaturePageRoute } from "@host/ui/feature-page-route";

export default async function FeatureRoute({
  params,
}: {
  params: Promise<{ featurePath: string[] }>;
}) {
  const { featurePath } = await params;
  return <FeaturePageRoute path={`/${featurePath.join("/")}`} />;
}

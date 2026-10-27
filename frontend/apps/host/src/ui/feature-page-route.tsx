import { notFound } from "next/navigation";
import { featurePages } from "@host/composition/feature-pages";

export function FeaturePageRoute({ path }: { path: string }) {
  const page = featurePages.find((page) => page.path === path);
  if (!page) notFound();
  const Component = page.component;
  return <Component key={page.path} />;
}

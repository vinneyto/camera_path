import { collectFeaturePages } from "./collect-feature-pages";
import { featureSlots } from "./feature-slots";

/** The same static declarations supply server routes and both navigation layouts. */
export const featurePages = collectFeaturePages(featureSlots);

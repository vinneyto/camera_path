"use client";
import { useAnchors } from "@camera-path/api/resources";

import { Badge } from "@camera-path/ui-kit";
import { MapPin } from "lucide-react";
export function AnchorStatus() {
  const query = useAnchors();
  return (
    <Badge className="hidden gap-1 2xl:inline-flex">
      <MapPin className="size-2.5" />
      {query.data?.data.length ?? 0}
    </Badge>
  );
}

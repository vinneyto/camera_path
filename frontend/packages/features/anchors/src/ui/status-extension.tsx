"use client";
import { MapPin } from "lucide-react";
import { anchors } from "@camera-path/contracts/host-data";
import { useDataQuery } from "@camera-path/extension-api";
import { Badge } from "@camera-path/ui-kit";
import { manifest } from "../manifest";
export function StatusExtension() {
  const query = useDataQuery(manifest, anchors);
  return (
    <Badge className="hidden gap-1 2xl:inline-flex">
      <MapPin className="size-2.5" />
      {query.data?.data.length ?? 0}
    </Badge>
  );
}

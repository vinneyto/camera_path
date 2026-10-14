"use client";
import { Boxes } from "lucide-react";
import { trajectoryGeometry } from "@camera-path/contracts/host-data";
import { useDataQuery } from "@camera-path/extension-api";
import { Badge } from "@camera-path/ui-kit";
import { manifest } from "../manifest";
export function StatusExtension() {
  const query = useDataQuery(manifest, trajectoryGeometry);
  return (
    <Badge className="hidden gap-1 2xl:inline-flex">
      <Boxes className="size-2.5" />
      {query.data?.data.segments?.length ?? 0}
    </Badge>
  );
}

"use client";
import { useTrajectoryGeometry } from "@camera-path/api/resources";

import { Badge } from "@camera-path/ui-kit";
import { Boxes } from "lucide-react";
export function TrajectoryStatus() {
  const query = useTrajectoryGeometry();
  return (
    <Badge className="hidden gap-1 2xl:inline-flex">
      <Boxes className="size-2.5" />
      {query.data?.data.segments?.length ?? 0}
    </Badge>
  );
}

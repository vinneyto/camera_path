"use client";
import type { DataContract } from "@camera-path/contracts/contract-types";
import { DataCell } from "@camera-path/extension-api/data-cell";
import type { HostRuntime } from "@camera-path/extension-api/host-runtime";
import { useLayoutEffect, useState } from "react";
export function useBindValue<T>(
  runtime: HostRuntime,
  contract: DataContract<string, T>,
  value: T,
) {
  const [cell] = useState(() => {
    const c = new DataCell(contract);
    c.set(value);
    runtime.bindData(contract, c.read, c.subscribe);
    return c;
  });
  useLayoutEffect(() => {
    cell.set(value);
  }, [cell, value]);
}

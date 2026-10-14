"use client";
import type { DataContract } from "@camera-path/contracts/contract-types";
import { DataCell } from "@camera-path/extension-api/data-cell";
import type { HostRuntime } from "@camera-path/extension-api/host-runtime";
import { useLayoutEffect, useState } from "react";
export function useBindQuery<T>(
  runtime: HostRuntime,
  contract: DataContract<string, T>,
  query: {
    data?: { data: unknown; status?: number };
    error: unknown;
    isPending: boolean;
  },
) {
  const [cell] = useState(() => {
    const c = new DataCell(contract);
    runtime.bindData(contract, c.read, c.subscribe);
    return c;
  });
  const data = query.data;
  const error = query.error;
  const pending = query.isPending;
  useLayoutEffect(() => {
    if (error)
      cell.fail(error instanceof Error ? error : new Error(String(error)));
    else if (data) {
      try {
        cell.set(contract.schema.parse(data.data));
      } catch (error) {
        cell.fail(error instanceof Error ? error : new Error(String(error)));
      }
    } else if (pending) cell.loading();
  }, [cell, contract, data, error, pending]);
}

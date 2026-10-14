import type {
  DataContract,
  DataState,
} from "@camera-path/contracts/contract-types";
import { immutableValue } from "./immutable-value";
export class DataCell<T> {
  private value: DataState<T> = { status: "loading", error: null };
  private readonly listeners = new Set<() => void>();
  constructor(readonly contract: DataContract<string, T>) {}
  read = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  set(value: T) {
    const next = immutableValue(this.contract.schema.parse(value));
    this.value = { status: "ready", value: next, error: null };
    this.listeners.forEach((fn) => fn());
  }
  loading() {
    if (this.value.status === "loading") return;
    this.value = { status: "loading", error: null };
    this.listeners.forEach((fn) => fn());
  }
  fail(error: Error) {
    this.value = { status: "error", error };
    this.listeners.forEach((fn) => fn());
  }
}

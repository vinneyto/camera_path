import type {
  ContractValue,
  DataContract,
  DataState,
  RequestDefinition,
  RequestInput,
  RequestOutput,
  RequestResult,
} from "@camera-path/contracts/contract-types";
import type { FeatureManifest } from "./manifest";
export type Readable<M extends FeatureManifest> =
  M["data"]["reads"][number]["contract"];
export type Callable<M extends FeatureManifest> =
  M["requests"]["calls"][number];
export interface FeatureContext<M extends FeatureManifest> {
  readonly scopeId: string;
  readonly signal: AbortSignal;
  readonly data: {
    read<C extends Readable<M>>(contract: C): ContractValue<C>;
    state<C extends Readable<M>>(contract: C): DataState<ContractValue<C>>;
    readAsync<C extends Readable<M>>(contract: C): Promise<ContractValue<C>>;
    subscribe<C extends Readable<M>>(
      contract: C,
      listener: () => void,
    ): () => void;
    provide<C extends M["data"]["provides"][number]>(
      contract: C,
      value: ContractValue<C>,
    ): void;
  };
  readonly requests: {
    call<C extends Callable<M>>(
      contract: C,
      input: RequestInput<C>,
      options?: { signal?: AbortSignal; timeoutMs?: number },
    ): Promise<RequestResult<RequestOutput<C>>>;
    handle<C extends M["requests"]["handles"][number]>(
      contract: C,
      handler: (
        input: RequestInput<C>,
        signal: AbortSignal,
      ) => Promise<RequestOutput<C>> | RequestOutput<C>,
    ): () => void;
  };
}
export type AnyData = DataContract;
export type AnyRequest = RequestDefinition<string, unknown, unknown>;

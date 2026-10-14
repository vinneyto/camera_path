export interface RuntimeSchema<T> {
  parse(value: unknown): T;
}
export interface DataContract<Id extends string = string, T = unknown> {
  readonly kind: "data";
  readonly id: Id;
  readonly description: string;
  readonly schema: RuntimeSchema<T>;
}
export interface RequestDefinition<
  Id extends string = string,
  Input = unknown,
  Output = unknown,
> {
  readonly kind: "request";
  readonly id: Id;
  readonly description: string;
  readonly inputSchema: RuntimeSchema<Input>;
  readonly outputSchema: RuntimeSchema<Output>;
  readonly errorSchema: RuntimeSchema<RequestErrorCode>;
  readonly requiresEdit?: boolean;
}
export type ContractValue<C> =
  C extends DataContract<string, infer T> ? T : never;
export type RequestInput<C> =
  C extends RequestDefinition<string, infer I, unknown> ? I : never;
export type RequestOutput<C> =
  C extends RequestDefinition<string, unknown, infer O> ? O : never;
export type RequestErrorCode =
  | "forbidden"
  | "conflict"
  | "invalid-input"
  | "unavailable"
  | "cancelled"
  | "failed";
export type RequestResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: RequestErrorCode;
        readonly message: string;
      };
    };
export type DataState<T> =
  | {
      readonly status: "loading";
      readonly value?: undefined;
      readonly error: null;
    }
  | { readonly status: "ready"; readonly value: T; readonly error: null }
  | { readonly status: "error"; readonly value?: T; readonly error: Error };

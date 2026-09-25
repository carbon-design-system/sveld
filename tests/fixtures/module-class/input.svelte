<script
  context="module"
  lang="ts"
>
  import type { Options } from "./types";

  interface Snapshot<T> {
    value: T;
    at: number;
  }

  /**
   * A value holder.
   * @since 1.2.0
   */
  export class Store<T extends object = Record<string, unknown>> {
    /** Current value. */
    value: T;
    static readonly count: number = 0;
    label?: string;
    #secret = 1;
    private hidden = 2;
    protected guarded = 3;
    [key: string]: unknown;

    constructor(
      initial: T,
      public readonly name = "store",
      private options?: Options,
    ) {
      this.value = initial;
    }

    /** Creates a store. */
    static create<U extends object>(value: U): Store<U> {
      return new Store(value);
    }

    /**
     * Subscribes to changes.
     * @deprecated Use `listen` instead.
     */
    subscribe(run: (value: T) => void): () => void {
      return () => {};
    }

    snapshot(): Snapshot<T> {
      return { value: this.value, at: 0 };
    }

    format(value: string): string;
    format(value: number): string;
    format(value: string | number): string {
      return String(value);
    }

    async load(...keys: string[]) {}

    get size(): number {
      return 1;
    }

    get mode(): "a" | "b" {
      return "a";
    }

    set mode(value: "a" | "b") {}

    maybe?(): void {}

    /** @internal */
    reset(): void {
      this.tick();
      this.#hiddenMethod();
      console.log(this.#secret, this.hidden, this.options);
    }

    private tick() {}

    #hiddenMethod() {}
  }

  export abstract class Base {
    abstract run(): void;
    abstract readonly id: string;
  }
</script>

<script lang="ts">
  export let store: Store<{ id: string }>;
</script>

<div>{store.value.id}</div>

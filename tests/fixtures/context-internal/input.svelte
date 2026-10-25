<script>
  import { setContext } from "svelte";

  /**
   * Wiring between a parent and its children; not public API.
   * @internal
   */
  setContext("internal:call", { register: () => {} });

  /** @ignore */
  setContext("internal:empty", {});

  /** @internal */
  const untypedState = { open: false };

  setContext("internal:variable", untypedState);

  /** Not hidden: a plain description doesn't tag the call. */
  setContext("public", { open: false });
</script>

<slot />

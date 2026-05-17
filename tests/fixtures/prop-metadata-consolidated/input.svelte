<script lang="ts">
  const count = 2;

  function makeDefault() {
    return "generated";
  }

  export let typed: string;

  /**
   * JSDoc wins over default inference.
   * @type {number}
   */
  export let documented = 1;

  export let literalDefault = "md";
  export let boolDefault = true;
  export let arrayDefault = [1, "two", false];
  export let objectDefault = { size: "md", count: 2 };
  export let callbackDefault = (value: string) => value.toUpperCase();
  export let callDefault = makeDefault();
  export let memberDefault = Number.MAX_VALUE;

  /**
   * @type {number}
   */
  export let expressionDefault = count + 1;
  // biome-ignore lint/suspicious/noImplicitAnyLet: fixture covers unknown prop type metadata
  export let unknown;
</script>

<p>
  {typed}{documented}{literalDefault}{boolDefault}{arrayDefault.length}{objectDefault.size}{callbackDefault("x")}
  {callDefault}{memberDefault}{expressionDefault}{unknown}
</p>

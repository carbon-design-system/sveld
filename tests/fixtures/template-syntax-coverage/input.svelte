<script>
  import { flip } from "svelte/animate";

  /** @type {Promise<string[]>} */
  export let items = Promise.resolve([]);
  export let selected = "a";
  export let version = 0;

  /** @param {HTMLElement} node */
  function tooltip(node) {
    return { destroy() {} };
  }
</script>

{#await items}
  <p title="loading &amp; waiting &lt;&gt; &#169; &copy; &nbsp;done">Loading</p>
{:then list}
  {@const count = list.length}
  {@debug count}
  <ul>
    {#each list as item (item)}
      <li
        animate:flip
        use:tooltip
      >
        <label>
          <input
            type="radio"
            bind:group={selected}
            value={item}
          >
          {item}
        </label>
      </li>
    {/each}
  </ul>
{:catch failure}
  <p>{failure.message}</p>
{/await}

{#await items then list}
  <slot
    name="loaded"
    count={list.length}
  />
{/await}

{#key version}
  <span data-label="v&#x31;'s">{version}</span>
{/key}

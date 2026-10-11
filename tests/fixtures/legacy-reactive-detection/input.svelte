<script>
  // Reactive: the component writes the prop.
  export let reassigned = false;
  export let value = "";
  export let boundInput = "";
  export let pageSize = 10;
  export let ref = null;
  export let listRef = null;
  export let values = ["a"];
  export let settings = { name: "" };
  export let rows = [{ label: "" }];

  // Not reactive: only reads, or writes to a local that shadows the prop.
  export let passedThrough = false;
  export let localShadow = false;
  export let paramShadow = false;
  export let handlerShadow = false;
  export let eachShadow = false;
  export let bindShadow = "";

  const items = [true, false];
  const labels = ["a", "b"];

  function update() {
    reassigned = true;

    let localShadow = false;
    localShadow = true;
  }

  items.map((paramShadow) => {
    paramShadow = !paramShadow;
  });
</script>

<button on:click={update}>update</button>
<Search bind:value />
<input bind:value={boundInput} />
<Select bind:selected={pageSize} />
<Search bind:ref />
<ListBoxMenu bind:ref={listRef} />
{#each values as _, i}
  <input bind:value={values[i]} />
{/each}
<input bind:value={settings.name} />
<input bind:value={rows[0].label} />

<ListBox {passedThrough} />
<button
  on:click={() => {
    let handlerShadow = false;
    handlerShadow = true;
  }}
/>
{#each items as eachShadow}
  <button on:click={() => (eachShadow = !eachShadow)}>toggle</button>
{/each}
{#each labels as bindShadow}
  <Child bind:value={bindShadow} />
{/each}

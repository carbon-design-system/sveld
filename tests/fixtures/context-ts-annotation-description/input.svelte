<script lang="ts">
  import { setContext } from "svelte";

  type ModalAPI = { open: () => void };

  /** The dialog's title. */
  export let title: string = "";

  /** Opens the modal */
  const m: ModalAPI = { open: () => {} };
  setContext("modal", m);

  /** Closes the drawer */
  const close: () => void = () => {};
  setContext("drawer", { close });

  /** @internal */
  const secret: string = "";
  setContext("secret", secret);
</script>

<h2>{title}</h2>
<slot />

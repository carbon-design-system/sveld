<script>
  /** @returns {Promise<void>} */
  export async function initialize() {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * @param {string} url
   * @returns {Promise<Response>}
   */
  export async function fetchData(url) {
    return fetch(url);
  }

  /** @type {(id: number) => Promise<boolean>} */
  export let validate = async (id) => id > 0;
</script>

<button on:click={initialize}>Init</button>

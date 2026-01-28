<script>
  /**
   * @typedef {object} UserConfig
   * @property {string} id - User identifier
   * @property {string} name - User display name
   */

  /**
   * @typedef {object} ThemeConfig
   * @property {string} id - Theme identifier
   * @property {string} name - Theme display name
   */

  /** @type {UserConfig} */
  export let user = { id: "1", name: "Admin" };
  /** @type {ThemeConfig} */
  export let theme = { id: "default", name: "Default" };
</script>

<div>{user.name} | {theme.name}</div>

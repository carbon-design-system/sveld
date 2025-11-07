<script>
  /**
   * Represents a user in the system.
   *
   * @typedef {object} User
   * @property {string} name - The user's full name.
   * @property {string} email - The user's email address.
   * @property {number} age - The user's age in years.
   */

  /**
   * Configuration options for the component.
   * @typedef {object} ComponentConfig
   * @property {boolean} enabled - Whether the component is enabled.
   * @property {string} theme - The component theme.
   */

  /**
   * Simple typedef without properties (backwards compatibility test).
   * @typedef {{ id: number; label: string; }} SimpleType
   */

  /** @type {User} */
  export let user = { name: "John", email: "john@example.com", age: 30 };

  /** @type {ComponentConfig} */
  export let config = { enabled: true, theme: "dark" };

  /** @type {SimpleType} */
  export let simple = { id: 1, label: "Test" };
</script>

<div>
  <p>{user.name}</p>
  <p>{config.theme}</p>
  <p>{simple.label}</p>
</div>

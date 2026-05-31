<script>
  /**
   * A branded string. At runtime it is a plain `string`, but the brand makes it
   * a distinct domain type that other strings cannot be assigned to.
   *
   * @typedef {string & { readonly __brand: "UserId" }} UserId
   */

  /**
   * A branded number representing a monetary amount in cents.
   *
   * @typedef {number & { readonly __brand: "Cents" }} Cents
   */

  /** @type {UserId} */
  export let userId;

  /** @type {Cents} */
  export let amount;
</script>

<div data-user={userId}>{amount}</div>

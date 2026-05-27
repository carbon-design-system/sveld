<script>
  /**
   * @typedef {{ id: string; createdAt: number }} Base
   * @typedef {Base & { kind: "user"; name: string }} User
   * @typedef {Base & { kind: "post"; title: string; body: string }} Post
   * @typedef {User | Post} Entity
   */

  /** @type {Entity} */
  export let entity = { id: "1", createdAt: 0, kind: "user", name: "Ada" };
</script>

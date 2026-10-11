<script>
  /**
   * @typedef {{ kind: "success"; value: string } | { kind: "error"; error: Error }} Result
   * @typedef {{ ok: true; data: number } | { ok: false; reason: string } | "pending"} Status
   * @typedef {{ id: string; createdAt: number }} Base
   * @typedef {Base & { kind: "user"; name: string }} User
   * @typedef {Base & { kind: "post"; title: string; body: string }} Post
   * @typedef {User | Post} Entity
   */

  /** @type {Result} */
  export let result = { kind: "success", value: "ok" };

  /** @type {Status} */
  export let status = "pending";

  /** @type {Entity} */
  export let entity = { id: "1", createdAt: 0, kind: "user", name: "Ada" };
</script>

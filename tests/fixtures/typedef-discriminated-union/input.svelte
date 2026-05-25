<script>
  /**
   * @typedef {{ kind: "success"; value: string } | { kind: "error"; error: Error }} Result
   * @typedef {{ ok: true; data: number } | { ok: false; reason: string } | "pending"} Status
   */

  /** @type {Result} */
  export let result = { kind: "success", value: "ok" };

  /** @type {Status} */
  export let status = "pending";
</script>

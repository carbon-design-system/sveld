<script lang="ts">
  import TypedefDiscriminatedUnion, { type Result, type Status } from "./output";

  const success: Result = { kind: "success", value: "ok" };
  const failure: Result = { kind: "error", error: new Error("boom") };

  const pending: Status = "pending";
  const okStatus: Status = { ok: true, data: 42 };
  const failStatus: Status = { ok: false, reason: "nope" };

  function describe(r: Result): string {
    switch (r.kind) {
      case "success":
        return r.value;
      case "error":
        return r.error.message;
      default: {
        const _exhaustive: never = r;
        return _exhaustive;
      }
    }
  }
</script>

<TypedefDiscriminatedUnion
  result={success}
  status={pending}
/>

<TypedefDiscriminatedUnion
  result={failure}
  status={okStatus}
/>

<TypedefDiscriminatedUnion
  result={{ kind: "success", value: describe(success) }}
  status={failStatus}
/>

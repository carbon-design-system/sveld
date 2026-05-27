<script lang="ts">
  import TypedefDiscriminatedUnionRecursive, { type Tree } from "./output";

  const leaf: Tree = { kind: "leaf", value: 1 };
  const nested: Tree = {
    kind: "node",
    children: [
      { kind: "leaf", value: 2 },
      {
        kind: "node",
        children: [{ kind: "leaf", value: 3 }],
      },
    ],
  };

  function sum(t: Tree): number {
    switch (t.kind) {
      case "leaf":
        return t.value;
      case "node":
        return t.children.reduce((acc, child) => acc + sum(child), 0);
      default: {
        const _exhaustive: never = t;
        return _exhaustive;
      }
    }
  }
</script>

<TypedefDiscriminatedUnionRecursive tree={leaf} />
<TypedefDiscriminatedUnionRecursive tree={nested} />
<TypedefDiscriminatedUnionRecursive tree={{ kind: "leaf", value: sum(nested) }} />

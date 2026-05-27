<script lang="ts">
  import TypedefDiscriminatedUnionIntersection, { type Base, type Entity, type Post, type User } from "./output";

  const user: User = { id: "1", createdAt: 0, kind: "user", name: "Ada" };
  const post: Post = {
    id: "2",
    createdAt: 1,
    kind: "post",
    title: "Hello",
    body: "world",
  };

  function describe(e: Entity): string {
    // The shared base is available before narrowing.
    const _shared: Base = { id: e.id, createdAt: e.createdAt };
    void _shared;

    switch (e.kind) {
      case "user":
        return e.name;
      case "post":
        return e.title + ": " + e.body;
      default: {
        const _exhaustive: never = e;
        return _exhaustive;
      }
    }
  }
</script>

<TypedefDiscriminatedUnionIntersection entity={user} />
<TypedefDiscriminatedUnionIntersection entity={post} />
<TypedefDiscriminatedUnionIntersection
  entity={{
    id: "3",
    createdAt: 2,
    kind: "user",
    name: describe(post),
  }}
/>

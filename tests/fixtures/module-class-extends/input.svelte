<script
  context="module"
  lang="ts"
>
  import type { Disposable, Named } from "./base.js";
  import { Base } from "./base.js";

  /** A store built on `Base` */
  export class Store<T> extends Base<T> implements Disposable {
    dispose(): void {}
  }

  export class NamedStore extends Store<string> implements Named {
    name = "store";
  }

  class Hidden {
    secret = 1;
  }

  export class FromHidden extends Hidden {}
</script>

<div />

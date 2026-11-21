import { hydrate, mount } from "svelte";
import "carbon-components-svelte/css/all.css";
import App from "./App.svelte";
import { initTheme } from "./theme";

initTheme();
// The build prerenders index.html; the dev server serves it empty.
(import.meta.env.DEV ? mount : hydrate)(App, { target: document.body });
performance.mark("hydrated");

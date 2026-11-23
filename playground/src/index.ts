import { hydrate, mount } from "svelte";
import "carbon-components-svelte/css/all.css";
import App from "./App.svelte";
import { initTheme } from "./theme";

initTheme();
// The build prerenders the page; the dev server serves it empty.
(document.body.firstElementChild ? hydrate : mount)(App, { target: document.body });
performance.mark("hydrated");

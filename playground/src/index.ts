import { mount } from "svelte";
import "carbon-components-svelte/css/all.css";
import App from "./App.svelte";
import { initTheme } from "./theme";

initTheme();
mount(App, { target: document.body });

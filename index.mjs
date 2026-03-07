export { cli, default as ComponentParser, sveld } from "./lib/index.js";

import mod from "./lib/index.js";
export default typeof mod === "function" ? mod : mod.default;

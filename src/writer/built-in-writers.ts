import { registerWriter } from "./registry";
import writeCustomElements from "./writer-custom-elements";
import writeJson from "./writer-json";
import writeMarkdown from "./writer-markdown";
import writeTsDefinitions from "./writer-ts-definitions";

registerWriter({ name: "json", componentSet: "exported", write: writeJson });
registerWriter({ name: "markdown", componentSet: "exported", write: writeMarkdown });
registerWriter({ name: "types", componentSet: "all", write: writeTsDefinitions });
registerWriter({ name: "custom-elements", componentSet: "exported", write: writeCustomElements });

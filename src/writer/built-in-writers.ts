import { registerWriter } from "./registry";
import writeCustomElements from "./writer-custom-elements";
import writeJson from "./writer-json";
import writeLlms from "./writer-llms";
import writeMarkdown from "./writer-markdown";
import writeMigrationReport from "./writer-migration-report";
import writeTsDefinitions from "./writer-ts-definitions";

registerWriter({ name: "json", componentSet: "exported", write: writeJson });
registerWriter({ name: "markdown", componentSet: "exported", write: writeMarkdown });
registerWriter({ name: "types", componentSet: "all", write: writeTsDefinitions });
registerWriter({ name: "custom-elements", componentSet: "exported", write: writeCustomElements });
registerWriter({ name: "llms", componentSet: "exported", write: writeLlms });
registerWriter({ name: "migration-report", componentSet: "all", write: writeMigrationReport });

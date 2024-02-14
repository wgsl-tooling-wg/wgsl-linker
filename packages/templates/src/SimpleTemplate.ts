import { Template } from "../../linker/src/ModuleRegistry2.js";
import { replaceTokens3 } from "../../linker/src/Util.js";

export const simpleTemplate: Template = {
  name: "simple",
  apply: (src, extParams) => {
    return replaceTokens3(src, extParams);
  }
};
import { Template } from "../ModuleRegistry.ts";
import { sliceReplace, sliceWords } from "../Slicer.ts";

export const simpleTemplate: Template = {
  name: "simple",
  apply: (src, extParams) => {
    const slices = sliceWords(src, extParams);
    return sliceReplace(src, slices);
  },
};

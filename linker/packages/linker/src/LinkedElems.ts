import { CallElem, FnElem } from "./AbstractElems.js";
import { TextModule } from "./ParseModule.js";

/** this is starting to look a lot like a FoundRef */
export interface LinkedCall {
  call: CallElem;
  targetFn: FnElem;
  targetModule: TextModule;
}

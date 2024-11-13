import { CallElem, FnElem } from "./AbstractElems.ts";
import { TextModule } from "./ParseModule.ts";

/** this is starting to look a lot like a FoundRef */
export interface LinkedCall {
  call: CallElem;
  targetFn: FnElem;
  targetModule: TextModule;
}

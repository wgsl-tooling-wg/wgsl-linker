import { FoundRef } from "./TraverseRefs.js";


/**
 * unique id for a future root level element in the form:
 *    moduleName.elemName(impParam1, impParam2, ...)
 * We'll eventually give each unique element a unique fn, struct or variable name
 * in the linked source.
 */
export function refFullName(ref: FoundRef): string {
  return ref.expMod.modulePath + "." + ref.elem.name;
}


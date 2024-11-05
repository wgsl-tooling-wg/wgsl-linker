import { dlog } from "berry-pretty";
import { AbstractElem, CallElem, FnElem } from "./AbstractElems.js";
import { FoundRef, TextRef } from "./TraverseRefs.js";

export function printRef(r: FoundRef, msg = ""): void {
  const { kind, elem, rename } = r as TextRef;
  const renameFields = rename ? { rename } : {};
  dlog(
    msg,
    {
      kind,
      ...renameFields,
    },
    elemToText("elem", elem),
  );
}

type SomeElem = Partial<CallElem> & Partial<FnElem>;
export function elemToText(msg: string, elem?: AbstractElem): string {
  if (!elem) return "";
  const { kind, ref, name = "", typeRefs = [] } = elem as SomeElem;
  const refText = ref ? `ref: true, ` : "";
  const typeRefsText =
    typeRefs.length > 0 ?
      `typeRefs: [${typeRefs.map(tr => tr.name).join(", ")}]`
    : "";

  return `${msg}: {kind: "${kind}", name: "${name}" ${refText} ${typeRefsText}}`;
}

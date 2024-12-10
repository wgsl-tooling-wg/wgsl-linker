import { ExtendedResult } from "mini-parse";
import { CallElem, TypeRefElem } from "./AbstractElems.ts";
import { makeElem } from "./ParseSupport.ts";

interface IdentLocation {
  name: string;
  start: number;
  end: number;
}

/** Make a TypeRefElem if the ident value starts with an upper case letter,
 * and push the elem into the result tags.
 * Otherwise, make and IdentLocation and return that.
 * TODO-lee this keeps some tests alive, but drop this hack soon, when we get rid of typeRefs.
 */
export function identToTypeRefOrLocation(
  r: ExtendedResult<any>,
): IdentLocation[] {
  const firstChar = r.value[0];
  if (firstChar === firstChar.toUpperCase()) {
    // ctxLog(r.ctx, `making typeRef ${r.value}`);
    const e = makeElem("typeRef", r as ExtendedResult<any>);
    e.name = r.value;
    const typeRef = e as Required<typeof e>;
    const tags = r.tags as Record<string, any>;
    const refs = (tags.typeRefs as TypeRefElem[]) || [];
    refs.push(typeRef);
    tags.typeRefs = refs;
    return [];
  } else {
    const identLocation: IdentLocation = {
      name: r.value,
      start: r.start,
      end: r.end,
    };
    return [identLocation];
  }
}

/** Make a call elem if there's an "identLoc" tag from identToTypeRefOrLocation.
 *
 * TODO-lee this keeps some tests alive, but drop this hack soon.
 */
export function identLocToCallElem(r: ExtendedResult<any>): CallElem[] {
  const idents = (r.tags.identLoc as IdentLocation[][]).flat();
  const calls: CallElem[] = idents.map(i => ({
    kind: "call",
    name: i.name,
    start: i.start,
    end: i.end,
  }));
  return calls;
}

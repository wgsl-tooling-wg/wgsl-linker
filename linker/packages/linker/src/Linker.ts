import {
  AliasElem,
  FnElem,
  GlobalDirectiveElem,
  StructElem,
  StructMemberElem,
  TypeRefElem,
  VarElem,
} from "./AbstractElems.js";
import { RegistryParams } from "./ModuleRegistry.js";
import { ParsedRegistry } from "./ParsedRegistry.js";
import { TextModule } from "./ParseModule.js";
import { SliceReplace, sliceReplace } from "./Slicer.js";
import { FoundRef, TextRef, traverseRefs } from "./TraverseRefs.js";

type DirectiveRef = {
  kind: "dir";
  expMod: TextModule;
  elem: GlobalDirectiveElem;
};

type LoadableRef = TextRef | DirectiveRef;

/**
 * Produce a linked wgsl string with all directives processed
 * (e.g. #import'd functions from other modules are inserted into the resulting string).
 *
 * @param runtimeParams runtime parameters for future codnitional compilation
 */
export function linkWgslModule(
  srcModule: TextModule,
  registry: ParsedRegistry,
  extParams: Record<string, any> = {},
): string {
  const loadRefs = findReferences(srcModule, registry); // all recursively referenced structs and fns

  // convert global directives into LoadableRefs
  const directiveRefs = globalDirectiveRefs(srcModule);

  // extract export texts, rewriting via rename map and exp/imp args
  const extractRefs = [...loadRefs, ...directiveRefs];
  return extractTexts(extractRefs);
}

/** Find references to elements like structs and fns to import into the linked result.
 * (note that local functions are not listed unless they are referenced)
 */
export function findReferences(
  srcModule: TextModule,
  registry: ParsedRegistry,
): LoadableRef[] {
  // map full export name (with generic params from import) to name for linked result
  const visited = new Map<string, string>();

  // set of linked result names (values of visited map)
  const rootNames = new Set<string>();

  // accumulates all elements to add to the linked result
  const found: LoadableRef[] = [];

  traverseRefs(srcModule, registry, refVisit);
  return found;

  /**
   * process one reference found by the reference traversal
   *
   * choose a unique name for the reference so that it can be imported into the
   */
  function refVisit(ref: FoundRef): void {
    const fullName = refFullName(ref);
    let linkName = visited.get(fullName);
    if (!linkName) {
      linkName = uniquifyName(ref.proposedName, rootNames);
      visited.set(fullName, linkName);
      rootNames.add(linkName);
      found.push(ref);
    }

    // always set the rename field to make sure we rewrite calls with module path prefixes
    ref.rename = linkName; // TODO only set if necessary
  }
}

/**
 * Calculate a unique name for a top level element like a struct or fn.
 * @param proposedName
 * @param rootNames
 * @returns the unique name (which may be the proposed name if it's so far unique)
 */
function uniquifyName(
  /** proposed name for this fn in the linked results (e.g. import as name) */
  proposedName: string,
  rootNames: Set<string>,
): string {
  let renamed = proposedName;
  let conflicts = 0;

  // create a unique name
  while (rootNames.has(renamed)) {
    renamed = proposedName + conflicts++;
  }

  return renamed;
}

/**
 * unique id for a future root level element in the form:
 *    moduleName.elemName(impParam1, impParam2, ...)
 * We'll eventually give each unique element a unique fn, struct or variable name
 * in the linked source.
 */
export function refFullName(ref: FoundRef): string {
  return ref.expMod.modulePath + "." + ref.elem.name;
}

/** construct DirectiveRefs for from globalDirective elements
 * (so that we can use the standard extract path to copy them to the linked output) */
function globalDirectiveRefs(srcModule: TextModule): DirectiveRef[] {
  const directiveRefs = srcModule.globalDirectives.map(e =>
    toDirectiveRef(e, srcModule),
  );
  return directiveRefs;
}

/** convert a global directive element into a DirectiveRef */
function toDirectiveRef(
  elem: GlobalDirectiveElem,
  expMod: TextModule,
): DirectiveRef {
  return {
    kind: "dir",
    elem,
    expMod,
  };
}

// LATER rename imported vars or aliases
function loadOtherElem(ref: TextRef | DirectiveRef): string {
  const { expMod, elem } = ref;
  const typeRefs = (elem as VarElem | AliasElem).typeRefs ?? [];
  const slicing = typeRefSlices(typeRefs);
  const srcMap = sliceReplace(expMod.src, slicing, elem.start, elem.end);
  // LATER propogate srcMap

  return srcMap.dest;
}

/** load exported text for an import */
function extractTexts(refs: LoadableRef[]): string {
  return refs
    .map(r => {
      if (r.kind === "txt") {
        const elemKind = r.elem.kind;
        if (elemKind === "fn") {
          return loadFnText(r.elem, r);
        }
        if (elemKind === "struct") {
          return loadStruct(r);
        }
        if (elemKind === "var" || elemKind === "alias") {
          return loadOtherElem(r);
        }
        console.warn("can't extract. unexpected elem kind:", elemKind, r.elem);
      }
      if (r.kind === "dir") {
        return loadOtherElem(r);
      }
    })
    .join("\n\n");
}

/** load a struct text, mixing in any elements from #extends */
function loadStruct(ref: TextRef): string {
  const structElem = ref.elem as StructElem;

  const rootMembers =
    structElem.members?.map(m => loadMemberText(m, ref)) ?? [];

  const allMembers = rootMembers.flat().map(m => "  " + m);
  const membersText = allMembers.join(",\n");
  const name = ref.rename || structElem.name;
  return `struct ${name} {\n${membersText}\n}`;
}

function loadMemberText(member: StructMemberElem, ref: TextRef): string {
  const newRef = { ...ref, elem: member };
  return loadOtherElem(newRef);
}

function loadFnText(elem: FnElem, ref: TextRef): string {
  const { rename } = ref;
  const slicing: SliceReplace[] = [];

  if (rename) {
    const { start, end } = elem.nameElem;
    slicing.push({ start, end, replacement: rename });
  }

  elem.calls.forEach(call => {
    const rename = call?.ref?.rename;
    if (rename) {
      const { start, end } = call;
      slicing.push({ start, end, replacement: rename });
    }
  });

  slicing.push(...typeRefSlices(elem.typeRefs));

  const srcMap = sliceReplace(ref.expMod.src, slicing, elem.start, elem.end);

  return srcMap.dest;
}

function typeRefSlices(typeRefs: TypeRefElem[]): SliceReplace[] {
  const slicing: SliceReplace[] = [];
  typeRefs.forEach(typeRef => {
    const rename = typeRef?.ref?.rename;
    if (rename) {
      const { start, end } = typeRef;
      slicing.push({ start, end, replacement: rename });
    }
  });
  return slicing;
}

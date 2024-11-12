import {
  AliasElem,
  FnElem,
  GlobalDirectiveElem,
  StructElem,
  StructMemberElem,
  TypeRefElem,
  VarElem,
} from "./AbstractElems.js";
import { refLog } from "./LinkerLogging.js";
import { RegistryParams } from "./ModuleRegistry.js";
import { ParsedRegistry } from "./ParsedRegistry.js";
import { TextModule } from "./ParseModule.js";
import { SliceReplace, sliceReplace } from "./Slicer.js";
import {
  FoundRef,
  GeneratorRef,
  refName,
  TextRef,
  traverseRefs,
} from "./TraverseRefs.js";
import { replaceWords } from "./Util.js";

type DirectiveRef = {
  kind: "dir";
  expMod: TextModule;
  elem: GlobalDirectiveElem;
};

type LoadableRef = TextRef | GeneratorRef | DirectiveRef;

/** TBD a simple */
export function link(args: RegistryParams) {}

/**
 * Produce a linked wgsl string with all directives processed
 * (e.g. #import'd functions from other modules are inserted into the resulting string).
 *
 * @param runtimeParams runtime parameters for #import/#export values,
 *  template values, and code generation parameters
 */
export function linkWgslModule(
  srcModule: TextModule,
  registry: ParsedRegistry,
  extParams: Record<string, any> = {},
): string {
  const refs = findReferences(srcModule, registry); // all recursively referenced structs and fns

  // mix the merge refs into the import/export refs
  const loadRefs = prepRefsMergeAndLoad(refs);

  // convert global directives into LoadableRefs
  const directiveRefs = globalDirectiveRefs(srcModule);

  // extract export texts, rewriting via rename map and exp/imp args
  const extractRefs = [...loadRefs, ...directiveRefs];
  return extractTexts(extractRefs, extParams);
}

/** Find references to elements like structs and fns to import into the linked result.
 * (note that local functions are not listed unless they are referenced)
 */
export function findReferences(
  srcModule: TextModule,
  registry: ParsedRegistry,
): FoundRef[] {
  // map full export name (with generic params from import) to name for linked result
  const visited = new Map<string, string>();

  // set of linked result names (values of visited map)
  const rootNames = new Set<string>();

  // accumulates all elements to add to the linked result
  const found: FoundRef[] = [];

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
  const expImpArgs = ref.expInfo?.expImpArgs ?? [];
  const impArgs = expImpArgs.map(([, arg]) => arg);
  const argsStr = "(" + impArgs.join(",") + ")";
  return ref.expMod.modulePath + "." + refName(ref) + argsStr;
}

/**
 * Perpare the refs found in the traverse for loading:
 * . sort through found refs
 *
 * @return the set of refs that will be loaded
 */
function prepRefsMergeAndLoad(refs: FoundRef[]): FoundRef[] {
  const textRefs = refs.filter(r => r.kind === "txt") as TextRef[];
  const generatorRefs = refs.filter(r => r.kind === "gen") as GeneratorRef[];

  return [...generatorRefs, ...textRefs];
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
function loadOtherElem(
  ref: TextRef | DirectiveRef,
  extParams: Record<string, string>,
): string {
  const { expMod, elem } = ref;
  const typeRefs = (elem as VarElem | AliasElem).typeRefs ?? [];
  const slicing = typeRefSlices(typeRefs);
  const srcMap = sliceReplace(expMod.src, slicing, elem.start, elem.end);
  // LATER propogate srcMap

  return applyExpImp(srcMap.dest, ref, extParams);
}

function loadGeneratedElem(
  ref: GeneratorRef,
  extParams: Record<string, string>,
): string {
  const genExp = ref.expMod.exports.find(e => e.name === ref.name);
  if (!genExp) {
    refLog(ref, "missing generator", ref.name);
    return "//?";
  }
  const fnName = ref.rename ?? ref.proposedName ?? ref.name;
  const params = refExpImp(ref, extParams);

  const text = genExp?.generate(fnName, params);
  return text;
}

/** load exported text for an import */
function extractTexts(
  refs: LoadableRef[],
  extParams: Record<string, string>,
): string {
  return refs
    .map(r => {
      if (r.kind === "gen") {
        return loadGeneratedElem(r, extParams);
      }
      if (r.kind === "txt") {
        const elemKind = r.elem.kind;
        if (elemKind === "fn") {
          return loadFnText(r.elem, r, extParams);
        }
        if (elemKind === "struct") {
          return loadStruct(r, extParams);
        }
        if (elemKind === "var" || elemKind === "alias") {
          return loadOtherElem(r, extParams);
        }
        console.warn("can't extract. unexpected elem kind:", elemKind, r.elem);
      }
      if (r.kind === "dir") {
        return loadOtherElem(r, extParams);
      }
    })
    .join("\n\n");
}

/** load a struct text, mixing in any elements from #extends */
function loadStruct(ref: TextRef, extParams: Record<string, string>): string {
  const structElem = ref.elem as StructElem;

  const rootMembers =
    structElem.members?.map(m => loadMemberText(m, ref, extParams)) ?? [];

  const allMembers = rootMembers.flat().map(m => "  " + m);
  const membersText = allMembers.join(",\n");
  const name = ref.rename || structElem.name;
  return `struct ${name} {\n${membersText}\n}`;
}

function loadMemberText(
  member: StructMemberElem,
  ref: TextRef,
  extParams: Record<string, string>,
): string {
  const newRef = { ...ref, elem: member };
  return loadOtherElem(newRef, extParams);
}

/** get the export/import param map if appropriate for this ref */
function refExpImp(
  ref: FoundRef,
  extParams: Record<string, string>,
): Record<string, string> {
  const expImp = ref.expInfo?.expImpArgs ?? [];
  const entries = expImp.map(([exp, imp]) => {
    if (imp.startsWith("ext.")) {
      const value = extParams[imp.slice(4)];
      if (value) return [exp, value];

      refLog(ref, "missing ext param", imp, extParams);
    }
    return [exp, imp];
  });
  return Object.fromEntries(entries);
}

function loadFnText(
  elem: FnElem,
  ref: TextRef,
  extParams: Record<string, string>,
): string {
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

  const srcMap = sliceReplace(
    ref.expMod.src,
    slicing,
    elem.start,
    elem.end,
  );

  return applyExpImp(srcMap.dest, ref, extParams);
}

/** rewrite the src text according to module templating and exp/imp params */
function applyExpImp(
  src: string,
  ref: TextRef | DirectiveRef,
  extParams: Record<string, string>,
): string {
  const params = ref.kind === "txt" ? refExpImp(ref, extParams) : {};
  return replaceWords(src, params);
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

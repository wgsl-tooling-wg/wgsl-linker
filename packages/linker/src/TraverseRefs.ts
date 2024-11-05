import {
  AliasElem,
  CallElem,
  ExtendsElem,
  FnElem,
  StructElem,
  StructMemberElem,
  TreeImportElem,
  TypeRefElem,
  VarElem,
} from "./AbstractElems.js";
import { refFullName } from "./Linker.js";
import { moduleLog } from "./LinkerLogging.js";
import { GeneratorExport, GeneratorModule } from "./ModuleRegistry.js";
import { ParsedRegistry } from "./ParsedRegistry.js";
import { TextExport, TextModule } from "./ParseModule.js";
import { resolveImport } from "./ResolveImport.js";
import { groupBy, last } from "./Util.js";

/**
 * A wrapper around a wgsl element targeted for inclusion in the link
 * There is one FoundRef per unique target element.
 * . Multiple references to a single target element share the same FoundRef.
 * . But multiple versions of a target element from generic expansion
 *   result in multiple FoundRefs.
 */
export type FoundRef = TextRef | GeneratorRef;

export type StringPairs = [string, string][];

interface FoundRefBase {
  /** proposed name to use for this referent, either fn/struct name or 'as' name from the import.
   * name might still be rewritten by global uniqueness remapping */
  proposedName: string;

  /** rename needed for the referent element due to the global uniqueness mapping */
  rename?: string;
}

export interface ExportInfo {
  /** reference that led us to find this ref */
  fromRef: FoundRef;

  /** import or extends elem that resolved to this export (so we can later separate out extends) */
  fromImport: ExtendsElem | TreeImportElem;

  /** mapping from export arguments to import arguments
   * (could be mapping to import args prior to this import, via chain of importing) */
  expImpArgs: [string, string][];
}

export interface GeneratorRef extends FoundRefBase {
  kind: "gen";

  expInfo: ExportInfo;

  /** module containing the exported function */
  expMod: GeneratorModule;

  /** name of the generated function (may be renamed by import as) */
  name: string;

  mergeRefs?: undefined;
}

/** A reference to a target wgsl element (e.g. a function). */
export interface TextRef extends FoundRefBase {
  kind: "txt";

  /** module containing the referenced element */
  expMod: TextModule;

  /** referenced element */
  elem: FnElem | StructElem | VarElem | AliasElem | StructMemberElem;

  /** extra data if the referenced element is from another module */
  expInfo?: ExportInfo;

  /** refs to extends elements on this struct element
   * (added in a post processing step after traverse) */
  mergeRefs?: TextRef[];
}

/**
 * Recursively walk through all imported references starting from a src module, calling
 * a function for each reference to an addressable wgsl element (fn, struct, etc.).
 *
 * Note that the reference graph may have multiple references to the same src element.
 * (Currently the linker will recurse through the the same node multiple times
 * to handle varied import parameters.)
 */
export function traverseRefs(
  srcModule: TextModule,
  registry: ParsedRegistry,
  fn: (ref: FoundRef) => void,
): void {
  const { aliases, fns, structs, vars } = srcModule;
  const expMod = srcModule;
  const srcRefs: TextRef[] = [...structs, ...vars, ...fns, ...aliases].map(
    elem => ({
      kind: "txt",
      proposedName: elem.name,
      expMod,
      elem,
    }),
  );
  srcRefs.forEach(ref => fn(ref));
  if (!srcRefs.length) return;

  // recurse on the external refs from the src root elements
  const nonGenRefs = textRefs(srcRefs);
  const childRefs = nonGenRefs.flatMap(srcRef =>
    elemRefs(srcRef, srcModule, registry),
  );
  const seen = new Set<string>();
  recursiveRefs(childRefs, registry, eachRef);

  function eachRef(ref: FoundRef): true | undefined {
    // printRef(ref);
    fn(ref);
    if (unseen(ref)) {
      return true;
    }
  }

  function unseen(ref: FoundRef): true | undefined {
    const fullName = refFullName(ref);
    if (!seen.has(fullName)) {
      seen.add(fullName);
      return true;
    }
  }
}

/*
 * traversal of the wgsl src reference graph as follows:
 *  fn -> calls -> (local fn or import+export+fn)
 *  fn -> typeRefs -> (local struct or import+export+struct)
 *  struct -> typeRefs -> (local struct or import+export+struct)
 *  struct -> extends -> (local struct or import+export+struct)
 *  var -> typeRefs -> (local struct or import+export+struct)
 */
function recursiveRefs(
  refs: FoundRef[],
  registry: ParsedRegistry,
  fn: (ref: FoundRef) => boolean | undefined,
): void {
  // run the fn on each ref, and prep to recurse on each ref for which the fn returns true
  const filtered = refs.filter(r => fn(r));

  const nonGenRefs = textRefs(filtered); // we don't need to trace generated text (and thus we don't parse it anyway)

  const modGroups = groupBy(nonGenRefs, r => r.expMod);
  [...modGroups.entries()].forEach(([mod, refs]) => {
    if (refs.length) {
      const childRefs = refs.flatMap(r => elemRefs(r, mod, registry));
      recursiveRefs(childRefs, registry, fn);
    }
  });
}

export function textRefs(refs: FoundRef[]): TextRef[] {
  return refs.filter(textRef);
}

function textRef(ref: FoundRef): ref is TextRef {
  return ref.kind !== "gen";
}

/** return all struct/fn refs from a src element */
function elemRefs(
  srcRef: TextRef,
  mod: TextModule,
  registry: ParsedRegistry,
): FoundRef[] {
  const { elem } = srcRef;
  let fnRefs: FoundRef[] = [];
  let mergeRefs: FoundRef[] = [];
  if (elem.kind === "fn") {
    const userCalls = elem.calls.filter(
      call => !stdFn(call.name) && call.name !== elem.name,
    );
    fnRefs = elemChildrenRefs(srcRef, userCalls, mod, registry);
  } else if (elem.kind === "struct") {
    mergeRefs = extendsRefs(srcRef, elem, mod, registry);
  }
  const userTypeRefs = elemTypeRefs(elem);
  const tRefs = elemChildrenRefs(srcRef, userTypeRefs, mod, registry);
  return [...fnRefs, ...tRefs, ...mergeRefs];
}

/** return type references from an element */
function elemTypeRefs(
  elem: FnElem | StructElem | VarElem | AliasElem | StructMemberElem,
): TypeRefElem[] {
  let typeRefs: TypeRefElem[];
  const { kind } = elem;
  if (
    kind === "fn" ||
    kind === "var" ||
    kind === "alias" ||
    kind === "member"
  ) {
    typeRefs = elem.typeRefs;
  } else if (kind === "struct") {
    typeRefs = elem.members?.flatMap(m => m.typeRefs) || [];
  } else {
    console.error("unexpected kind", elem);
    typeRefs = [];
  }
  const userTypeRefs = typeRefs.filter(ref => !stdType(ref.name));
  return userTypeRefs;
}

/** find fn/struct references from children of a fn or struct elem
 * (children being call references and type references from the fn or struct) */
function elemChildrenRefs(
  srcRef: TextRef,
  children: (CallElem | TypeRefElem)[],
  mod: TextModule,
  registry: ParsedRegistry,
): FoundRef[] {
  return children.flatMap(elem => linkedRef(elem, srcRef, mod, registry));
}

/** given a source elem that refers to another element (like a fn call or type reference),
 * return a TextRef linking the src elem to its referent, possibly through an import/export */
function linkedRef(
  elem: CallElem | TypeRefElem,
  srcRef: TextRef,
  mod: TextModule,
  registry: ParsedRegistry,
): FoundRef[] {
  const { name } = elem;
  if (importArgRef(srcRef, name)) return [];

  const foundRef =
    importRef(srcRef, name, mod, mod.imports, registry) ??
    // importingRef(srcRef, name, mod, registry) ??
    localRef(name, mod);

  if (foundRef) {
    if (["typeRef", "call"].includes(elem.kind)) {
      // bind src elem to referent elem (resolve reference)
      elem.ref = foundRef;
    } else {
      console.error("unexpected kind", elem);
    }
  }

  if (foundRef) return [foundRef];

  moduleLog(srcRef.expMod, elem.start, `reference not found: ${name}`);
  return [];
}

/** create references to any extends elements attached to this struct */
function extendsRefs(
  srcRef: TextRef,
  elem: StructElem,
  mod: TextModule,
  registry: ParsedRegistry,
): FoundRef[] {
  const merges = elem.extendsElems;
  if (!merges) return [];
  return merges.flatMap(merge => {
    const foundRef = importRef(srcRef, merge.name, mod, mod.imports, registry);
    if (foundRef) return [foundRef];

    moduleLog(srcRef.expMod, merge.start, `import merge reference not found`);
    return [];
  });
}

/** @return true if the ref is to an import parameter */
function importArgRef(srcRef: FoundRef, name: string): boolean | undefined {
  if (srcRef.expInfo) {
    return !!srcRef.expInfo.expImpArgs.find(([expArg]) => expArg === name);
  }
}

/** If this src element references an #import function
 * @return an TextRef describing the export to link */
function importRef(
  fromRef: TextRef,
  name: string,
  impMod: TextModule,
  imports: (TreeImportElem | ExtendsElem)[],
  registry: ParsedRegistry,
): TextRef | GeneratorRef | undefined {
  const resolveMap = registry.importResolveMap(impMod);
  const resolved = resolveImport(name, resolveMap);
  const fromImport = imports[0]; // TODO implement
  if (resolved) {
    const { modExp, callSegments, expImpArgs } = resolved;
    const proposedName = last(callSegments)!;
    const expMod = modExp.module;
    const expInfo: ExportInfo = {
      fromImport,
      fromRef,
      expImpArgs,
    };
    if (expMod.kind === "text") {
      const exp = modExp.exp as TextExport;
      return {
        kind: "txt",
        expInfo,
        expMod,
        elem: exp.ref,
        proposedName,
      };
    } else if (expMod.kind === "generator") {
      const exp = modExp.exp as GeneratorExport;
      return {
        kind: "gen",
        expInfo,
        expMod,
        proposedName,
        name: exp.name,
      };
    }
  }
}

// function matchImportExportArgs(
//   impMod: TextModule | GeneratorModule,
//   imp: ExtendsElem,
//   expMod: TextModule | GeneratorModule,
//   exp: ExportElem | GeneratorExport
// ): StringPairs {
//   const impArgs = imp.args ?? [];
//   const expArgs = exp.args ?? [];
//   if (expArgs.length !== impArgs.length) {
//     impMod.kind === "text" &&
//       moduleLog(impMod, imp.start, "mismatched import and export params");
//     expMod.kind === "text" && moduleLog(expMod, (exp as ExportElem).start);
//   }
//   return expArgs.map((p, i) => [p, impArgs[i]]);
// }

/** If this element references an #export.. importing function
 * @return a ref describing the export to link */
// function importingRef(
//   srcRef: FoundRef,
//   name: string,
//   impMod: TextModule,
//   registry: ParsedRegistry
// ): TextRef | GeneratorRef | undefined {
// let fromImport: TreeImportElem | undefined;

// // find a matching 'importing' phrase in an #export
// const textExport = impMod.exports.find((exp) => {
//   fromImport = exp.importing?.find((i) => i.name === name);
//   return !!fromImport;
// });

// // find the export for the importing
// const modExp = matchingExport(fromImport, impMod, registry);
// if (!modExp) return;
// isDefined(fromImport);
// isDefined(textExport);

// if (srcRef.kind !== "txt") {
//   refLog(srcRef, "unexpected srcRef", srcRef.kind);
//   return;
// }

// const expImpArgs = importingArgs(fromImport, modExp.exp, srcRef);
// const expInfo: ExportInfo = {
//   fromRef: srcRef,
//   fromImport,
//   expImpArgs,
// };
// if (modExp.kind === "text") {
//   const exp = modExp.exp;

//   return {
//     kind: "txt",
//     expInfo,
//     expMod: modExp.module as TextModule,
//     elem: exp.ref,
//     proposedName: fromImport.as ?? exp.ref.name,
//   };
// } else if (modExp.kind === "function") {
//   const exp = modExp.exp;
//   return {
//     kind: "gen",
//     expInfo,
//     expMod: modExp.module,
//     proposedName: fromImport.as ?? exp.name,
//     name: exp.name,
//   };
// }

//   return undefined;
// }

/**
 * @return the arguments for an importing reference, mapping through the
 * export and the original import directives.
 *
 * e.g. we're tracking a fn call that references through an 'importing':
 *   import1 -> export2 -> importing3 -> export4
 * and we want to find the mapping from export4 args to import1 args
 *
 * for example:
 *   #import foo(A, B)
 *   #export foo(C, D) importing bar(D)
 *   #export bar(X)
 * we want to return mapping of X -> B for the importing clasue
 *
 * @param imp - the importing clause
 * @param exp - export matching the importing clause
 * @param srcRef - reference that led us to this import
 */
// function importingArgs(
//   imp: TreeImportElem,
//   exp: ExportElem | GeneratorExport,
//   srcRef: TextRef,
// ): StringPairs {
//   return [];
// if (srcRef.expInfo === undefined) return [];
// const expImp = matchImportExportArgs(
//   srcRef.expInfo.fromRef.expMod,
//   imp,
//   srcRef.expMod,
//   exp
// ); // X -> D
// const srcExpImp = srcRef.expInfo.expImpArgs;
// return expImp.flatMap(([iExp, iImp]) => {
//   const pair = srcExpImp.find(([srcExpArg]) => srcExpArg === iImp); // D -> B
//   if (!pair) {
//     moduleLog(srcRef.expMod, imp.start, "importing arg doesn't match export");
//     return [];
//   }
//   const [, impArg] = pair;
//   return [[iExp, impArg]] as [string, string][]; // X -> B
// });
// }

// function isDefined<T>(a: T | undefined): asserts a is T {
//   /* */
// }

// function matchingExport(
//   imp: TreeImportElem | ExtendsElem | undefined,
//   mod: TextModule,
//   registry: ParsedRegistry,
// ): ModuleExport | undefined {
//   if (!imp) return;

//   dlog("NYI");
//   // TODO

//   // const modExp = registry.getModuleExportOld(mod, imp.name, imp.from);
//   // if (!modExp) {
//   //   moduleLog(mod, imp.start, "export not found for import");
//   // }
//   // return modExp;
// }

function localRef(name: string, mod: TextModule): TextRef | undefined {
  const elem =
    mod.fns.find(fn => fn.name === name) ??
    mod.structs.find(s => s.name === name);
  if (elem) {
    return {
      kind: "txt",
      expMod: mod,
      elem: elem,
      proposedName: elem.name,
      expInfo: undefined,
    };
  }
}

// interface AsNamed {
//   as?: string;
//   name: string;
// }

// function importName(asNamed: AsNamed): string {
//   return asNamed.as || asNamed.name;
// }

const stdFns = `bitcast all any select arrayLength 
  abs acos acosh asin asinh atan atanh atan2 ceil clamp cos cosh 
  countLeadingZeros countOneBits countTrailingZeros cross 
  degrees determinant distance dot dot4UI8Packed dot4I8Packed 
  exp exp2 extractBits faceForward firstLeadingBit firstTrailingBit 
  floor fma fract frexp inserBits inverseSqrt ldexp length log log2
  max min mix modf normalize pow quantizeToF16 radians reflect refract
  reverseBits round saturate sin sinh smoothstep sqrt step tan tanh
  transpose trunc
  dpdx dpdxCoarse dpdxFine dpdy dpdyCoarse dpdyFine fwidth 
  fwdithCoarse fwidthFine
  textureDimensions textureGather textureGatherCompare textureLoad
  textureNumLayers textureNumLevels textureNumSamples
  textureSample textureSampleBias textureSampleCompare textureSampleCompareLevel
  textureSampleGrad textureSampleLevel textureSampleBaseClampToEdge
  textureStore
  atomicLoad atomicStore atomicAdd atomicSub atomicMax atomicMin
  atomicOr atomicXor atomicExchange atomicCompareExchangeWeak
  pack4x8snorm pack4x8unorm pack4xI8 pack4xU8 pack4xI8Clamp pack4xU8Clamp
  pack2x16snorm pack2x16unorm pack2x16float
  unpack4x8snorm unpack4x8unorm unpack4xI8 unpack4xU8 
  unpack2x16snorm unpack2x16unorm unpack2x16float
  storageBarrier textureBarrier workgroupBarrier workgroupUniformLoad
  `.split(/\s+/);

const stdTypes = `array atomic bool f16 f32 i32 
  mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4
  mat2x2f mat2x3f mat2x4f mat3x2f mat3x3f mat3x4f
  mat4x2f mat4x3f mat4x4f
  mat2x2h mat2x3h mat2x4h mat3x2h mat3x3h mat3x4h
  mat4x2h mat4x3h mat4x4h
  u32 vec2 vec3 vec4 ptr
  vec2i vec3i vec4i vec2u vec3u vec4u
  vec2f vec3f vec4f vec2h vec3h vec4h
  texture_1d texture_2d texture_2d_array texture_3d 
  texture_cube texture_cube_array
  texture_multisampled texture_depth_multisampled_2d
  texture_external
  texture_storage_1d texture_storage_2d texture_storage_2d_array
  texture_storage_3d
  texture_depth_2d texture_depth_2d_array texture_depth_cube
  texture_depth_cube_array
  sampler sampler_comparison
  rgba8unorm rgba8snorm rgba8uint rgba8sint
  rgba16uint rgba16sint rgba16float 
  r32uint r32sint r32float rg32uint rg32sint rg32float
  rgba32uint rgba32sint rgba32float
  bgra8unorm 
  `.split(/\s+/);

/* Note the texel formats like rgba8unorm are here because they appear in type position
 in <templates> for texture_storage_* types. 
 (We could parse texture_storage types specially, but user code is unlikely to alias 
  the texture format names with e.g. a 'struct rbga8unorm .)
*/

/** return true if the name is for a built in type (not a user struct) */
function stdType(name: string): boolean {
  return stdTypes.includes(name);
}

export function refName(ref: FoundRef): string {
  return ref.kind === "gen" ? ref.name : ref.elem.name;
}

/** return true if the name is for a built in fn (not a user function) */
function stdFn(name: string): boolean {
  return stdFns.includes(name) || stdType(name);
}

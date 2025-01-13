import { tracing } from "mini-parse";
import {
  AbstractElem,
  AttributeElem,
  DeclarationElem,
  ModuleElem,
  SimpleMemberRef,
  StructElem,
  SyntheticElem,
} from "./AbstractElems.ts";
import { findDecl } from "./LowerAndEmit.ts";
import { WeslAST } from "./ParseWESL.ts";
import {
  attributeToString,
  typeListToString,
  typeParamToString,
} from "./RawEmit.ts";
import { RefIdent } from "./Scope.ts";
import { elemLog, visitAst } from "./LinkerUtil.ts";
import { filterMap } from "./Util.ts";

/**
 * Transform binding structures into binding variables by mutating the AST.
 *
 * First we find all the binding structs:
 *   . find all the structs in the module by filtering the moduleElem.contents
 *     . for each struct:
 *       . mark any structs with that contain @group or @binding annotations as 'binding structs' and save them in a list
 *       . (later) create reverse links from structs to struct members
 *       . (later) visit all the binding structs and traverse to referencing structs, marking the referencing structs as binding structs too
 * Generate synethic AST nodes for binding variables
 *
 * Find all references to binding struct members
 *   . find the componound idents by traversing moduleElem.contents
 *   . filter to find the compound idents that refer to 'binding structs'
 *     . go from each ident to its declaration,
 *     . declaration to typeRef reference
 *     . typeRef to type declaration
 *     . check type declaration to see if it's a binding struct
 *     . record the intermediate declaration (e.g. a fn param b:Bindings from 'fn(b:Bindings)' )
 * rewrite references to binding struct members as synthetic elements
 *
 * Remove the binding structs from the AST
 * Remove the intermediate fn param declarations from the AST
 * Add the new binding variables to the AST
 */
export function lowerBindingStructs(ast: WeslAST): ModuleElem {
  const { moduleElem } = ast;
  const bindingStructs = markBindingStructs(moduleElem); // CONSIDER should we only mark bining structs referenced from the entry point?
  const newVars = bindingStructs.flatMap(transformBindingStruct);
  const bindingRefs = findRefsToBindingStructs(moduleElem);

  // convert references 'b.particles' to references to the synthetic var 'particles'
  bindingRefs.forEach(({ memberRef, struct }) =>
    transformBindingReference(memberRef, struct),
  );
  // remove intermediate fn param declaration b:Bindings from 'fn(b:Bindings)'
  bindingRefs.forEach(({ intermediates }) =>
    intermediates.forEach(e => (e.contents = [])),
  );
  const contents = removeBindingStructs(moduleElem);
  moduleElem.contents = [...newVars, ...contents];
  return moduleElem;
}

function removeBindingStructs(moduleElem: ModuleElem): AbstractElem[] {
  return moduleElem.contents.filter(
    elem => elem.kind !== "struct" || !elem.bindingStruct,
  );
}

/** mutate the AST, marking StructElems as bindingStructs
 *  (if they contain ptrs with @group @binding annotations)
 * @return the binding structs
 */
export function markBindingStructs(moduleElem: ModuleElem): StructElem[] {
  const structs = moduleElem.contents.filter(elem => elem.kind === "struct");
  const bindingStructs = structs.filter(containsBindingPtr);
  bindingStructs.forEach(struct => (struct.bindingStruct = true));
  // LATER also mark structs that reference a binding struct..
  return bindingStructs;
}

/** @return true if this struct contains a member with a ptr marked with @binding or @group */
function containsBindingPtr(struct: StructElem): boolean {
  return struct.members.some(member => {
    const { typeRef, attributes } = member;
    if (typeRef.name === "ptr" && bindingAttribute(attributes)) {
      return true;
    }
  });
}

function bindingAttribute(attributes?: AttributeElem[]): boolean {
  if (!attributes) return false;
  return attributes.some(({ name }) => name === "binding" || name === "group");
}

/** convert each member of the binding struct into a synthetic global variable */
export function transformBindingStruct(s: StructElem): SyntheticElem[] {
  return s.members.map(m => {
    const attributes = m.attributes?.map(attributeToString).join(" ");
    const varName = m.name.name; // TODO uniquify
    m.mangledVarName = varName;

    const origParams = m.typeRef?.templateParams || [];
    const newParams = [origParams[0]];
    if (origParams[2]) newParams.push(origParams[2]);
    const storageType = typeListToString(newParams);

    const varType = typeParamToString(origParams?.[1]);

    const varText = `var ${attributes} ${varName}${storageType} : ${varType};`;

    const elem: SyntheticElem = {
      kind: "synthetic",
      text: varText,
    };
    return elem;
  });
}

interface MemberRefToStruct extends StructTrace {
  memberRef: SimpleMemberRef; // e.g. the memberRef 'b.particles'
}

interface StructTrace {
  struct: StructElem; // e.g. the struct Bindings
  intermediates: DeclarationElem[]; // e.g. the fn param b:Bindings from 'fn(b:Bindings)'
}

/** find all simple member references in the module that refer to binding structs */
export function findRefsToBindingStructs(
  moduleElem: ModuleElem,
): MemberRefToStruct[] {
  const members: SimpleMemberRef[] = [];
  visitAst(moduleElem, elem => {
    if (elem.kind === "memberRef") members.push(elem);
  });
  return filterMap(members, refersToBindingStruct);
}

/** @return true if this memberRef refers to a binding struct */
function refersToBindingStruct(
  memberRef: SimpleMemberRef,
): MemberRefToStruct | undefined {
  const found = traceToStruct(memberRef.name.ident);

  if (found && found.struct.bindingStruct) {
    return { memberRef, ...found };
  }
}

/** If this identifier ultimately refers to a struct type, return the struct declaration */
function traceToStruct(ident: RefIdent): StructTrace | undefined {
  const decl = findDecl(ident);
  const declElem = decl.declElem;
  // for now only handle the case where the reference points at a fn parameter
  if (declElem.kind === "param") {
    const name = declElem.typeRef.name;
    if (typeof name !== "string") {
      const paramDecl = findDecl(name);
      const structElem = paramDecl.declElem;
      if (structElem.kind === "struct") {
        return { struct: structElem, intermediates: [declElem] };
      }
      return undefined;
    }
  } else {
    // LATER presumably handle other cases? Should this be more general, e.g. traceToType()?
    // elemLog(
    //   ident.refIdentElem!,
    //   `unhandled case in traceToStruct: decl ${declElem.kind} not yet implemented`,
    // );
  }
}

/** Mutate the member reference elem to instead contain synthetic elem text.
 * The new text is the mangled var name of the struct member that the memberRef refers to. */
export function transformBindingReference(
  memberRef: SimpleMemberRef,
  struct: StructElem,
): SyntheticElem {
  const refName = memberRef.member.name;
  const structMember = struct.members.find(m => m.name.name === refName)!;
  if (!structMember || !structMember.mangledVarName) {
    if (tracing) console.log(`missing mangledVarName for ${refName}`);
    return { kind: "synthetic", text: refName };
  }

  const text = `${structMember.mangledVarName}`;
  const synthElem: SyntheticElem = { kind: "synthetic", text };
  memberRef.contents = [synthElem];
  return synthElem;
}

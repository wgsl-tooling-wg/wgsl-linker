import {
  AttributeElem,
  ModuleElem,
  StructElem,
  SyntheticElem
} from "./AbstractElems.ts";
import {
  attributeToString,
  typeListToString,
  typeParamToString,
} from "./RawEmit.ts";

/* Our goal is to transform binding structures into binding variables
 *
 * First we find all the binding structs:
 *   . find all the structs in the module by filtering the moduleElem.contents
 *     . for each struct:
 *       . mark any structs with that contain @group or @binding annotations as 'binding structs' and save them in a list
 *       . (later) create reverse links from structs to struct members
 *       . (later) visit all the binding structs and traverse to referencing structs, marking the referencing structs as binding structs too
 * Generate AST nodes for binding variables
 * Remove the binding structs from the AST, add new the binding variables AST
 *
 * Find all references to binding struct members
 *   . find the componound idents by traversing moduleElem.contents
 *   . filter to find the compound idents that refer to 'binding structs'
 *     . go from each ident to its declaration,
 *     . declaration to typeRef reference
 *     . typeRef to type declaration
 *     . check type declaration to see if it's a binding struct
 *   . rewrite compound ident refs to binding struct members as references to binding variables
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

/** convert each member of the binding struct into a synethic global variable */
export function transformBindingStruct(s: StructElem): SyntheticElem[] {
  return s.members.map(m => {
    const attributes = m.attributes?.map(attributeToString).join(" ");
    const varName = m.name.name; // TODO uniquify

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

import { ResolveMap } from "./ImportResolutionMap.js";

export function logResolveMap(resolveMap: ResolveMap): void {
  const pathEntries = pathsToStrings(resolveMap);
  const exportEntries = exportsToStrings(resolveMap);
  console.log("\tpathsMap:\n\t\t" + pathEntries.join("\n\t\t"));
  console.log("\texportMap:\n\t\t" + exportEntries.join("\n\t\t"));
}

export function pathsToStrings(resolveMap: ResolveMap): string[] {
  return [...resolveMap.pathsMap].map(([imp, exp]) => {
    return `${imp.join("/")} -> ${exp}`;
  });
}

export function exportsToStrings(resolveMap: ResolveMap): string[] {
  return [...resolveMap.exportMap].map(([imp, exp]) => {
    const modulePath = exp.modExp.module.modulePath;
    const expPath = `${modulePath}/${exp.modExp.exp.ref.name}`;
    return `${imp} -> ${expPath}`;
  });
}
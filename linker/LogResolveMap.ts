import { ResolveMap } from "./ImportResolutionMap.ts";
import { ModuleExport } from "./ModuleRegistry.ts";

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
    const expPath = `${modulePath}/${exportName(exp.modExp)}`;
    const expImpArgs =
      exp.expImpArgs.length ? ` (${exp.expImpArgs.join(", ")})` : "";
    return `${imp} -> ${expPath}${expImpArgs}`;
  });
}

function exportName(mod: ModuleExport): string {
  if (mod.kind === "text") {
    return mod.exp.ref.name;
  } else {
    return mod.exp.name;
  }
}

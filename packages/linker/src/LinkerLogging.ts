import { logger, srcLog } from "mini-parse";
import { AbstractElem } from "./AbstractElems.js";
import { TextModule } from "./ParseModule.js";
import { FoundRef } from "./TraverseRefs.js";

export function refLog(ref: FoundRef, ...msgs: any[]): void {
  if (ref.kind !== "gen") {
    moduleLog(ref.expMod, [ref.elem.start, ref.elem.end], ...msgs);
  } else {
    logger(ref.name, ...msgs);
  }
}

export function moduleLog(
  mod: TextModule,
  pos: number | [number, number],
  ...msgs: any[]
): void {
  const { src, srcMap } = mod;
  srcLog(srcMap ?? src, pos, ...msgs, ` module: ${mod.modulePath}`);
}

export function elemLog(
  mod: TextModule,
  elem: AbstractElem,
  ...msgs: any[]
): void {
  const { src, srcMap } = mod;
  const { start, end } = elem;
  srcLog(srcMap ?? src, [start, end], ...msgs);
}

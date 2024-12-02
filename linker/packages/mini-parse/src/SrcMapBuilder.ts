import { SrcMap, SrcMapEntry } from "./SrcMap.js";

// TODO untested

/**
 * Incrementally append to a string, tracking source references
 */
export class SrcMapBuilder {
  #fragments: string[] = [];
  #destLength = 0;
  #entries: SrcMapEntry[] = [];

  /** append a string fragment to the destination string */
  // TODO allow for src file name not just string (e.g. SrcModule)
  add(src: string, srcStart: number, srcEnd: number): void {
    const destStart = this.#destLength;
    this.#destLength += srcEnd - srcStart;
    const destEnd = this.#destLength;

    this.#fragments.push(src.slice(srcStart, srcEnd));
    this.#entries.push({ src, srcStart, srcEnd, destStart, destEnd });
  }

  /** return a SrcMap */
  build(): SrcMap {
    const map = new SrcMap(this.#fragments.join(""), this.#entries);
    map.compact();
    return map;
  }
}

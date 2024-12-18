import { SrcMap, SrcMapEntry } from "./SrcMap.js";
import { dlog } from "berry-pretty";

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
  add(fragment: string, src: string, srcStart: number, srcEnd: number): void {
    // dlog({fragment})
    const destStart = this.#destLength;
    this.#destLength += fragment.length;
    const destEnd = this.#destLength;

    this.#fragments.push(fragment);
    this.#entries.push({ src, srcStart, srcEnd, destStart, destEnd });
  }

  /** copy a string fragment from the src to the destination string */
  addCopy(src: string, srcStart: number, srcEnd: number): void {
    const fragment = src.slice(srcStart, srcEnd);
    this.add(fragment, src, srcStart, srcEnd);
  }

  /** return a SrcMap */
  build(): SrcMap {
    // dlog({ fragments: this.#fragments });
    const map = new SrcMap(this.#fragments.join(""), this.#entries);
    map.compact();
    return map;
  }
}

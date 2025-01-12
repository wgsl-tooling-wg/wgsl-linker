
/** debug utility for constructing strings that wrap at a fixed column width
 * text beyond the column width is wrapped to start on the next line
 */
export class LineWrapper {
  #fragments: string[] = [];
  #column = 0;
  #spc: string;
  #oneLine = true;
  #isHanging = false;
  #hangingSpc: string;

  constructor(
    readonly indent = 0,
    readonly maxWidth = 60,
    readonly hangingIndent = 2,
  ) {
    this.#spc = " ".repeat(indent);
    this.#hangingSpc = " ".repeat(hangingIndent);
  }

  /** add a new line to the constructed string */
  nl() {
    this.#fragments.push("\n");
    this.#column = 0;
    this.#oneLine = false;
    this.#isHanging = false;
  }

  /** add a string, wrapping to the next line if necessary */
  add(s: string) {
    if (this.#column + firstLineLength(s) > this.maxWidth) {
      this.hangingNl();
    }
    if (this.#column === 0) {
      this.#fragments.push(this.#spc);
      if (this.#isHanging) {
        this.#fragments.push(this.#hangingSpc);
      }
      this.#column = this.indent;
    }
    this.#fragments.push(s);
    this.#column += s.length;
  }

  /** add a raw block of text with no wrapping */
  addBlock(s: string, andNewLine = true) {
    this.#fragments.push(s);
    if (andNewLine) this.nl();
  }

  /** @return the constructed string */
  get result(): string {
    return this.#fragments.join("");
  }

  /** true if the result contains no newlines */
  get oneLine(): boolean {
    return this.#oneLine;
  }

  private hangingNl() {
    this.nl();
    this.#isHanging = true;
  }
}

function firstLineLength(s: string): number {
  const i = s.indexOf("\n");
  return i === -1 ? s.length : i;
}
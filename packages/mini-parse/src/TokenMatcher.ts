import { srcLog } from "./ParserLogging.js";

export interface Token {
  kind: string;
  text: string;
}

type FullTokenMatcher<T> = TokenMatcher & {
  [Property in keyof T]: string;
};

export interface TokenMatcher {
  start(src: string, position?: number): void;
  next(): Token | undefined;
  position(position?: number): number;
  _traceName?: string;
}

/** size limited key value cache */
class Cache<K, V> extends Map<K, V> {
  constructor(private readonly max: number) {
    super();
  }

  set(k: K, v: V): this {
    if (this.size > this.max) {
      this.delete(this.keys().next().value);
    }
    return super.set(k, v);
  }
}

export function tokenMatcher<T extends Record<string, string | RegExp>>(
  matchers: T,
  traceName = "matcher",
): FullTokenMatcher<T> {
  const groups: string[] = Object.keys(matchers);
  let src: string;
  // cache of tokens by position, so we don't have to reparse after backtracking
  const cache = new Cache<number, Token>(5);
  const expParts = Object.entries(matchers).map(toRegexSource).join("|");
  const exp = new RegExp(expParts, "midg");

  function start(text: string, position = 0): void {
    if (src !== text) {
      cache.clear();
    }
    src = text;
    exp.lastIndex = position;
  }

  function next(): Token | undefined {
    if (src === undefined) {
      throw new Error("start() first");
    }
    const startPos = exp.lastIndex;
    const found = cache.get(startPos);
    if (found) {
      exp.lastIndex += found.text.length;
      return found;
    }

    const matches = exp.exec(src);
    const matchedIndex = findGroupDex(matches?.indices);
    if (matchedIndex) {
      const { startEnd, groupDex } = matchedIndex;
      const kind = groups[groupDex];
      const text = src.slice(startEnd[0], startEnd[1]);
      const token = { kind, text };
      if (startPos != startEnd[0]) {
        // grammar didn't recognize something, and regex skipped ahead to match
        srcLog(
          src,
          startPos,
          `skipped: '${src.slice(startPos, startEnd[0])}' to get to: '${text}'`,
        );
      }
      cache.set(startPos, token);
      return token;
    }
  }

  function position(pos?: number): number {
    if (pos !== undefined) {
      exp.lastIndex = pos;
    }
    return exp.lastIndex;
  }

  const keyEntries = groups.map(k => [k, k]);
  const keys = Object.fromEntries(keyEntries);
  return {
    ...keys,
    start,
    next,
    position,
    _traceName: traceName,
  } as FullTokenMatcher<T>;
}

interface MatchedIndex {
  startEnd: [number, number];
  groupDex: number;
}

function findGroupDex(
  indices: RegExpIndicesArray | undefined,
): MatchedIndex | undefined {
  if (indices) {
    for (let i = 1; i < indices.length; i++) {
      const startEnd = indices[i];
      if (startEnd) {
        return { startEnd, groupDex: i - 1 };
      }
    }
  }
}

function toRegexSource(nameExp: [string, RegExp | string]): string {
  const [name, e] = nameExp;
  if (typeof e === "string") {
    const expSrc = `(${escapeRegex(e)})`;
    verifyNonCapturing(name, new RegExp(expSrc));
    return expSrc;
  } else {
    verifyNonCapturing(name, e);
    return `(${e.source})`;
  }
}

function verifyNonCapturing(name: string, exp: RegExp): void {
  const willMatch = new RegExp("|" + exp.source);
  const result = willMatch.exec("")!;
  if (result.length > 1) {
    throw new Error(
      `match expression groups must be non-capturing: ${name}: /${exp.source}/. Use (?:...) instead.`,
    );
  }
}

const regexSpecials = /[$+*.?|(){}[\]\\/^]/g;

export function escapeRegex(s: string): string {
  return s.replace(regexSpecials, "\\$&");
}

/** @return a regexp to match any of the space separated tokens in the provided string.
 *
 * regex special characters are escaped in strings are escaped, and the matchers
 * are sorted by length so that longer matches are preferred.
 */
export function matchOneOf(syms: string): RegExp {
  const symbolList = syms.split(" ").sort((a, b) => b.length - a.length);
  const escaped = symbolList.filter(s => s).map(escapeRegex);
  return new RegExp(escaped.join("|"));
}

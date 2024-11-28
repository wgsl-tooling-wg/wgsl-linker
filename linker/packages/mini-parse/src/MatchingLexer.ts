import { srcTrace } from "./ParserLogging.js";
import { tracing } from "./ParserTracing.js";
import { SrcMap } from "./SrcMap.js";
import { Token, TokenMatcher } from "./TokenMatcher.js";

export interface Lexer {
  /** return the next token, advancing the the current position */
  next(): Token | undefined;

  /** run a function with a substitute tokenMatcher */
  withMatcher<T>(newMatcher: TokenMatcher, fn: () => T): T;

  /** run a function with a substitute set of token kinds to ignore */
  withIgnore<T>(newIgnore: Set<string>, fn: () => T): T;

  /** get or set the current position in the src */
  position(pos?: number): number;

  /** true if the parser is at the end of the src string */
  eof(): boolean;

  /** skip past any ignored tokens and return the current position in the src */
  skipIgnored(): number;

  /** src text */
  src: string;
}

interface MatcherStackElem {
  matcher: TokenMatcher;
  ignore: Set<string>;
}

export function matchingLexer(
  src: string,
  rootMatcher: TokenMatcher,
  ignore = new Set(["ws"]),
  srcMap?: SrcMap,
): Lexer {
  let matcher = rootMatcher;
  const matcherStack: MatcherStackElem[] = [];

  matcher.start(src);

  function next(): Token | undefined {
    const start = matcher.position();
    const { token } = toNextToken();
    if (token && tracing) {
      const text = quotedText(token?.text);
      srcTrace(srcMap ?? src, start, `: ${text} (${token?.kind})`);
    }
    return token;
  }

  function skipIgnored(): number {
    const { p } = toNextToken();

    // back up to the position before the first non-ignored token
    matcher.position(p);
    return p;
  }

  /** Advance to the next token
   * @return the token, and the position at the start of the token (after ignored ws) */
  function toNextToken(): { p: number; token?: Token } {
    let p = matcher.position();
    if (eof()) return { p };

    // advance til we find a token we're not ignoring
    let token = matcher.next();
    while (token && ignore.has(token.kind)) {
      p = matcher.position(); // save position before the token
      if (eof()) return { p };
      token = matcher.next();
    }
    return { p, token };
  }

  function pushMatcher(newMatcher: TokenMatcher, newIgnore: Set<string>): void {
    const position = matcher.position();
    matcherStack.push({ matcher, ignore });
    newMatcher.start(src, position);
    matcher = newMatcher;
    ignore = newIgnore;
  }

  function popMatcher(): void {
    const position = matcher.position();
    const elem = matcherStack.pop();
    if (!elem) {
      console.error("too many pops");
      return;
    }
    matcher = elem.matcher;
    ignore = elem.ignore;

    matcher.position(position);
  }

  function position(pos?: number): number {
    if (pos !== undefined) {
      matcher.start(src, pos);
    }
    return matcher.position();
  }

  function withMatcher<T>(newMatcher: TokenMatcher, fn: () => T): T {
    return withMatcherIgnore(newMatcher, ignore, fn);
  }

  function withIgnore<T>(newIgnore: Set<string>, fn: () => T): T {
    return withMatcherIgnore(matcher, newIgnore, fn);
  }

  function withMatcherIgnore<T>(
    tokenMatcher: TokenMatcher,
    ignore: Set<string>,
    fn: () => T,
  ): T {
    pushMatcher(tokenMatcher, ignore);
    const result = fn();
    popMatcher();
    return result;
  }

  function eof(): boolean {
    return matcher.position() === src.length;
  }

  return {
    next,
    position,
    withMatcher,
    withIgnore,
    eof,
    skipIgnored,
    src,
  };
}

export function quotedText(text?: string): string {
  return text ? `'${text.replace(/\n/g, "\\n")}'` : "";
}

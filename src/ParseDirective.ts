import {
  ExportElem,
  ImportElem
} from "./AbstractElems.js";
import {
  directiveArgsTokens,
  mainTokens
} from "./MatchWgslD.js";
import {
  any,
  ExtendedResult,
  fn,
  kind,
  not,
  opt,
  or,
  ParserStage,
  repeat,
  seq,
  tokens
} from "./ParserCombinator.js";
import {
  eol,
  wordArgs
} from "./ParseSupport.js";
import { lineComment, makeElem, ParseState } from "./ParseWgslD.js";

/* parse directives added to wgsl like #import, #export, #if, and #else */

const a = directiveArgsTokens;

/** foo <(A,B)> <as boo> <from bar>  EOL */
const importPhrase = seq(
  kind(a.word).named("name"),
  opt(wordArgs.named("args")),
  opt(seq("as", kind(a.word).named("as"))),
  opt(seq("from", kind(a.word).named("from")))
)
  .map((r) => {
    // flatten 'args' by putting it with the other extracted names
    const named: (keyof ImportElem)[] = ["name", "from", "as", "args"];
    return makeElem<ImportElem>("import", r, named, []);
  })
  .traceName("importElem");

export const importing = seq(
  "importing",
  seq(importPhrase.named("importing")),
  repeat(seq(",", importPhrase.named("importing")))
).traceName("importing");

/** #import foo <(a,b)> <as boo> <from bar>  EOL */
const importDirective = seq(
  "#import",
  tokens(directiveArgsTokens, seq(importPhrase.named("i"), eol))
)
  .map((r) => {
    const imp: ImportElem = r.named.i[0];
    imp.start = r.start; // use start of #import, not import phrase
    r.app.push(imp);
  })
  .traceName("import");

/** #export <foo> <(a,b)> <importing bar(a) <zap(b)>* > EOL */
// prettier-ignore
const exportDirective = seq(
  "#export",
  tokens(
    directiveArgsTokens,
    seq(
      opt(kind(a.word).named("name")), 
      opt(wordArgs.named("args")), 
      opt(importing), 
      eol
    )
  )
)
  .map((r) => {
    // flatten 'args' by putting it with the other extracted names
    const e = makeElem<ExportElem>("export", r, ["name", "args"], ["importing"]);
    r.app.push(e);
  })
  .traceName("export");

const ifDirective: ParserStage<any> = seq(
  "#if",
  tokens(
    directiveArgsTokens,
    seq(opt("!").named("invert"), kind(mainTokens.word).named("name"), eol)
  ).toParser((r) => {
    const { params } = r.appState as ParseState;
    const ifArg = r.named["name"]?.[0] as string;
    const invert = r.named["invert"]?.[0] === "!";
    const arg = !!params[ifArg];
    const truthy = invert ? !arg : arg;
    return ifBody(r, truthy);
  })
).traceName("#if");

const elseDirective = seq("#else", tokens(directiveArgsTokens, eol))
  .toParser((r) => {
    const { ifStack } = r.appState as ParseState;
    const ifState = ifStack.pop();
    if (ifState === undefined) console.warn("unmatched #else", r.start);
    return ifBody(r, !ifState);
  })
  .traceName("#else");

// prettier-ignore
const skipUntilElseEndif = repeat(
  seq(
    or(
      fn(() => lineComment),  // LATER shouldn't need the fn wrap
      seq(
        not("#else"), 
        not("#endif"),
        any()
      ), 
    )
  )
).traceName("skipTo #else/#endif");

function ifBody(
  r: ExtendedResult<any>,
  truthy: boolean
): ParserStage<any> | undefined {
  const { ifStack } = r.appState as ParseState;
  ifStack.push(truthy);
  if (!truthy) return skipUntilElseEndif;
}

const endifDirective = seq("#endif", tokens(directiveArgsTokens, eol))
  .map((r) => {
    const { ifStack } = r.appState as ParseState;
    const ifState = ifStack.pop();
    if (ifState === undefined) console.warn("unmatched #endif", r.start);
  })
  .traceName("#endif");

export const directive = or(
  exportDirective,
  importDirective,
  ifDirective,
  elseDirective,
  endifDirective
).traceName("directive or");

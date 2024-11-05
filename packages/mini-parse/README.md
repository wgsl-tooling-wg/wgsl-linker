**MiniParse** is a small TypeScript parser combinator library with an efficient
regex based lexer.

## Parser Features

- **MiniParse** is a combinator library.
  You write a grammar by combining simple TypeScript
  functions like `or()`, `repeat()`, and `seq()`.
  It's just TypeScript so it's easy to mix with your existing code,
  IDE, test frameworks, etc.
- **MiniParse** is a Parsing Expression Grammar (PEG) parser.
  Parsing is simple to understand, top down, using recursive descent with backtracking.
- Parsers are modular - every grammar fragment is also a parser and can be tested
  and reused independently.
- Small code size makes **MiniParse** suitable for runtime embedding (< 4kb compressed).
- Extensive debug tracing for use while developing grammars.
  (Tracing is automatically removed from production builds).
- Error reporting is included, with full line context displayed.

## Advanced Features

- Swap lexers under parser control. Handy for parsing quotes,
  or for mixed language parsing (e.g. html in jsx).
- Stack parsers to parse things that can appear almost anywhere in your grammar.
  Handy for things like nested comments, semantic comments (jsdoc), or annotations.
- Named accumulators make it easy to collect parsing results
  from deeply nested sub parsers.
- Mapped logging utilities are available for error reporting on preprocessed src.

## Parsing

Typically you can write a parser by mixing combinator functions from the library.

Here's a parser for a simple sum expression:

```ts
export const simpleSum = seq(num, or("+", "-"), num);
```

Here's a parser for nested block comments:

```ts
export const blockComment: Parser<void> = seq(
  "/*",
  repeat(or(() => blockComment, anyNot("*/"))),
  req("*/"),
);
```

The example above uses the combinators:
`seq()`, `repeat()`, `or()`, `anyNot()`, and `req()`.
More combinators are available and documented in [ParserCombinator.ts](./src/ParserCombinator.ts)

To any combinator that accepts a parser as an argument, you can pass:

- another parser
- a function that returns a parser - uses the returned parser, but calls
  the function lazily
- a string - a parser that accepts any token exactly matching the string

## Lexer

Parsing relies on a lexer to divide the source string into parts, called tokens.
(You could produce a token per character, but that would be comparatively slow)

Here's an example token matcher to identify three kinds of tokens for parsing
simple arithmetic expressions.

```ts
export const simpleTokens = tokenMatcher({
  number: /\d+/,
  symbol: matchOneOf("( ) ^ + - * /"),
  ws: /\s+/,
});
```

To create a lexer that walks over a source text producing tokens, use:

```ts
const text = "3 + 4";
const lexer = matchingLexer(text, simpleTokens);
```

By default, the lexer will skip over whitespace tokens that you designate with
the name 'ws'. You can configure whether and which tokens to skip statically by
passing the set of names skip when you construct the `matchingLexer`, or
dynamically while parsing by using the `tokensIgnore()` combinator.

## Running the Parser

To run a parser, just give it a lexer attached to your source text.

```ts
const result = simpleSum.parse({ lexer });
```

The result will contain the combined results of the parsers, in this case
`["3", "+", "4"]`.

### Selecting Parsing Results

Typically, it's convenient to use `.map()` to select the relevant parts from a
successful parse and do a bit of format conversion.

This parser will return a number rather than a string:

```ts
const int = num.map(r => parseInt(r.value));
```

Here's an example that even does some computation, and returns a numeric sum or
difference of the whole expression. It parses the same text as `simpleSum`
above, but converts to numbers and then adds or subtracts.

```ts
// return the numeric sum, rather than a sequence of strings
export const sumResults = seq(int, or("+", "-"), int).map(r => {
  const [a, op, b] = r.value;
  return op === "+" ? a + b : a - b;
});
```

Note that `.map()` is only called on successful parses of the mapped expression,
if the expression fails, the parser will backtrack and try any alternatives in
the grammar and `.map()` will not be called on the failed part of the parse.

### App State

For larger parsers, you'll typically convert the parsed text into an
intermediate form, sometimes called an
[Abstract Syntax Tree](https://en.wikipedia.org/wiki/Abstract_syntax_tree).

`.parse()` allows you to pass an application specific data structure that's
visible in `.map()` for convenience in building the abstract syntax tree with
each successfully parsed element.

```ts
type ASTElem = BinOpElem;

interface BinOpElem {
  kind: "binOp";
  left: number | BinOpElem;
  right: number | BinOpElem;
  op: "+" | "-";
}

export const sumElem = seq(int, or("+", "-"), int).map(r => {
  const [a, op, b] = r.value;
  const binOpElem: BinOpElem = {
    kind: "binOp",
    left: a,
    right: b,
    op: op as "+" | "-",
  };
  r.app.state.push(binOpElem);
});
```

### Named Results

For complicated nested or repeating parsers,
it's convenient to assign names to particular results of interest.
You can use a `Symbol` or a string to name a result using the `.named()`
method on all parsers.
Multiple results with the same name are accumulated into an array.

```ts
const op = or("+", "-");

export const namedSum = seq(
  int,
  repeat(seq(op, int).named("opRights")), // accumulate an array of [op, int] pairs
).map(r => {
  const { opRights } = r.named;
  const left = r.value[0];
  if (!opRights) return left;
  return opRights.reduce((acc, opRight) => {
    const [op, right] = opRight;
    return op === "+" ? acc + right : acc - right;
  }, left);
});
```

## Debug Tracing

For debugging your grammar, it's useful to debug your grammar in pieces. One of
the nice features of parser combinators is that every part of the grammar is
independently testable.

To print out the progress of parsing:

1. Call `enableTracing()` to turn on the tracing facility (normally off and
   removed from prod builds)
1. Call `.trace(opts?)` on any Parser. See `TraceOptions` for options
   controlling trace levels.
1. Add application relevant trace names to any parser using `.traceName()` or
   `setTraceName()`.
   - Use `.traceName()` on any parser to set the trace name for debugging.
   - Alternately, you can use `setTraceName()` protected by a `tracing` global
     and the javascript bundler will remove the code in production builds to
     save a few bytes.

```ts
if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    fnCall,
    fnParam,
    fnParamList,
    fnDecl,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
```

## Examples

[Calculator](./src/examples/CalculatorExample.ts) - classic PEG style parser in
**MiniParse** syntax.

[Calculator with Results](./src/examples/CalculatorResultsExample.ts) calculator
example parser with inline calculation of results.

[WGSL-D](../linker/src/ParseWgslD.ts) parsing selected parts of the WebGPU
[WGSL](https://www.w3.org/TR/WGSL/#grammar-recursive-descent) shader language
along with `#import` and `#export` extensions.

## Special Situations

### tokens() combinator

Sometimes it's nice to let the grammar choose a different tokenizer
to parse different sections of the source text.
For example, to parse a programming language with quotes,
you'll probably want a different tokenizer for the text inside of quotes:

```ts
const quote = seq('"', tokens(quoteTokens, repeat(nonQuote)), '"');
```

### .toParser()

In unusual cases, it can be handy to choose the next parser based
on information outside the grammar itself.
For example, to handle an `#ifdef` style preprocessor, the parsing
proceeds differently depending on whether the `#ifdef` is true or false,
and information outside the source text may be required to decide.
If you want to check a runtime dictionary to decide which parser to
use for the next tokens, than `.toParser` is of use.

### preParse() combinator

If the language you're parsing has some elements that can appear almost anywhere,
it'd be awkward to mention those elements at every possible position in the grammar.
Examples include nested block comments, comments containing semantic info, etc.

To handle pervasive elements, **MiniParse** offers an unusual feature called preparsing
that allows you to stack parsers. First the pre-parser will run,
and if it fails to match at the current position, then the main parser will run.

```ts
const p = preParse(blockComments, mainParser);
```

Multiple preparsers can be attached. Preparsing can also be temporarily disabled
in the grammar, e.g. to disable comment skipping inside quotes.

Save preparsing for special situations.
If the pervasive elements are easy to find and can be skipped,
then adding a few token types to skip in the lexer is simpler and faster.
That's typically the approach for white space.

### app.context

There are two application specific objects that are passed to every parser:
`state` and `context`.
`app.state`, as mentioned above, is handy for accumulating application
results of successful parses.

`app.context` is useful to store ephemeral application state discovered
during parsing.
Like `app.state`, `app.context` is just for applications -
**MiniParse** doesn't use it
and applications can read and write it using the `.map()` method on any parser.
But unlike `app.state` **MiniParse** will reset `app.context`
when a sub-parser fails and backtracks.
`app.context` is passed to child parsers, but doesn't accumulate to parent parsers.

An example of using `app.context` is for parsing nested `#ifdef` `#endif` clauses.
`app.context` is a good place to store
the stack of active/inactive states discovered while
parsing.

### Left recursion

Left recursive rules are typically disallowed in top down parsers, including MiniParse.
In the parser combinator setting, it's obvious why - a function calling itself
in its first statement is going to recurse forever.
Best to write the grammar so that recursion is in the middle or at the end.
See the block comment example or the calculator example.

## Future Work

PEG parsers like MiniParse can be sped up using a memoization algorithm called
packrat parsing.

[Tratt](https://tratt.net/laurie/research/pubs/html/tratt__direct_left_recursive_parsing_expression_grammars/)
describes a technique to allow some left recursive rules, based on
[Warth](https://tinlizzie.org/VPRIPapers/tr2007002_packrat.pdf)'s proposal
for left recursion with packrat parsing.
[Rossum](https://medium.com/@gvanrossum_83706/left-recursive-peg-grammars-65dab3c580e1)
also has pursued this approach for Python.
But per Tratt, note that the resulting parse order is not as predictable, and there
are issues with rules that are simultaneously left and right recursive.

Allowing a regex as a parser argument would be convenient to avoid
the need for a separate lexer in some cases.

## Choosing a Parsing Approach

Is **MiniParse** right for your project? Consider the alternatives:

- **Full Custom Parser** - _maximum speed and ultimate malleability, lots of work._

  For maximum speed and control, write a dedicated parser directly in Typescript.
  This is the most effort, but if you're writing a production compiler and need
  to squeeze every millisecond, it's worth it.
  Otherwise use a parser generator tool suite or a parser combinator library.

- **Parser Generator** - _high speed, some work to adopt._

  Parser generators statically analyze and precompile a grammar description language.
  These mature tools can be a bit big, but there's lots of documentation,
  rich ecosystems of example code and support tools.

  Worthy examples include:
  [Nearley](https://nearley.js.org/),
  [Lezer](https://lezer.codemirror.net/),
  [Antlr](https://www.antlr.org/),
  [Chevrotain](https://chevrotain.io/docs/),
  [Tree-sitter](https://tree-sitter.github.io/tree-sitter/),
  or [Ohm](https://ohmjs.org/).
  Each parser generator has its own textual format to describe the grammar. The library
  compiles into an execution format before parsing.
  Each of the above libraries uses a different base algorithm (Earley, GLR, LL, Packrat)
  with different tradeoffs, but all have evolved robust features to classic parsing
  problems of error recovery, left recursion, producing parse results, tracing, etc.

  Parser generators are typically more complicated to adopt
  than parser combinator libraries,
  less flexible, require a separate build step,
  and they're more code than typical parser combinators.
  But for demanding parsing jobs, the complexity of a parser generator tool is
  easily worth the investment.

- **Parser Combinators** - _lower speed, most flexibility, lightweight adoption._

  Parser combinators define a grammar by mixing simple TypeScript functions
  provided by the library or written by the user (aka combinator functions).
  Execution of the grammar normally means simply running these functions.
  The simplicity makes parser combinators flexible and easy to adopt - you're using
  TypesScript for everything.

  Parser combinators typically interpret rather than compiling the grammar in advance,
  so they're slower to run. But they're plenty fast enough for most purposes.

  In the Parser Combinator category, **MiniParse** has a few interesting features
  and is notably lightweight.
  As you're parser shopping, also consider other worthy and more mature libraries
  in the TypeScript parser combinator category like:
  [ts-parsec](https://github.com/microsoft/ts-parsec)
  and [ParJS](https://github.com/GregRos/parjs).

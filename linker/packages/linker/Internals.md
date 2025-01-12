# Linker Internals

The linker's job is merge multiple WESL string fragments
into one combined WGSL string.
Suitable for WebGPU's `createShaderModule`.

The WESL language is a superset of WGSL, including support
for import statements, conditional compilation, etc.

wesl-js is designed to enable linking at runtime in the browser
to enable conditional compilation of shaders based on application specific
conditions (e.g. `@if(useShadowMap)` )

Because wesl-js is intended to run in the browser,
it assumes no access to the original source filesystem.
The caller is expected to provide named WESL strings, typically
by bundling `.wesl` files into strings with a build tool like `vite`.

## Setting up to link

- _build_ - .wesl source files are converted into strings for runtime registration.
- _register_ - wgsl fragments are parsed into the ParsedRegistry
- _link_ - create a merged wgsl string, starting from a root module
  in the registry.
  The linked wgsl string contains only vanilla WGSL.
  extended WESL syntax (e.g. import statements, conditions) is removed.

## Linking phases

Linking is relatively straightforward.

1. Parse WESL strings into the ParsedRegistry
    - Each WESL module is parsed into a WeslAST.
    - There are three notable structures in the `WeslAST`:
        - `AbstractElem`s for the traditional abstract syntax tree,
          roughly mirroring the structure of source statements in the WESL language.
            - Most `AbstractElements` can contain other elements via their `contents` field.
            - Contents typically include `TextElem`s, which record semantically
            uninteresting parts of the source text.
            (The `TextElem`s are typically copied verbatim to the output WGSL.
            As a result, the output of a trivial WESL link of unextended WGSL
            code is the same as the original WGSL.)
        - `ImportTree` for the import statements
        - `Scope` tree for a heirarchical tree of identifiers,
          with `DeclIdent` declaration identifiers distinguished
          from `RefIdent` references by the parser.
1. Traverse the `Scope` tree from the root module,
  tracing references to declarations by searching for matching declarations
  in parent scopes and import statements.
    - Each `DeclIdent` includes an attached `Scope` containing the references attached to the declaration.
    For example, the `DeclIdent` for a WESL `fn` declaration will point to a `Scope` containing
    all of the references in the `fn` body.
    - The traversal will recursively visit each of
    the references in the scoped attached to the declaration,
    and trace those references to their declarations too.
    - This recursive walk through through the identifier
    graph eventually visits every declaration that
    will be linked into the final WGSL.
    - During the traversal
        1. Mangle the names of declarations as necessary for uniqueness by
        mutating the `mangledName` field of the `DeclIdent`.
        1. Link references to declaration by mutating the `refersTo` field
        in the `RefIdent`.
        1. Return the complete list of visited declarations.
1. Emit all of the declarations.
    - Each declaration AbstractElem is written to the output result WGSL string
      along with any contained elements.
        - Each contained declaration is rewritten to use its `mangledName`.
        - Each contained reference is rewritten to use the `mangledName`
        from the declaration it `refersTo`.

## Error Reporting

If the linker finds a parsing or semantic error,
it logs a console message for the programmer including
the source line and a fragment of the source text.

An internal `SrcMap` provided by `MiniParse` is used to maintain the mapping
from edited text to the original text.
Linker errors found while processing the edited text can
then be reported to the user in terms of the source text.
User error logging routines like `srcLog()` take a `SrcMap`
as a paramater to facilitate error logging.
`SrcMap`s may stack to cover multiple rounds of rewrites.

# Linker Internals

The linker's job is merge multiple wgsl string fragments
into one combined string.
Normally each string fragment comes from a source .wgsl file
and the combined wgsl string is passed to WebGPU's `createShaderModule`.

The fragments are merged together by following an
and extended wgsl syntax that includes
support for modules via import and export statements
to select wgsl elements to merge.
Several other wgsl extensions are supported during
processing as well: code generators (code that emits wgsl),
and generic programming.

wgsl-linker is designed to enable linking at runtime in the browser
to enable conditional compiling and conditional linking based
on gpu characteristics.
Because wgsl-linker runs in the browser, it has no access
to the original source filesystem.
The caller of the linker provides wgsl strings
and file names to the linker so that it can
provide the programmer with filesystem-like relative
imports: `import foo from ./bar`.
Typical build tools (vite, rollup) will bundle up source
files to into strings and filenames for that purpose.
(the build tool syntax is a bit cumbersome, though,
a build plugin could polish that.)

## Setting up to link

- _build_ - wgsl source files are converted into strings for runtime registration.
- _register_ - wgsl fragments are registered in the ModuleRegistry
  for later retrieval.
  No wgsl processing is done at registration time.
- _link_ - create a merged wgsl string, starting from a root fragment
  in the registry.
  The merged wgsl string contains only vanilla wgsl,
  all extended syntax (import, export) is processed and the
  extended syntax is removed.

## Linking phases

Linking is relatively straightforward.

1. Preprocess and parse the registry
   - parse wgsl fragments into an abstract syntax tree. see `AbstractElem`
1. Traverse the abstract syntax tree recursively, starting from the wgsl
   elements in the root wgsl fragment.
   - The accumulated list of wgsl elements (`FoundRef[]`)
     will eventually be concatenated into the linked result string.
   - each FoundRef has a deconflicted 'rename' name
     so that wgsl element names will be unique in the linked result.
     see `findReferences() handleRef()`.
   - During the traverse, mutate the abstract elem graph to add
     a link from referencing elements (e.g. a call, type annotation)
     to their FoundRef target (e.g. fn, struct).
     (so we can rename referencing elements as necessary)
1. The text of all referenced FoundRef[] elements is extracted
   from the source fragment, rewritten according to any renaming,
   and concatenated into the final linked result string.

## Embellishments

- Importing is allowed from user supplied code generator functions.
  Code generator functions expose module names and export names -
  importing from a code generator is just like importing from a package,
  but internally the code calls the generator function instead.
- Users can plug in their own text processor to run during the preprocessing phase.
- ImportResolutionMap - Fully expand wildcard and list style imports,
  distinguish imports that refer to wgsl elements
  from (rust only) path prefix imports.
- To support generic parameters imports/exports, a map between
  export parameter names and import names is created during `ImportResolutionMap`
  construction.
  The expImpArgs map is used to rewrite generic elements during extraction.

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

Currently, linker errors are reported correctly by mapping sources
through preprocessing via a SrcMap.

## Future Work

Linker rewriting should also track through a `SrcMap`
(in addition to preprocessing), so that
wgsl parsing errors from dawn/naga can also be
translated to the original source.

Consider rewriting graph mutations as separate passes
producing new data structures to improve clarity (rather
than mutating optional fields in existing data structures).

Simplify internal differences between generator imports and regular imports.

Simplify internal differences between local refs and non-local refs,
e.g. provide ExportInfo for local refs too.

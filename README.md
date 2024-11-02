# wgsl-linker

**wgsl-linker** enriches the WGSL shader language to support
linking code modules via `import`.
Linking can be done entirely at runtime.

For those in the JavaScript/Typescript world, think 'bundling'.
The **wgsl-linker** is a module bundler for WGSL.

As with other programming languages,
module linking becomes useful when your WGSL code grows
large enough to be split into separate reusable files (aka modules).
Linking integrates the code modules together while solving for:

- renaming - Two functions with the same name?
  The linker will rename one of them, and all the calls to the renamed function.
- deduplication - Two modules import the same function? You get only one copy.
- recursion - Importing a function that references another import? You get all references, recursively.
- dead code - Importing a function from a big module?
  You get only that function and its references, not the whole file.

**wgsl-linker** is currently being revised to follow the upcoming community [WESL standard](https://github.com/wgsl-tooling-wg/wesl-spec).

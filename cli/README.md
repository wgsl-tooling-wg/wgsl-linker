## wgsl-link

**wgsl-link** is a tool for preprocessing and linking multiple WGSL shader modules into a single WGSL module from the command line.

See [wgsl-linker](https://github.com/wgsl-tooling-wg/wgsl-linker)
for more details of wgsl syntax extensions
like `#import` and `#export`.

### Usage

```sh
wgsl-link <rootWgsl> [libraryWgsl...]
```

Merges the rootWgsl file with any imports
found in the libraryWgsl files and outputs a bundled wgsl to stdout.

### Options

`--define name=value` &ensp;
defines variables for conditional compilation
and template preocessing. Mutliple name=value pairs can be specified.

`--base-dir <path element>` &ensp;
sets the base directory for resolving relative paths.

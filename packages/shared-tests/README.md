# WGSL Examples for Testing

This package contains wgsl source texts useful
to verify WGSL parsing and linking.

## WGSL and Linking Extended WGSL

The source texts are an shared as an array of objects
in both JSON and TypeScript format.
The format is described in:
[TestSchema.ts](./src/TestSchema.ts)

JSON version:
[import-cases.json](./src/test-cases/import-cases.json)

TypeScript version:
[ImportCases.ts](./src/test-cases/ImportCases.ts)

## Add Examples in TypeScript

Author new examples in TypeScript.
TypeScript is similar to JSON but a little more convenient.
In TypeScript,
there's no need to quote keys and multiline strings are allowed.

### Convert TypeScript Tests to JSON

A tool is available to convert the TypeScript objects to JSON.

#### Install dependencies and build the tool

```sh
pnpm install
```

#### Generate JSON test cases from ts

```sh
pnpm cases
```

```sh
pnpm cases:watch
```

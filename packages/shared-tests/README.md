# WESL Examples for Testing

This package contains wesl source texts useful
to verify WESL parsing and linking.

## Test Format

The source texts are published as an array of objects
in both JSON and TypeScript format.
The format is described in:
[TestSchema.ts](./src/TestSchema.ts)

JSON version:
[importCases.json](./src/test-cases-json/importCases.json)
[importSyntaxCases.json](./src/test-cases-json/importSyntaxCases.json)

TypeScript version:
[ImportCases.ts](./src/test-cases/ImportCases.ts)
[ImportSyntaxCases.ts](./src/test-cases/ImportSyntaxCases.ts)

## Adding New Tests

Author new examples in TypeScript.
(TypeScript is similar to JSON but a little more user friendly for authoring.)

A tool is included in the package to convert the TypeScript objects to JSON.

### Convert TypeScript Tests to JSON


#### Install dependencies

```sh
pnpm install
```

#### Generate JSON test cases from TypeScript

```sh
pnpm cases
```

#### Generate JSON test cases from TypeScript continuously

```sh
pnpm cases:watch
```

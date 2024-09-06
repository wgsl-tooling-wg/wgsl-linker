import { ParsingTest } from "../TestSchema.js";

export const importSyntaxCases: ParsingTest[] = [

  /* ------  failure cases  -------   */

  { src: "import", fails: true },
  { src: "import foo", fails: true },
  { src: "import ./foo", fails: true },
  { src: "import ../foo", fails: true },
  { src: "import ./foo /bar", fails: true },
  { src: "import .", fails: true },
  { src: "import ./", fails: true },
  { src: "import ../", fails: true },
  { src: "import ../.", fails: true },
  { src: "import ../..", fails: true },
  { src: "import foo/{*}", fails: true },
  { src: "import foo/*/b", fails: true },
  { src: "import foo/{}", fails: true },
  { src: "import foo/../bar/baz", fails: true },
  { src: "import foo/bee as boo/bar", fails: true },

  /* ------  success cases  -------   */

  { src: "import ./foo/bar" },
  { src: "import ../../foo/bar" },
  { src: `import ../b/c/d` },
  { src: `import a/b/c` },
  { src: "import foo/bar" },
  { src: "import foo/{a,b}" },
  { src: "import foo/{a, b}" },
  { src: "import foo/bar/{a, b}" },
  { src: "import a/{b, c }" },
  { src: "import foo/* as b" },
  { src: "import foo/a as b" },
  { src: `import a/b/{c as foo}` },
  {
    src: `import ./foo/bar
          fn main() {}`,
  },
  {
    src: `
    import bevy_pbr/{
             mesh_view_bindings,
             utils/{PI, noise},
             lighting/*
           }`,
  },
];

export default importSyntaxCases;

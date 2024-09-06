import { WgslTestSrc } from "../TestSchema.js";

export const importCases: WgslTestSrc[] = [
  {
    name: `import ./bar/foo`,
    src: {
      "./main.wgsl": `
          import ./bar/foo 
          fn main() {
            foo();
          }
       `,
      "./bar.wgsl": `
          export fn foo() { }
       `,
    },
  },
  {
    name: `main has other root elements`,
    src: {
      "./main.wgsl": `
          struct Uniforms {
            a: u32
          }

          @group(0) @binding(0) var<uniform> u: Uniforms;

          fn main() { }
      `
    },
  },
  {
    name: `import foo as bar`,
    src: {
      "./main.wgsl": `
        import ./file1/foo as bar;

        fn main() {
          bar();
        }
      `,
      "./file1.wgsl": `
        export fn foo() { /* fooImpl */ }
      `
    },
  },
  {
    name: `import twice doesn't get two copies`,
    src: {
      "./main.wgsl": `
        import ./file1/foo
        import ./file2/bar

        fn main() {
          foo();
          bar();
        }
      `,
      "./file1.wgsl": `
        export fn foo() { /* fooImpl */ }
      `,
      "./file2.wgsl": `
        import ./file1/foo
        export fn bar() { foo(); }
      `
    },
  },
  {
    name: `imported fn calls support fn with root conflict`,
    src: {
      "./main.wgsl": `
        import foo from ./file1

        fn main() { foo(); }
        fn conflicted() { }
      `,
      "./file1.wgsl": `
        export fn foo() {
          conflicted(0);
          conflicted(1);
        }
        fn conflicted(a:i32) {}
      `,
    },
  },
  {
    name: `import twice with two as names`,
    src: {
      "./main.wgsl": `
        import ./file1/foo as bar
        import ./file1/foo as zap

        fn main() { bar(); zap(); }
      `,
      "./file1.wgsl": `
        export fn foo() { }
      `
    },
  },
  // {
  //   name: ``,
  //   src: {
  //     "./main.wgsl": `
  //     `,
  //     "./file1.wgsl": `
  //     `,
  //     "./file2.wgsl": `
  //     `
  //   },
  // },

]

export default importCases;
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
      `,
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
      `,
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
      `,
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
      `,
    },
  },
  {
    name: `import transitive conflicts with main`,
    src: {
      "./main.wgsl": `
        import ./file1/mid

        fn main() {
          mid();
        }

        fn grand() {
          /* main impl */
        }
      `,
      "./file1.wgsl": `
        import ./file2/grand
        
        export fn mid() { grand(); }
      `,
      "./file2.wgsl": `
        export fn grand() { /* grandImpl */ }
      `,
    },
  },

  {
    name: `multiple exports from the same module`,
    src: {
      "./main.wgsl": `
        import ./file1/{foo, bar}

        fn main() {
          foo();
          bar();
        }
      `,
      "./file1.wgsl": `
        export fn foo() { }
        export fn bar() { }
      `,
    },
  },

  {
    name: `import and resolve conflicting support function`,
    src: {
      "./main.wgsl": `
        import ./file1/foo as bar

        fn support() { 
          bar();
        }
      `,
      "./file1.wgsl": `
        export
        fn foo() {
          support();
        }

        fn support() { }
      `,
    },
  },

  {
    name: `import support fn that references another import`,
    src: {
      "./main.wgsl": `
        import ./file1/foo

        fn support() { 
          foo();
        }
      `,
      "./file1.wgsl": `
        import ./file2/bar

        export fn foo() {
          support();
          bar();
        }

        fn support() { }
      `,
      "./file2.wgsl": `
        export fn bar() {
          support();
        }

        fn support() { }
      `,
    },
  },
  
  {
    name: "import support fn from two exports",
    src: {
      "./main.wgsl": `
        import ./file1/foo
        import ./file1/bar
        fn main() {
          foo();
          bar();
        }
      `,
      "./file1.wgsl": `
        export fn foo() {
          support();
        }

        export fn bar() {
          support();
        }

        fn support() { }
      `,
    },
  },

  {
    name: "import a struct",
    src: {
      "./main.wgsl": `
          import ./file1/AStruct

          fn main() {
            let a = AStruct(1u); 
          }
      `,
      "./file1.wgsl": `
        export struct AStruct {
          x: u32,
        }
      `,
      "./file2.wgsl": `
      `,
    },
  },
  
  {
    name: "import fn with support struct constructor",
    src: {
      "./main.wgsl": `
        import ./file1/elemOne

        fn main() {
          let ze = elemOne();
        }
      `,
      "./file1.wgsl": `
        struct Elem {
          sum: u32
        }

        export fn elemOne() -> Elem {
          return Elem(1u);
        }
      `,
      "./file2.wgsl": `
      `,
    },
  },

  {
    name: "import a transitive struct",
    src: {
      "./main.wgsl": `
        import ./file1/AStruct

        struct SrcStruct {
          a: AStruct,
        }
      `,
      "./file1.wgsl": `
        import ./file2/BStruct

        export struct AStruct {
          s: BStruct,
        }
      `,
      "./file2.wgsl": `
        export struct BStruct {
          x: u32,
        }
      `,
    },
  },
  
  {
    name: "'import as' a struct",
    src: {
      "./main.wgsl": `
        import ./file1/AStruct as AA

        fn foo (a: AA) { }
      `,
      "./file1.wgsl": `
        export struct AStruct { x: u32 }
      `,
    },
  },
  
  // {
  //   name: "",
  //   src: {
  //     "./main.wgsl": `
  //     `,
  //     "./file1.wgsl": `
  //     `,
  //     "./file2.wgsl": `
  //     `,
  //   },
  // },
  
  // {
  //   name: "",
  //   src: {
  //     "./main.wgsl": `
  //     `,
  //     "./file1.wgsl": `
  //     `,
  //     "./file2.wgsl": `
  //     `,
  //   },
  // },
  

  
];

export default importCases;

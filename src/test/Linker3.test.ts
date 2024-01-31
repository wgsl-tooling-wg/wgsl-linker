import { expect, test } from "vitest";
import { ModuleRegistry2 } from "../ModuleRegistry2.js";
import { linkWgsl3 } from "../Linker3.js";
import { dlog } from "berry-pretty";

test("simple #import", () => {
  const myModule = `
    // #export
    fn foo() { /* fooImpl */ }
  `;

  const src = `
    // #import foo
    fn bar() {
      foo();
    }
  `;
  const registry = new ModuleRegistry2(myModule);
  const linked = linkWgsl3(src, registry);
  expect(linked).includes("fooImpl");
  expect(linked).not.includes("#import");
  expect(linked).not.includes("#export");
});

test("#import with parameter", () => {
  const myModule = `
    // #export (Elem)
    fn foo(a: Elem) { /* fooImpl */ }
  `;

  const src = `
    struct MyElem {}

    // #import foo(MyElem)
    fn bar() {
      foo();
    }
  `;
  const registry = new ModuleRegistry2(myModule);
  const linked = linkWgsl3(src, registry);
  expect(linked).includes("a: MyElem");
});

test("transitive import", () => {
  const binOpModule = `
    // #export(Elem) 
    fn binaryOp(a: Elem, b: Elem) -> Elem {
        return a + b; // binOpImpl
    }`;
  const reduceModule = `
    #export(work, E) importing binaryOp(E)
    fn reduceWorkgroup(index:u32) {
        let combined = binaryOp(work[index], work[index + 1u]);
    }
    `;
  const src = `
    // #import reduceWorkgroup(myWork, u32)
  
    fn main() {
      reduceWorkgroup(localId); // call the imported function
    }`;
  const registry = new ModuleRegistry2(binOpModule, reduceModule);
  const linked = linkWgsl3(src, registry);
  expect(linked).includes("myWork[index]");
  expect(linked).not.includes("work[");
  expect(linked).includes("binOpImpl");
});

test("#import foo as bar", () => {
  const myModule = `
    #export
    fn foo() { /* fooImpl */ }
   `;

  const src = `
    #import foo as bar

    fn main() {
      bar();
    }
   `;
  const registry = new ModuleRegistry2(myModule);
  const linked = linkWgsl3(src, registry);
  expect(linked).contains("fn bar()");
});

test("#import twice doesn't get two copies", () => {
  const module1 = `
    #export
    fn foo() { /* fooImpl */ }
  `;
  const module2 = `
    #export
    fn bar() { foo(); }

    #import foo
  `;
  const src = `
    #import bar
    #import foo

    fn main() {
      foo();
      bar();
    }
  `;
  const registry = new ModuleRegistry2(module1, module2);
  const linked = linkWgsl3(src, registry);
  const matches = linked.matchAll(/fooImpl/g);
  expect([...matches].length).toBe(1);
});

test("import transitive conflicts with main", () => {
  const module1 = `
    #export
    fn grand() {
      /* grandImpl */
    }
  `;
  const module2 = `
    #import grand
    
    #export
    fn mid() { grand(); }
  `;
  const src = `
    #import mid

    fn main() {
      mid();
    }

    fn grand() {
      /* main impl */
    }
  `;
  const registry = new ModuleRegistry2(module1, module2);
  const linked = linkWgsl3(src, registry);
  expect(linked).includes("mid() { grand0(); }");
});

test("#import twice with different names", () => {
  const module1 = `
    #export(A)
    fn foo(a:A) { /* module1 */ }
  `;
  const src = `
    #import foo(b) as bar
    #import foo(z) as zap

    fn main() {
      bar();
      zap();
    }
  `;
  const registry = new ModuleRegistry2(module1);
  const linked = linkWgsl3(src, registry);
  const matches = linked.matchAll(/module1/g);
  expect([...matches].length).toBe(2);
});

test("#import foo from zap (multiple modules)", () => {
  const module1 = `
    // #export
    fn foo() { /* module1 */ }
  `;
  const module2 = `
    // #export
    fn foo() { /* module2 */ }
  `;

  const src = `
    #import foo as baz from module2

    fn main() {
      baz();
    }
  `;

  const registry = new ModuleRegistry2();
  registry.registerOneModule(module1, "module1");
  registry.registerOneModule(module2, "module2");
  const linked = linkWgsl3(src, registry);
  expect(linked).contains("/* module2 */");
});

test("multiple exports from the same module", () => {
  const module1 = `
    #export
    fn foo() { }
    #export
    fn bar() { }
  `;
  const src = `
    #import foo
    #import bar
    fn main() {
      foo();
      bar();
    }
  `;
  const registry = new ModuleRegistry2(module1);
  const linked = linkWgsl3(src, registry);
  expect(linked).toMatchSnapshot();
});

test("#import and resolve conflicting support function", () => {
  const module1 = `
    #export
    fn foo() {
      support();
    }

    fn support() { }
  `;
  const src = `
    #import foo as bar

    fn support() { 
      bar();
    }
  `;
  const registry = new ModuleRegistry2(module1);
  const linked = linkWgsl3(src, registry);
  const origMatch = linked.matchAll(/\bsupport\b/g);
  expect([...origMatch].length).toBe(1);
  const module1Match = linked.matchAll(/\bsupport0\b/g);
  expect([...module1Match].length).toBe(2);
  const barMatch = linked.matchAll(/\bbar\b/g);
  expect([...barMatch].length).toBe(2);
});

test("#import support fn that references another import", () => {
  const src = `
    #import foo 

    fn support() { 
      foo();
    }
  `;
  const module1 = `
    #import bar

    #export
    fn foo() {
      support();
      bar();
    }

    fn support() { }
  `;
  const module2 = `
    #export
    fn bar() {
      support();
    }

    fn support() { }
  `;

  const registry = new ModuleRegistry2(module1, module2);
  const linked = linkWgsl3(src, registry);

  const origMatch = linked.matchAll(/\bsupport\b/g);
  expect([...origMatch].length).toBe(1);
  const module1Match = linked.matchAll(/\bsupport0\b/g);
  expect([...module1Match].length).toBe(2);
  const module2Match = linked.matchAll(/\bsupport1\b/g);
  expect([...module2Match].length).toBe(2);
});

test("#import support fn from two exports", () => {
  const src = `
    #import foo
    #import bar 
    fn main() {
      foo();
      bar();
    }
  `;
  const module1 = `
    #export
    fn foo() {
      support();
    }

    #export
    fn bar() {
      support();
    }

    fn support() { }
  `;

  const registry = new ModuleRegistry2(module1);
  const linked = linkWgsl3(src, registry);
  const supportMatch = linked.matchAll(/\bsupport\b/g);
  expect([...supportMatch].length).toBe(3);
});

test("#export importing", () => {
  const src = `
    #import foo(A, B)
    fn main() {
      foo(k, l);
    } `;
  const module1 = `
    #export(C, D) importing bar(D)
    fn foo(c:C, d:D) { bar(d); } `;
  const module2 = `
    #export(X)
    fn bar(x:X) { } `;
  const registry = new ModuleRegistry2(module1, module2);
  const linked = linkWgsl3(src, registry);
  expect(linked).contains("fn bar(x:B)");
});

test("#import a struct", () => {
  const src = `
    #import AStruct 

    fn main() {
      let a = AStruct(1u); 
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      x: u32,
    }
  `;
  const registry = new ModuleRegistry2(module1);
  const linked = linkWgsl3(src, registry);
  console.log(linked);
});

test.skip("#importMerge a struct", () => {
  const src = `
    #importMerge AStruct 
    struct MyStruct {
      x: u32,
    }

    fn main() {
      let a: MyStruct; 
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      y: u32,
    }
  `;
  const registry = new ModuleRegistry2(module1);
  const linked = linkWgsl3(src, registry);
  console.log(linked);
});

// TODO test importing a struct constructor
test.skip("import fn with support struct constructor", () => {
  const src = `
    #import zero
    fn main() {
      let ze = zero();
    }
  `;
  const module1 = `
    struct Elem {
      sum: u32;
    }

    #export 
    fn zero() -> Elem {
      return Elem(0u);
    }
  `;
  const registry = new ModuleRegistry2(module1);
  const linked = linkWgsl3(src, registry);
  console.log(linked);
});

// test("import with template replace", () => {
//   const myModule = `
//     #template replacer
//     #export(threads)
//     fn foo() {
//       for (var step = 0; step < 4; step++) { //#replace 4=threads
//       }
//     }
//   `;
//   const src = `
//     #import foo(128)
//     foo();
//   `;
//   const registry = new ModuleRegistry(myModule);
//   registry.registerTemplate(replacerTemplate);
//   const linked = linkWgsl(src, registry);
//   expect(linked).includes("step < 128");
// });

// test("#import snippet w/o support functions", () => {
//   const module1 = `
//     var logVar: u32;

//     #template replacer
//     #export log(logVar, logType)
//       log(logVar, "u32"); // #replace u32=logType
//   `;

//   const src = `
//     fn foo() {
//       myVar: i32 = 1;
//       #import log(myVar, i32)
//     }
//   `;
//   const registry = new ModuleRegistry(module1);
//   registry.registerTemplate(replacerTemplate);
//   const linked = linkWgsl(src, registry);
//   expect(linked).contains('log(myVar, "i32");');
// });

// test("#import snippet w/ support functions", () => {
//   const module1 = `
//     var logVar: u32;

//     #template replacer
//     #export log(logVar, logType)
//       log(logVar);
//     #endInsert
//     fn log(myVar: u32) {} // #replace u32=logType
//   `;

//   const src = `
//     fn foo() {
//       myVar: i32 = 1;
//       #import log(myVar, i32)
//     }
//   `;
//   const registry = new ModuleRegistry(module1);
//   registry.registerTemplate(replacerTemplate);
//   const linked = linkWgsl(src, registry);
//   expect(linked).includes("log(myVar);");
//   expect(linked).includes("fn log(myVar: i32) {}");
// });

// test("resolve conflicting import support struct imports", () => {
//   const module1 = `
//     #export
//     fn foo() {
//       e: Elem = Elem(1);
//     }

//     struct Elem {
//       v: i32,
//     }

//     var <workgroup> a: array<Elem, 64>;
//   `;

//   const src = `
//      #import foo
//      #import foo as bar

//      struct Elem {
//        other: f32;
//      }

//      foo();
//      bar();
//     `;
//   const registry = new ModuleRegistry(module1);
//   const linked = linkWgsl(src, registry);
//   const origMatch = linked.matchAll(/\bElem\b/g);
//   expect([...origMatch].length).toBe(1);
//   const module1Match = linked.matchAll(/\bElem_0\b/g);
//   expect([...module1Match].length).toBe(4);
//   const module2Match = linked.matchAll(/\bElem_1\b/g);
//   expect([...module2Match].length).toBe(4);
// });

// test("#import from code generator", () => {
//   function generate(params: { name: string }): string {
//     return `fn foo() { /* ${params.name}Impl */ }`;
//   }

//   const src = `
//     #import foo(bar)

//     foo();
//   `;
//   const registry = new ModuleRegistry();
//   registry.registerGenerator("foo", generate as CodeGenFn, ["name"]);
//   const linked = linkWgsl(src, registry);
//   expect(linked).contains("barImpl");
// });

// test("#import as with code generator", () => {
//   function generate(params: { name: string }): string {
//     return `fn foo() { /* ${params.name}Impl */ }`;
//   }

//   const src = `
//     #import foo(bar) as baz

//     baz();
//   `;
//   const registry = new ModuleRegistry();
//   registry.registerGenerator("foo", generate as CodeGenFn, ["name"]);
//   const linked = linkWgsl(src, registry);
//   expect(linked).contains("fn baz()");
// });

// test("#import code generator snippet with support", () => {
//   function generate(params: { name: string; logType: string }): TextInsert {
//     return {
//       src: `log(${params.name});`,
//       rootSrc: `fn log(logVar: ${params.logType}) {}`,
//     };
//   }

//   const src = `
//     fn foo() {
//       let bar: i32 = 1
//       #import log(bar, i32)
//     }
//   `;
//   const registry = new ModuleRegistry();
//   registry.registerGenerator("log", generate as CodeGenFn, ["name", "logType"]);
//   const linked = linkWgsl(src, registry);
//   expect(linked).contains("log(bar);");
//   expect(linked).contains("fn log(logVar: i32) {}");
// });

// test("external param applied to template", () => {
//   const module1 = `
//     #template replacer
//     #export(threads)
//     fn foo() {
//       for (var step = 0; step < 4; step++) { //#replace 4=threads
//       }
//     }
//   `;
//   const src = `
//     #import foo(workgroupThreads)
//     foo();
//   `;
//   const registry = new ModuleRegistry(module1);
//   registry.registerTemplate(replacerTemplate);
//   const params = { workgroupThreads: 128 };
//   const linked = linkWgsl(src, registry, params);
//   expect(linked).includes("step < 128");
// });

// test("#endExport", () => {
//   const module1 = `
//     struct Foo {
//     //  #export field
//       sum: u32;
//     // #endExport
//     }`;
//   const src = `
//     struct MyStruct {
//       // #import field
//     }`;
//   const registry = new ModuleRegistry(module1);
//   const linked = linkWgsl(src, registry);
//   expect(linked).toMatchSnapshot();
// });

// test("#template in src", () => {
//   const src = `
//     #template replacer
//     fn main() {
//       for (var step = 0; step < 4; step++) { //#replace 4=threads
//       }
//     }
//   `;
//   const registry = new ModuleRegistry();
//   registry.registerTemplate(replacerTemplate);
//   const params = { threads: 128 };
//   const linked = linkWgsl(src, registry, params);
//   expect(linked).includes("step < 128");
// });

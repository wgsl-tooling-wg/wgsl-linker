import { _withBaseLogger } from "@wesl/mini-parse";
import { logCatch } from "@wesl/mini-parse/test-util";
import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.ts";
import { simpleTemplate } from "../templates/SimpleTemplate.ts";
import { linkTestOpts, linkTest } from "./TestUtil.ts";

test.ignore("#extends a struct in the root src", () => {
  const src = `
    #extends AStruct from ./file1
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
  const linked = linkTest(src, module1);
  expect(linked.match(/struct MyStruct {/g)).toHaveLength(1);
  expect(linked).toContain(`struct MyStruct {\n  x: u32,\n  y: u32\n}`);
});

test.ignore("#extends an empty struct", () => {
  const src = `
    #extends AStruct 
    struct MyStruct {
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
  const linked = linkTest(src, module1);
  expect(linked.match(/struct MyStruct {/g)).toHaveLength(1);
  expect(linked).toContain(`struct MyStruct {\n  y: u32\n}`);
});

test.ignore("#extends a struct in a module", () => {
  const src = `
    #import AStruct from ./file1
    fn main() {
      let a: AStruct; 
    }
  `;
  const module1 = `
    #export
    #extends BStruct
    struct AStruct {
      x: i32,
    }
  `;
  const module2 = `
    #export 
    struct BStruct {
      z: u32
    }
  `;

  const linked = linkTest(src, module1, module2);
  expect(linked.match(/struct AStruct/g)).toHaveLength(1);
  expect(linked).toContain(`struct AStruct {\n  x: i32,\n  z: u32\n}`);
});

test.ignore("two #extends on the same struct", () => {
  const src = `
    #import AStruct from ./file1
    fn main() {
      let a: AStruct; 
    }
  `;
  const module1 = `
    #export
    #extends BStruct
    #extends CStruct
    struct AStruct {
      x: i32,
    }
  `;
  const module2 = `
    #export 
    struct BStruct {
      z: u32
    }
  `;
  const module3 = `
    #export 
    struct CStruct {
      d: f32 
    }
  `;

  const linked = linkTest(src, module1, module2, module3);
  expect(linked.match(/struct AStruct/g)).toHaveLength(1);
  expect(linked).toContain(
    `struct AStruct {\n  x: i32,\n  z: u32,\n  d: f32\n}`,
  );
});

test.ignore("#extends struct with imp/exp param", () => {
  const src = `
    #import AStruct(i32)
    fn main() {
      let a: AStruct; 
    }
  `;
  const module1 = `
    #export(X)
    #extends BStruct
    struct AStruct {
      x: X,
    }
  `;
  const module2 = `
    #export 
    struct BStruct {
      z: u32
    }
  `;

  const linked = linkTest(src, module1, module2);
  expect(linked.match(/struct AStruct/g)).toHaveLength(1);
  expect(linked).toContain(`struct AStruct {\n  x: i32,\n  z: u32\n}`);
});

test.ignore("transitive #extends ", () => {
  const src = `
    #import AStruct 

    fn main() {
      let a: AStruct; 
    }
  `;
  const module1 = `
    #export
    #extends BStruct
    struct AStruct {
      x: u32,
    }

    #export
    #extends CStruct
    struct BStruct {
      y: u32
    }

    #export
    struct CStruct {
      z: u32
    }
  `;
  const linked = linkTest(src, module1);
  expect(linked.match(/struct AStruct {/g)).toHaveLength(1);
  expect(linked).toContain(
    `struct AStruct {\n  x: u32,\n  y: u32,\n  z: u32\n}`,
  );
});

test.ignore("transitive #extends from root", () => {
  const src = `
    #extends BStruct
    struct AStruct {
      x: u32,
    }
  `;
  const module1 = `
    #export
    #extends CStruct
    struct BStruct {
      y: u32
    }
  `;
  const module2 = `
    #export
    struct CStruct {
      z: u32
    }
  `;
  const linked = linkTest(src, module1, module2);
  expect(linked.match(/struct AStruct {/g)).toHaveLength(1);
  expect(linked).toContain(
    `struct AStruct {\n  x: u32,\n  y: u32,\n  z: u32\n}`,
  );
});

test.ignore("extend struct with rename", () => {
  const src = `
    // #extends HasColor(fill) 
    struct Sprite {
        pos: vec2f,
    }
  `;
  const module1 = `
      // #export(color)
      struct HasColor {
         color: vec4f, 
      }
    `;

  const linked = linkTest(src, module1);
  expect(linked).toContain("fill: vec4f");
});

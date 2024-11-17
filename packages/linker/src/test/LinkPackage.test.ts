import { expect, test } from "vitest";
import lib from "wgsl-rand";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { expectNoLog } from "mini-parse/test-util";

// TODO-lee this breaks because the current parser hacks
// to produce calls or typeRefs are overzealous and confuse traverseRefs.
// Current plan is to fix the linker to not expect calls and typeRefs.
// 
test.skip("import rand() from a package", () => {
  const src = `
    import wgsl-rand/pcg_2u_3f; 

    struct Uniforms { frame: u32 }
    @binding(0) @group(0) var<uniform> u: Uniforms;

    @fragment
    fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f {
        let rand = pcg_2u_3f(vec2u(pos.xy) + u.frame);
        return vec4(rand, 1f);
    }
  `;

  const wgsl = { "./main.wesl": src };
  const result = expectNoLog(() => {
    const registry = new ModuleRegistry({ wgsl, libs: [lib] });
    return registry.link("./main");
  });
  expect(result).toContain("fn pcg_2u_3f");
});

import { expect, test } from "vitest";
import { parseWESL } from "../ParseWESL.ts";
import { scopeIdentTree } from "../ScopeLogging.ts";
import { DeclIdent } from "../Scope.ts";

test("scope from simple fn", () => {
  const src = `
    fn main() {
      var x: i32 = 1;
    }
  `;
  const { rootScope } = parseWESL(src);
  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`
    "{ %main
      { %x, i32 }
    }"
  `);
});

test("scope from fn with reference", () => {
  const src = `
    fn main() {
      var x: i32 = 1;
      x++;
    }
  `;
  const { rootScope } = parseWESL(src);
  const scopeIdents = rootScope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["main"]);
  const firstChildIdents = rootScope.children[0].idents.map(
    i => i.originalName,
  );
  expect(firstChildIdents).toEqual(["x", "i32", "x"]);
});

test("two fns", () => {
  const src = `
    fn foo() {}
    fn bar() {}
  `;
  const { rootScope } = parseWESL(src);
  const scopeIdents = rootScope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["foo", "bar"]);
});

test("two fns, one with a decl", () => {
  const src = `
    fn foo() {
      var a:u32;
    }
    fn bar() {}
  `;
  const { rootScope } = parseWESL(src);
  const scopeIdents = rootScope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["foo", "bar"]);
});

test("fn ref", () => {
  const src = `
    fn foo() {
      bar();
    }
    fn bar() {}
  `;
  const result = parseWESL(src);
  const { children } = result.rootScope;
  expect(children.length).toBe(2);
  const firstChildIdents = children[0].idents.map(i => i.originalName);
  expect(firstChildIdents).toEqual(["bar"]);
});

test("struct", () => {
  const src = `
    struct A {
      a: B,
    }
  `;
  const { rootScope } = parseWESL(src);
  const scopeIdents = rootScope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["A"]);

  const { children } = rootScope;
  expect(children.length).toBe(1);
  const firstChildIdents = children[0].idents.map(i => i.originalName);
  expect(firstChildIdents).toEqual(["B"]);
});

test("alias", () => {
  const src = `
    alias A = B;
  `;
  const { rootScope } = parseWESL(src);
  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`"{ %A, B }"`);
});

test("switch", () => {
  const src = `
    fn main() {
      var code = 1u;
      switch ( code ) {
        case 5u: { if 1 > 0 { var x = 7;} }
        default: { break; }
      }
    }`;
  const { rootScope } = parseWESL(src);

  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`
    "{ %main
      { %code, code
        { 
          { %x }
        }
        {  }
      }
    }"
  `);
});

test("for()", () => {
  const src = `
    fn main() {
      var i = 1.0;
      for (var i = 0; i < 10; i++) { }
    }`;
  const { rootScope } = parseWESL(src);

  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`
    "{ %main
      { %i
        { %i, i, i }
      }
    }"
  `);
});

test("fn with param", () => {
  const src = `
    fn main(i: i32) {
      var x = 10 + i;
      for (var i = 0; i < x; i++) { }
    }`;
  const { rootScope } = parseWESL(src);
  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`
    "{ %main
      { %i, i32, %x, i
        { %i, i, x, i }
      }
    }"
  `);
});

test("fn decl scope", () => {
  const src = `
    fn main(i: i32) {
      var x = i;
    }`;
  const { rootScope } = parseWESL(src);
  const mainIdent = rootScope.idents[0] as DeclIdent;
  expect(scopeIdentTree(mainIdent.scope)).toMatchInlineSnapshot(
    `"{ %i, i32, %x, i }"`,
  );
});

test("builtin scope", () => {
  const src = `fn main( @builtin(vertex_index) a: u32) { }`;
  const { rootScope } = parseWESL(src);
  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`
    "{ %main
      { %a, u32 }
    }"
  `);
});

test("texture_storage_2d", () => {
  const src = `
    @binding(3) @group(0) var tex_out : texture_storage_2d<rgba8unorm, write>;
  `;
  const { rootScope } = parseWESL(src);
  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`"{ %tex_out }"`);
});

// TODO add test for ptr type 

test("larger example", () => {
  const src = `
    struct UBO { width : u32, }

    struct Buffer { weights : array<f32>, }

    @binding(0) @group(0) var<uniform> ubo : UBO;
    @binding(1) @group(0) var<storage, read> buf_in : Buffer;
    @binding(2) @group(0) var<storage, read_write> buf_out : Buffer;
    @binding(3) @group(0) var tex_in : texture_2d<f32>;
    @binding(3) @group(0) var tex_out : texture_storage_2d<rgba8unorm, write>;

    @compute @workgroup_size(64)
    fn import_level(@builtin(global_invocation_id) coord : vec3u) {
      _ = &buf_in;
      let offset = coord.x + coord.y * ubo.width;
      buf_out.weights[offset] = textureLoad(tex_in, vec2i(coord.xy), 0).w;
    }

    @compute @workgroup_size(64)
    fn export_level(@builtin(global_invocation_id) coord : vec3u) {
      if (all(coord.xy < vec2u(textureDimensions(tex_out)))) {
        let dst_offset = coord.x    + coord.y    * ubo.width;
        let src_offset = coord.x*2u + coord.y*2u * ubo.width;

        let a = buf_in.weights[src_offset + 0u];
        let b = buf_in.weights[src_offset + 1u];
        let c = buf_in.weights[src_offset + 0u + ubo.width];
        let d = buf_in.weights[src_offset + 1u + ubo.width];
        let sum = dot(vec4f(a, b, c, d), vec4f(1.0));

        buf_out.weights[dst_offset] = sum / 4.0;

        let probabilities = vec4f(a, a+b, a+b+c, sum) / max(sum, 0.0001);
        textureStore(tex_out, vec2i(coord.xy), probabilities);
      }
    }
  `;

  const { rootScope } = parseWESL(src);
  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`
    "{ %UBO, %Buffer, %ubo, UBO, %buf_in, Buffer, %buf_out, 
      Buffer, %tex_in, texture_2d, f32, %tex_out, %import_level, 
      %export_level
      { u32 }
      { array, f32 }
      { %coord, vec3u, buf_in, %offset, coord, coord, ubo, 
        buf_out, offset, textureLoad, tex_in, vec2i, coord
      }
      { %coord, vec3u, all, coord, vec2u, textureDimensions, 
        tex_out
        { %dst_offset, coord, coord, ubo, %src_offset, coord, 
          coord, ubo, %a, buf_in, src_offset, %b, buf_in, 
          src_offset, %c, buf_in, src_offset, ubo, %d, buf_in, 
          src_offset, ubo, %sum, dot, vec4f, a, b, c, d, vec4f, 
          buf_out, dst_offset, sum, %probabilities, vec4f, a, a, 
          b, a, b, c, sum, max, sum, textureStore, tex_out, 
          vec2i, coord, probabilities
        }
      }
    }"
  `);
});

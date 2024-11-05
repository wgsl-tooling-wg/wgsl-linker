import { expect, test } from "vitest";
import { linkTest } from "./TestUtil.ts";

test.ignore("transitive with importing", () => {
  const binOpModule = `
    #export(Elem) 
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
  const linked = linkTest(src, binOpModule, reduceModule);
  expect(linked).toContain("myWork[index]");
  expect(linked).not.toContain("work[");
  expect(linked).toContain("binOpImpl");
});

test.ignore("#export importing", () => {
  const src = `
    #import foo(A, B) from ./file1
    fn main() {
      foo(k, l);
    } `;
  const module1 = `
    #export(C, D) importing bar(D) from ./file2
    fn foo(c:C, d:D) { bar(d); } `;
  const module2 = `
    #export(X)
    fn bar(x:X) { } `;
  const linked = linkTest(src, module1, module2);
  expect(linked).toContain("fn bar(x:B)");
});

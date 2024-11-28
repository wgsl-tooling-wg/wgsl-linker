/* eslint-disable @typescript-eslint/no-unused-vars */
import { test } from "vitest";

test("chain", () => {
  type ChainElem<I, O> = { in: I; out: O };
  type Elem = ChainElem<any, any>;
  type ElemOut<T> = T extends ChainElem<any, infer O> ? O : never;
  type ElemIn<T> = T extends ChainElem<infer I, any> ? I : never;

  type ChainOK<T extends Elem[]> =
    T extends [infer A, ...infer R] ?
      R extends readonly [Elem, ...Elem[]] ?
        ElemOut<A> extends ElemIn<R[0]> ?
          R extends Elem[] ?
            ChainOK<R>
          : "??" // (how could R not extend Elem[]?)
        : false // fail
      : true // R is empty, so we've succeeded..
    : true; // no elements

  function chain<T extends Elem[]>(...args: T): ChainOK<T> {
    return true as any;
  }
  const ns: ChainElem<number, string> = { in: 1, out: "s" };
  const sn: ChainElem<string, number> = { in: "i", out: 9 };
  const nn: ChainElem<number, number> = { in: 4, out: 3 };

  const t0: true = chain();
  const t1: true = chain(ns);

  const t2: true = chain(ns, sn);
  const f2: false = chain(nn, sn);

  const t3: true = chain(ns, sn, ns);
  const f3: false = chain(ns, sn, sn);

  const t4: true = chain(ns, sn, ns, sn);
  const f4: false = chain(ns, sn, ns, nn);
});

// verify that we can count elems recursively
test("recurse count", () => {
  type CountRecurse<T extends unknown[]> =
    T extends [infer A, ...infer R] ?
      R extends readonly [unknown, ...unknown[]] ?
        `x${CountRecurse<R>}`
      : "y"
    : "z";

  type T0 = CountRecurse<[]>; // z
  type T1 = CountRecurse<[1]>; // y
  type T2 = CountRecurse<[1, 2]>; // xy
  type T3 = CountRecurse<[1, 2, 3]>; // xxy
  type T4 = CountRecurse<[1, 2, 3, 4]>; // xxxy
});

test("chain with error reporting", () => {
  type ChainElem<I, O> = { in: I; out: O };
  type Elem = ChainElem<any, any>;
  type ElemOut<T> = T extends ChainElem<any, infer O> ? O : never;
  type ElemIn<T> = T extends ChainElem<infer I, any> ? I : never;

  // prettier-ignore
  type ChainOK<T extends Elem[]> = 
    T extends [infer A, ...infer R]
      ? R extends readonly [unknown, ...unknown[]]
        ? ElemOut<A> extends ElemIn<R[0]>
          ? R extends Elem[]
            ? ChainOK<R>
            : "??" // (how could R not extend Elem[]?)
          : {msg: `chain input doesn't match previous output`, types: [ElemOut<A>, ElemIn<R[0]>]} // fail
        : T // R is empty, so we've succeeded..
      : T ; // no elements

  function chain<T extends Elem[]>(...args: ChainOK<T>): void {
    return true as any;
  }
  const ns: ChainElem<number, string> = { in: 1, out: "s" };
  const sn: ChainElem<string, number> = { in: "i", out: 9 };
  const nn: ChainElem<number, number> = { in: 4, out: 3 };

  // const f2 = chain(nn, sn); // fails to compile (which is what we want here)
  //    Argument of type '[ChainElem<number, number>, ChainElem<string, number>]' is
  //    not assignable to parameter of type
  //    '{ msg: "chain input doesn't match previous output"; types: [number, string]; }'
});

test("withIndex", () => {
  // prettier-ignore
  type WithIndex<T extends unknown[]> = 
    T extends unknown
      ? { [K in keyof T]: [K, T[K]] }
      : never;

  type m = WithIndex<[string, number]>;
});

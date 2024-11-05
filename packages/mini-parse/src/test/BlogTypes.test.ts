/* eslint-disable @typescript-eslint/no-unused-vars */
import { test } from "vitest";
import { Intersection } from "../CombinatorTypes.js";

function NYI(): any {
  return null as any;
}

test("types example", () => {
  // type TBD = any;
  // type TagRecord = Record<string, any[]>;
  // class TaggedResult<T, N extends TagRecord> {
  //   constructor(value: T) {}
  //   tag(name: string): TBD {
  //     NYI();
  //   }
  //   get result(): T {
  //     return NYI();
  //   }
  //   get tags(): N {
  //     return NYI();
  //   }
  // }
  // function seq(...taggedResultsOrString: TBD[]): TaggedResult<TBD, TBD> {
  //   NYI();
  // }
  // const a = new TaggedResult(1).tag("A");
  // const b = new TaggedResult("bo");
  // const s = seq(a, b.tag("B"), "foo");
});

test("types solution", () => {
  type TagRecord = Record<string, any[]>;
  class Tags<N extends TagRecord> {
    addTag<K extends string, V>(
      name: K,
      value: V,
    ): Tags<N & { [key in K]: V[] }> {
      return NYI();
    }
  }

  type CombineArg = string | Tags<any>;
  // function combine(...tags:CombineArg[]):Tags<TBD>
});

test("infer type parameter", () => {
  // prettier-ignore
  interface ThreeParams<A, B, C> { a: A; b: B; c: C; }

  type InferB<T extends ThreeParams<any, any, any>> =
    T extends ThreeParams<any, infer B, any> ? B : never;

  type HiddenThree = ThreeParams<any, any, any>;

  function makeThree<A, B, C>(a: A, b: B, c: C): ThreeParams<A, B, C> {
    return { a, b, c };
  }

  function fooB<T extends HiddenThree>(a: T): InferB<T> {
    return NYI();
  }

  function fooB_simple<B>(a: ThreeParams<any, B, any>): B {
    return NYI();
  }

  function fooB_nope(a: HiddenThree): InferB<typeof a> {
    return NYI();
  }

  function manyParams<A, B, C, D, E, F, G, H, I>(
    a: ThreeParams<A, B, C>,
    b: ThreeParams<D, E, F>,
    c: ThreeParams<G, H, I>,
  ): B {
    return NYI();
  }

  function fooM<A, B, C>(args: ThreeParams<any, any, any>[]): any {
    return NYI();
  }

  /** return type is the second type parameter of the first argument */
  function fooH<T extends HiddenThree>(...args: T[]): InferB<(typeof args)[0]> {
    return NYI();
  }

  const p = makeThree("foo", 1, true);
  const f: number = fooB(p);
  const h = fooB_simple(p); // works too
  const g = fooB_nope(p); // g is of type any, not what we want

  const x = fooH(p);
});

test("extend a record", () => {
  const a = { a: 1, b: "foo" };
  const b = { ...a, c: true };

  class Tags<N extends Record<string, any>> {
    add<K extends string, V>(name: K, value: V): Tags<N & { [k in K]: V }> {
      name;
      value;
      return this as any;
    }
    read(): N {
      return NYI();
    }
  }
  const tags = new Tags().add("c", true);
  const moreTags = tags.add("bar", "zap"); // add more fields
  const record: { c: boolean; bar: string } = moreTags.read(); // properly typed result

  b;
  record;
});

test("mapped tuple type", () => {
  type Wrapped<T extends string | number> =
    T extends string ? { str: T }
    : T extends number ? { num: T }
    : T;

  // prettier-ignore
  type WrapElems<T extends (string | number)[]> = 
    { [key in keyof T]: Wrapped<T[key]> };

  function wrapEm<T extends (string | number)[]>(...args: T): WrapElems<T> {
    args;
    return NYI();
  }

  const w: [{ num: number }, { str: string }] = wrapEm(1, "foo");
});

test("remove type from tuple or array", () => {
  const a = [1, "foo", true] as const;

  type Stringless<T extends any[]> =
    T extends [infer A, ...infer R] ?
      A extends string ?
        Stringless<R> // A is not a string, skip it
      : [A, ...Stringless<R>] // A is a string, include it
    : [];

  function removeStrings<T extends any[]>(...args: T): Stringless<T> {
    args;
    return NYI();
  }

  const b: [1, true] = removeStrings(...a); // works, type does not include "foo"
});

test("Recovering Record Key Names", () => {
  type Elem = Record<string, any>;
  type MapValues<E extends Elem[]> = { [key in keyof E]: E[key] };

  function f<T extends Elem[]>(...a: T): Intersection<MapValues<T>> {
    return a as any;
  }

  const y = f({ foo: 1 }, { bar: "z" });
});

test("test intersection", () => {
  type ARecord = Record<any, any>;
  type Verify<T extends ARecord> = T; // will fail to typecheck if T is not a Record

  type SimpleIntersection<A extends ARecord, B extends ARecord> = Verify<A & B>;
  type ConcreteIntersect = Verify<Intersection<{ a: 1 } | { b: 2 }>>;
  // type ParamIntersect<A extends ARecord> = Verify<Intersection<A>>; // fails to typecheck

  type AsRecord<T> =
    T extends Record<any, any> ? { [A in keyof T]: T[A] } : never;
  type ParamIntersect2<A extends ARecord> = Verify<AsRecord<Intersection<A>>>;

  type Test1 = ParamIntersect2<{ a: 1 } | { b: 2 }>; // type Test1 = { a: 1; b: 2; }
});

test("intersecting", () => {
  // prettier-ignore
  type Intersection<U> = 
    (U extends any ? 
      (k: U) => void : never) extends 
      (k: infer I) => void ? 
    I : never;
});

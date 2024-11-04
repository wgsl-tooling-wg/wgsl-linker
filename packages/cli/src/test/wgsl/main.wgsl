import ./util/foo;

fn main() {
  foo();
}

#if EXTRA
fn extra() { }
#endif

#if typecheck
fn foo() {}
#endif
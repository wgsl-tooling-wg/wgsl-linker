/** merge two objects containing arrays, arrays in liked named keys are concatenated */
export function mergeTags(
  a: Record<string | symbol, any[] | undefined>,
  b: Record<string | symbol, any[] | undefined>,
): Record<string, any[]> {
  const aKeys = Reflect.ownKeys(a); // captures symbols
  const sharedKeys = aKeys.filter((k) => b[k]);
  // combine arrays from liked named keys
  const sharedEntries = sharedKeys.map((k) => [
    k,
    [...(a[k] ?? []), ...(b[k] ?? [])],
  ]);
  const shared = Object.fromEntries(sharedEntries);
  return { ...a, ...b, ...shared }; // shared keys overwritten with combined arrays
}

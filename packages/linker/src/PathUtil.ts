/** simplistic path manipulation utilities */

export function relativePath(
  srcPath: string | undefined,
  reqPath: string,
): string {
  if (!srcPath) return reqPath;
  const srcDir = dirname(srcPath);
  const relative = join(srcDir, reqPath);
  return relative;
}

export function dirname(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) return ".";
  return path.slice(0, lastSlash);
}

export function join(a: string, b: string): string {
  const joined = b.startsWith("/") ? a + b : a + "/" + b;
  return normalize(joined);
}

/** return path with ./ and foo/.. elements removed */
export function normalize(path: string): string {
  const segments = path.split("/");
  const noDots = segments.filter(s => s !== ".");
  const noDbl: string[] = [];

  noDots.forEach(s => {
    if (s !== "") {
      if (s === ".." && noDbl.length && noDbl[noDbl.length - 1] !== "..") {
        noDbl.pop();
      } else {
        noDbl.push(s);
      }
    }
  });

  return noDbl.join("/");
}

/** return path w/o a suffix.
 * e.g. /foo/bar.wgsl => /foo/bar */
export function noSuffix(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  const lastStart = lastSlash === -1 ? 0 : lastSlash + 1;

  const suffix = path.indexOf(".", lastStart);
  const suffixStart = suffix === -1 ? path.length : suffix;
  return path.slice(0, suffixStart);
}

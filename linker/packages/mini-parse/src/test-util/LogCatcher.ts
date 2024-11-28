export interface LogCatcher {
  /** tests can use this to replace console.log with a log capturing function */
  log: (...params: any[]) => void;
  logged: () => string;
}

export function logCatch(): LogCatcher {
  const lines: string[] = [];
  function log(...params: any[]): void {
    lines.push(params.join(" "));
  }
  function logged(): string {
    return lines.join("\n");
  }
  return { log, logged };
}

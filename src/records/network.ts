let ready: Promise<boolean> = Promise.resolve(false);
let repair: (() => Promise<boolean>) | undefined;
let recovery: Promise<boolean> | undefined;
export function configureNetwork(value: Promise<boolean>, recover?: () => Promise<boolean>): void { ready = value; repair = recover; }
export function networkReady(): Promise<boolean> { return ready; }
export function recoverNetwork(): Promise<boolean> {
  if (!repair) return Promise.resolve(false);
  if (!recovery) {
    recovery = repair().finally(() => { recovery = undefined; });
    ready = recovery;
  }
  return recovery;
}

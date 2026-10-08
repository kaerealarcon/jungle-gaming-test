import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
const options = { quiet: true, serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` }, onUnhandledRequest: 'bypass' as const };
export const mockReady: Promise<boolean> = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  ? worker.start(options).then(() => true).catch(() => false)
  : Promise.resolve(false);

export async function recoverMocks(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  worker.stop();
  return worker.start(options).then(() => true).catch(() => false);
}
if (import.meta.hot) import.meta.hot.dispose(() => worker.stop());

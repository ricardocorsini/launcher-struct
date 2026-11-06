import { active } from './domain';
import type { LauncherUpdate, Snapshot } from './types';

export const UPDATE_INTERVAL_MS = 15 * 60 * 1000;
export const WAKE_THROTTLE_MS = 60 * 1000;

export interface CheckResult {
  snapshot?: Snapshot;
  launcher?: LauncherUpdate;
  errors: unknown[];
}

// One coordinator for startup, the timer, wake events and the manual check button.
export function createUpdateChecker(dependencies: {
  snapshot: () => Snapshot | null;
  refresh: () => Promise<Snapshot>;
  checkLauncher: () => Promise<LauncherUpdate>;
  online: () => boolean;
  busy: () => boolean;
  now?: () => number;
}) {
  let pending: Promise<CheckResult> | null = null;
  let attemptedAt = -Infinity;
  const now = dependencies.now ?? Date.now;
  return {
    check(manual = false): Promise<CheckResult> {
      if (pending) return pending;
      const snapshot = dependencies.snapshot();
      if (manual && !dependencies.online())
        return Promise.reject(new Error('Sem conexão. Conecte-se e tente novamente.'));
      if (manual && snapshot?.jobs.some((job) => active(job.phase)))
        return Promise.reject(
          new Error('Aguarde os downloads terminarem antes de verificar atualizações.'),
        );
      if (
        !snapshot?.native ||
        !dependencies.online() ||
        snapshot.jobs.some((job) => active(job.phase)) ||
        (!manual && dependencies.busy()) ||
        (!manual && (!snapshot.settings.checkOnStart || now() - attemptedAt < WAKE_THROTTLE_MS))
      )
        return Promise.resolve({ errors: [] });
      attemptedAt = now();
      pending = (async () => {
        const [catalog, launcher] = await Promise.allSettled([
          snapshot.settings.catalogUrl
            ? Promise.resolve().then(dependencies.refresh)
            : Promise.resolve(snapshot),
          Promise.resolve().then(dependencies.checkLauncher),
        ]);
        return {
          snapshot: catalog.status === 'fulfilled' ? catalog.value : undefined,
          launcher: launcher.status === 'fulfilled' ? launcher.value : undefined,
          errors: [catalog, launcher].flatMap((result) =>
            result.status === 'rejected' ? [result.reason] : [],
          ),
        };
      })().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}

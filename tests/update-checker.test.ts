import { describe, expect, it, vi } from 'vitest';
import { createUpdateChecker, WAKE_THROTTLE_MS } from '../src/update-checker';
import type { Snapshot } from '../src/types';

function fixture() {
  const snapshot = {
    native: true,
    jobs: [],
    settings: { catalogUrl: 'https://github.com/catalog', checkOnStart: true },
  } as unknown as Snapshot;
  let time = 0;
  let online = true;
  let busy = false;
  const refresh = vi.fn(async () => snapshot);
  const checkLauncher = vi.fn(async () => ({
    configured: true,
    version: '0.3.0',
    notes: 'Nova versão',
  }));
  const checker = createUpdateChecker({
    snapshot: () => snapshot,
    refresh,
    checkLauncher,
    online: () => online,
    busy: () => busy,
    now: () => time,
  });
  return {
    snapshot,
    refresh,
    checkLauncher,
    checker,
    tick: () => {
      time += WAKE_THROTTLE_MS;
    },
    offline: () => {
      online = false;
    },
    busy: () => {
      busy = true;
    },
  };
}
describe('verificações de atualização', () => {
  it('consulta aplicativos e launcher juntos e agrupa chamadas simultâneas', async () => {
    const f = fixture();
    const first = f.checker.check();
    expect(f.checker.check(true)).toBe(first);
    expect((await first).launcher?.version).toBe('0.3.0');
    expect(f.refresh).toHaveBeenCalledTimes(1);
    await f.checker.check();
    expect(f.refresh).toHaveBeenCalledTimes(1);
    f.tick();
    await f.checker.check();
    expect(f.refresh).toHaveBeenCalledTimes(2);
  });
  it('preserva o resultado do catálogo quando só a consulta do launcher falha', async () => {
    const f = fixture();
    f.checkLauncher.mockRejectedValueOnce(new Error('HTTP 503'));
    const result = await f.checker.check();
    expect(result.snapshot).toBe(f.snapshot);
    expect(result.errors).toHaveLength(1);
    f.tick();
    expect((await f.checker.check()).errors).toEqual([]);
  });
  it('não consulta em preview, offline, durante downloads ou com a opção desligada', async () => {
    for (const condition of ['preview', 'offline', 'download', 'disabled', 'busy']) {
      const f = fixture();
      if (condition === 'preview') f.snapshot.native = false;
      if (condition === 'offline') f.offline();
      if (condition === 'download') f.snapshot.jobs = [{ phase: 'installing' }] as Snapshot['jobs'];
      if (condition === 'disabled') f.snapshot.settings.checkOnStart = false;
      if (condition === 'busy') f.busy();
      await f.checker.check();
      expect(f.refresh).not.toHaveBeenCalled();
      expect(f.checkLauncher).not.toHaveBeenCalled();
    }
  });
  it('permite consulta manual com a opção automática desligada e reporta impedimentos', async () => {
    const f = fixture();
    f.snapshot.settings.checkOnStart = false;
    await f.checker.check(true);
    expect(f.refresh).toHaveBeenCalledTimes(1);
    f.snapshot.jobs = [{ phase: 'downloading' }] as Snapshot['jobs'];
    await expect(f.checker.check(true)).rejects.toThrow('downloads');
    f.offline();
    await expect(f.checker.check(true)).rejects.toThrow('Sem conexão');
  });
});

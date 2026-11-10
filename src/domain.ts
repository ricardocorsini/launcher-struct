import { compare, gte, gt, valid } from 'semver';
import type { Job, Product, Release, Snapshot } from './types';

export const active = (phase: string) =>
  ['queued', 'downloading', 'verifying', 'installing'].includes(phase);
export const phaseForApp = (snapshot: Snapshot, id: string): Job | undefined =>
  snapshot.jobs.find((j) => j.appId === id && active(j.phase));
export function compatibleReleases(app: Product, snapshot: Snapshot): Release[] {
  return app.releases
    .filter(
      (release) =>
        valid(release.version) &&
        (snapshot.settings.channel === 'beta' || release.channel === 'stable') &&
        release.assets.some(
          (asset) =>
            asset.platform === snapshot.platform &&
            asset.arch === snapshot.arch &&
            valid(asset.minLauncherVersion) &&
            gte(snapshot.launcherVersion, asset.minLauncherVersion),
        ),
    )
    .sort((a, b) => compare(b.version, a.version));
}
export const latestRelease = (app: Product, snapshot: Snapshot) =>
  compatibleReleases(app, snapshot)[0];
export function needsUpdate(app: Product, snapshot: Snapshot): boolean {
  const item = snapshot.inventory[app.id];
  const latest = latestRelease(app, snapshot);
  return Boolean(
    item &&
    item.present &&
    !item.modified &&
    latest &&
    valid(item.version) &&
    gt(latest.version, item.version),
  );
}
export function appStatus(
  app: Product,
  snapshot: Snapshot,
): 'busy' | 'repair' | 'update' | 'installed' | 'available' | 'unpublished' | 'unsupported' {
  if (phaseForApp(snapshot, app.id)) return 'busy';
  const item = snapshot.inventory[app.id];
  if (item && (!item.present || item.modified)) return 'repair';
  if (needsUpdate(app, snapshot)) return 'update';
  if (item?.present) return 'installed';
  if (latestRelease(app, snapshot)) return 'available';
  return app.releases.length ? 'unsupported' : 'unpublished';
}
export function filterApps(
  snapshot: Snapshot,
  page: string,
  query: string,
  category: string,
  sort: string,
  showHidden = false,
): Product[] {
  const q = query
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return snapshot.catalog.apps
    .filter(
      (app) =>
        (showHidden || page === 'updates' || !snapshot.settings.hiddenApps.includes(app.id)) &&
        (page !== 'installed' || Boolean(snapshot.inventory[app.id])) &&
        (page !== 'updates' || needsUpdate(app, snapshot)) &&
        (category === 'all' || app.category === category) &&
        `${app.name} ${app.summary} ${app.category}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) =>
      sort === 'recent'
        ? (latestRelease(b, snapshot)?.publishedAt ?? '').localeCompare(
            latestRelease(a, snapshot)?.publishedAt ?? '',
          ) || a.name.localeCompare(b.name)
        : sort === 'za'
          ? b.name.localeCompare(a.name)
          : a.name.localeCompare(b.name),
    );
}
export function bytes(value: number, locale = 'pt-BR'): string {
  if (!value) return '0 B';
  const power = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)));
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1024 ** power)} ${['B', 'KB', 'MB', 'GB'][power]}`;
}
export function percentage(job: Job): number {
  return job.total ? Math.max(0, Math.min(100, Math.round((job.received / job.total) * 100))) : 0;
}
// Keep the catalog's legacy icon enum compatible with installed launchers.
export const iconPath = (app: Product) => {
  if (app.id === 'geosptstruct') return '/assets/geosptstruct-athena.webp';
  if (app.id === 'armadurastruct') return '/assets/armadurastruct-hephaestus.webp';
  return `/assets/${['consolostruct-atlas', 'molastruct-gaia'].includes(app.icon) ? `${app.icon}.webp` : 'openstruct-mark.svg'}`;
};

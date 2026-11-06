import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Github,
  Info,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { appStatus, bytes, compatibleReleases, latestRelease, phaseForApp } from '../domain';
import { CloseButton, Dialog, ProductIcon } from './Primitives';
import type { Message } from '../i18n';
import type { Product, Snapshot } from '../types';

export default function ProductDetail({
  app,
  snapshot,
  initialTab,
  t,
  onClose,
  onInstall,
  onPrimary,
  onLink,
  busy,
}: {
  app: Product;
  snapshot: Snapshot;
  initialTab: 'about' | 'versions';
  t: (key: Message) => string;
  onClose: () => void;
  onInstall: (app: Product, version: string) => void;
  onPrimary: (app: Product) => void;
  onLink: (kind: 'website' | 'repository' | 'documentation') => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState(initialTab);
  const releases = compatibleReleases(app, snapshot);
  const latest = latestRelease(app, snapshot);
  const status = appStatus(app, snapshot);
  const installed = snapshot.inventory[app.id];
  const phase = phaseForApp(snapshot, app.id);
  const primaryLabel = phase
    ? t(phase.phase as Message)
    : status === 'installed'
      ? t('open')
      : status === 'update'
        ? t('update')
        : status === 'repair'
          ? t('reinstall')
          : t('install');
  return (
    <Dialog title={app.name} onClose={onClose} className="product-dialog">
      <div className="detail-header" style={{ '--product': app.color } as React.CSSProperties}>
        <CloseButton label={t('close')} onClick={onClose} />
        <div className="eyebrow">OPENSTRUCT / {app.category}</div>
        <div className="detail-identity">
          <ProductIcon app={app} large />
          <div>
            <h1>{app.name}</h1>
            <p>{app.tagline}</p>
            <span className="mono">
              {latest
                ? `v${latest.version} · ${snapshot.platform} ${snapshot.arch}`
                : t('development')}
            </span>
          </div>
        </div>
        <div className="detail-links">
          <button onClick={() => onLink('repository')}>
            <Github size={16} />
            {t('github')}
            <ArrowUpRight size={14} />
          </button>
          <button onClick={() => onLink('documentation')}>
            {t('documentation')}
            <ArrowUpRight size={14} />
          </button>
          <button onClick={() => onLink('website')}>
            {t('site')}
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
      <div className="detail-tabs" role="tablist" aria-label={app.name}>
        <button
          role="tab"
          aria-selected={tab === 'about'}
          aria-controls="product-about"
          id="tab-about"
          tabIndex={tab === 'about' ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              setTab('versions');
              document.getElementById('tab-versions')?.focus();
            }
          }}
          onClick={() => setTab('about')}
        >
          {t('details')}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'versions'}
          aria-controls="product-versions"
          id="tab-versions"
          tabIndex={tab === 'versions' ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              setTab('about');
              document.getElementById('tab-about')?.focus();
            }
          }}
          onClick={() => setTab('versions')}
        >
          {t('versions')}
          {releases.length ? <span>{releases.length}</span> : null}
        </button>
      </div>
      {tab === 'about' ? (
        <div className="detail-body" role="tabpanel" id="product-about" aria-labelledby="tab-about">
          <p className="detail-description">{app.description}</p>
          <h2>{t('features')}</h2>
          <div className="features">
            {app.features.map((feature, index) => (
              <div key={feature}>
                <span className="mono">0{index + 1}</span>
                <p>{feature}</p>
                <Check size={16} />
              </div>
            ))}
          </div>
          <div className="detail-requirements">
            <Layers size={20} />
            <div>
              <h3>{t('requirements')}</h3>
              <p>{app.requirements}</p>
            </div>
          </div>
          <div className="product-notice">
            <Info size={17} />
            <p>{app.notice}</p>
          </div>
        </div>
      ) : (
        <div
          className="detail-body"
          role="tabpanel"
          id="product-versions"
          aria-labelledby="tab-versions"
        >
          {releases.length ? (
            releases.map((release) => (
              <div className="release-row" key={release.version}>
                <div>
                  <h3 className="mono">
                    v{release.version}
                    {release.channel === 'beta' ? <span className="badge">BETA</span> : null}
                  </h3>
                  <time>
                    {new Date(release.publishedAt).toLocaleDateString(snapshot.settings.language)}
                  </time>
                  <p className="release-notes">{release.notes}</p>
                </div>
                <button
                  className="button button-secondary"
                  disabled={!snapshot.native || busy || Boolean(phase)}
                  onClick={() => onInstall(app, release.version)}
                >
                  <ArrowDownToLine size={16} />
                  {t('install')}
                </button>
              </div>
            ))
          ) : (
            <div className="unpublished-detail">
              <ShieldCheck size={36} />
              <h3>{t('preparing')}</h3>
              <p>{t('noVersions')}</p>
            </div>
          )}
        </div>
      )}
      <footer className="detail-footer">
        <div>
          <span className="mono">{installed ? t('installedVersion') : t('latestVersion')}</span>
          <strong>{installed?.version ?? latest?.version ?? '—'}</strong>
          {latest ? (
            <small>
              {bytes(
                latest.assets.find(
                  (a) => a.platform === snapshot.platform && a.arch === snapshot.arch,
                )?.size ?? 0,
              )}
            </small>
          ) : null}
        </div>
        {latest || installed?.present ? (
          <button
            className="button button-primary"
            disabled={!snapshot.native || busy || Boolean(phase)}
            onClick={() => onPrimary(app)}
          >
            {primaryLabel}
            <ArrowUpRight size={16} />
          </button>
        ) : (
          <span className="status status-unpublished">
            <span className="status-dot" />
            {app.releases.length ? t('noPackageForVersion') : t('development')}
          </span>
        )}
      </footer>
    </Dialog>
  );
}

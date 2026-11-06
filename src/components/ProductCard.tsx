import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  Download,
  Ellipsis,
  ExternalLink,
  FolderOpen,
  Github,
  Play,
  RefreshCw,
  Trash2,
  EyeOff,
  History,
} from 'lucide-react';
import { appStatus, bytes, latestRelease, percentage, phaseForApp } from '../domain';
import { ProductIcon } from './Primitives';
import type { Message } from '../i18n';
import type { Product, Snapshot } from '../types';

export interface ProductActions {
  details: (app: Product, tab?: 'about' | 'versions') => void;
  primary: (app: Product) => void;
  link: (app: Product, kind: 'repository' | 'website' | 'documentation') => void;
  folder: (app: Product) => void;
  hide: (app: Product) => void;
  uninstall: (app: Product) => void;
}
const statusKeys: Record<string, Message> = {
  repair: 'repair',
  update: 'updateAvailable',
  installed: 'installedStatus',
  available: 'available',
  unpublished: 'development',
  unsupported: 'unsupported',
};

export function ProductCard({
  app,
  snapshot,
  t,
  actions,
  list,
  busy,
}: {
  app: Product;
  snapshot: Snapshot;
  t: (key: Message) => string;
  actions: ProductActions;
  list: boolean;
  busy: boolean;
}) {
  const status = appStatus(app, snapshot);
  const latest = latestRelease(app, snapshot);
  const installed = snapshot.inventory[app.id];
  const job = phaseForApp(snapshot, app.id);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && menu.current) menu.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const menuAction = (action: () => void) => {
    if (menu.current) menu.current.open = false;
    action();
  };
  const text = job
    ? t(job.phase as Message)
    : status === 'installed'
      ? t('open')
      : status === 'update'
        ? t('update')
        : status === 'available'
          ? t('install')
          : status === 'repair' && latest
            ? t('reinstall')
            : t('details');
  const ButtonIcon =
    status === 'installed'
      ? Play
      : status === 'update' || status === 'repair'
        ? RefreshCw
        : status === 'available'
          ? Download
          : ArrowRight;
  return (
    <article
      className={`product-card ${list ? 'is-list' : ''}`}
      style={{ '--product': app.color } as React.CSSProperties}
    >
      <div className="card-topline">
        <span>{app.category}</span>
        <button
          className="repository-link"
          aria-label={`${t('github')} ${app.name}`}
          title={t('github')}
          onClick={() => actions.link(app, 'repository')}
        >
          <Github size={16} />
          <ExternalLink size={11} />
        </button>
      </div>
      <div className="card-identity">
        <button
          className="product-open"
          onClick={() => actions.details(app)}
          aria-label={`${t('details')}: ${app.name}`}
        >
          <ProductIcon app={app} />
        </button>
        <div>
          <button className="product-title" onClick={() => actions.details(app)}>
            {app.name}
          </button>
          <p className="product-tagline">{app.tagline}</p>
        </div>
      </div>
      <p className="product-summary">{app.summary}</p>
      <div className="card-status">
        <span className={`status status-${status}`}>
          <span className="status-dot" />
          {job ? t(job.phase as Message) : t(statusKeys[status] ?? 'development')}
        </span>
        {latest ? (
          <span className="version mono">
            {installed ? `${installed.version} → ` : ''}
            {latest.version}
          </span>
        ) : null}
      </div>
      {job ? (
        <div
          className="card-progress"
          role="progressbar"
          aria-label={`${t('downloads')} ${app.name}`}
          aria-valuenow={percentage(job)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${percentage(job)}%` }} />
        </div>
      ) : null}
      <div className="card-actions">
        <button
          className={`button ${status === 'installed' ? 'button-primary' : 'button-product'}`}
          onClick={() => actions.primary(app)}
          disabled={busy || Boolean(job)}
        >
          <ButtonIcon size={16} aria-hidden="true" />
          <span>{text}</span>
          {latest && !installed && !job ? (
            <small>
              {bytes(
                latest.assets.find(
                  (a) => a.platform === snapshot.platform && a.arch === snapshot.arch,
                )?.size ?? 0,
              )}
            </small>
          ) : null}
          {!latest && !installed ? (
            <ArrowRight className="button-tail" size={16} aria-hidden="true" />
          ) : null}
        </button>
        <details
          className="product-menu"
          ref={menu}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && menu.current) {
              menu.current.open = false;
              menu.current.querySelector('summary')?.focus();
            }
          }}
        >
          <summary className="icon-button" aria-label={`${t('menu')}: ${app.name}`}>
            <Ellipsis size={20} />
          </summary>
          <div className="menu-popover">
            <button onClick={() => menuAction(() => actions.details(app, 'versions'))}>
              <History size={16} />
              {t('chooseVersion')}
            </button>
            <button onClick={() => menuAction(() => actions.link(app, 'documentation'))}>
              <ExternalLink size={16} />
              {t('documentation')}
            </button>
            {installed ? (
              <>
                <button onClick={() => menuAction(() => actions.folder(app))}>
                  <FolderOpen size={16} />
                  {t('folder')}
                </button>
                <button
                  className="danger-text"
                  disabled={Boolean(job)}
                  onClick={() => menuAction(() => actions.uninstall(app))}
                >
                  <Trash2 size={16} />
                  {t('uninstall')}
                </button>
              </>
            ) : null}
            <button onClick={() => menuAction(() => actions.hide(app))}>
              <EyeOff size={16} />
              {t('hide')}
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}

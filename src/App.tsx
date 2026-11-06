import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Box,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  Command,
  Download,
  Github,
  Grid2X2,
  HardDrive,
  Layers3,
  List,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { bridge } from './bridge';
import { active, appStatus, filterApps, latestRelease, needsUpdate, phaseForApp } from './domain';
import { translator } from './i18n';
import { ProductCard } from './components/ProductCard';
import { CloseButton, Dialog, EmptyState } from './components/Primitives';
import type { ProductActions } from './components/ProductCard';
import type { Job, LauncherUpdate, Page, Product, Settings, Snapshot } from './types';
import { lt } from 'semver';

const ProductDetail = lazy(() => import('./components/ProductDetail'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const Downloads = lazy(() => import('./components/Downloads'));
type Confirmation =
  | { kind: 'uninstall'; app: Product }
  | { kind: 'downgrade'; app: Product; version: string }
  | { kind: 'close' };

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [boot, setBoot] = useState(0);
  const [page, setPage] = useState<Page>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('az');
  const [layout, setLayout] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('struct-launcher-layout') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [detail, setDetail] = useState<{ id: string; tab: 'about' | 'versions' } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [toast, setToast] = useState<{ message: string; error: boolean; id: number } | null>(null);
  const [launcherUpdate, setLauncherUpdate] = useState<LauncherUpdate | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const catalog = useRef<HTMLDivElement>(null);
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const t = translator(snapshot?.settings.language ?? 'pt-BR');
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error, id: Date.now() }),
    [],
  );
  const onError = useCallback(
    (error: unknown) => notify(error instanceof Error ? error.message : String(error), true),
    [notify],
  );
  const accept = useCallback(
    (next: Snapshot) =>
      setSnapshot((previous) =>
        !previous || next.revision >= previous.revision ? next : previous,
      ),
    [],
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;
    const start = async () => {
      unlisten = await bridge.subscribe((next) => {
        if (!disposed) accept(next);
      });
      unlistenClose = await bridge.onCloseRequest(() => {
        if (!disposed) setConfirmation({ kind: 'close' });
      });
      if (disposed) {
        unlisten();
        unlistenClose();
        return;
      }
      const next = await bridge.snapshot();
      if (disposed) return;
      accept(next);
      setBootError(null);
      if (next.native && next.settings.checkOnStart && next.settings.catalogUrl) {
        try {
          const refreshed = await bridge.refresh();
          if (!disposed) accept(refreshed);
        } catch (error) {
          if (!disposed) onError(error);
        }
      }
    };
    void start().catch((error) => {
      if (!disposed) setBootError(String(error));
    });
    return () => {
      disposed = true;
      unlisten?.();
      unlistenClose?.();
    };
  }, [boot, accept, onError]);

  useEffect(() => {
    const theme = snapshot?.settings.theme ?? 'light';
    if (snapshot?.native) {
      try {
        localStorage.setItem('struct-launcher-native-theme', theme);
      } catch {
        /* optional mirror for startup */
      }
    }
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'dark' || (theme === 'system' && media.matches) ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [snapshot?.settings.theme]);
  useEffect(() => {
    document.documentElement.lang = snapshot?.settings.language ?? 'pt-BR';
  }, [snapshot?.settings.language]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.error ? 12000 : 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !detail && !confirmation) {
        e.preventDefault();
        setPage('all');
        requestAnimationFrame(() => search.current?.focus());
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [detail, confirmation]);

  const run = async (key: string, operation: () => Promise<unknown>, success?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(key);
    try {
      await operation();
      accept(await bridge.snapshot());
      if (success) notify(success);
    } catch (error) {
      onError(error);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };
  const choosePage = (next: Page) => {
    setPage(next);
    setQuery('');
    setCategory('all');
  };
  const setView = (next: 'grid' | 'list') => {
    setLayout(next);
    try {
      localStorage.setItem('struct-launcher-layout', next);
    } catch {
      /* preference is optional */
    }
  };
  const install = (app: Product, version: string, confirmed = false) => {
    const item = latest.current?.inventory[app.id];
    if (item && lt(version, item.version) && !confirmed) {
      setConfirmation({ kind: 'downgrade', app, version });
      return;
    }
    void run(`install-${app.id}`, () => bridge.install(app.id, version, confirmed));
  };
  const primary = (app: Product) => {
    if (!snapshot) return;
    const status = appStatus(app, snapshot);
    const release = latestRelease(app, snapshot);
    if (status === 'installed') {
      void run(`launch-${app.id}`, () => bridge.launch(app.id));
    } else if (release && ['available', 'update', 'repair'].includes(status))
      install(app, release.version);
    else setDetail({ id: app.id, tab: 'about' });
  };
  const actions: ProductActions = {
    details: (app, tab = 'about') => setDetail({ id: app.id, tab }),
    primary,
    link: (app, kind) => {
      void bridge.openLink(app.id, kind).catch(onError);
    },
    folder: (app) => {
      void bridge.openFolder(app.id).catch(onError);
    },
    hide: (app) => {
      if (snapshot)
        void run('hide', () =>
          bridge.saveSettings({
            ...snapshot.settings,
            hiddenApps: [...new Set([...snapshot.settings.hiddenApps, app.id])],
          }),
        );
    },
    uninstall: (app) => setConfirmation({ kind: 'uninstall', app }),
  };

  if (!snapshot)
    return (
      <div className="boot-screen">
        <img src="/assets/openstruct-mark.svg" alt="OpenStruct" />
        {bootError ? (
          <>
            <h1>{t('errorTitle')}</h1>
            <p role="alert">{bootError}</p>
            <button className="button button-primary" onClick={() => setBoot((v) => v + 1)}>
              {t('reload')}
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" size={24} />
            <p>Struct Launcher</p>
          </>
        )}
      </div>
    );

  const activeJobs = snapshot.jobs.filter((j) => active(j.phase));
  const updates = snapshot.catalog.apps.filter((app) => needsUpdate(app, snapshot));
  const installedCount = Object.keys(snapshot.inventory).length;
  const products = filterApps(snapshot, page, query, category, sort);
  const detailApp = snapshot.catalog.apps.find((app) => app.id === detail?.id);
  const allUnpublished = snapshot.catalog.apps.every((app) => !app.releases.length);
  const refresh = () => {
    void run(
      'refresh',
      async () => {
        const refreshed = await bridge.refresh();
        accept(refreshed);
      },
      snapshot.settings.catalogUrl ? t('refreshed') : t('refreshLocal'),
    );
  };
  const retry = (job: Job) => {
    const app = snapshot.catalog.apps.find((a) => a.id === job.appId);
    if (app) install(app, job.version);
  };
  const confirm = () => {
    const current = confirmation;
    if (!current) return;
    if (current.kind === 'uninstall')
      void run(`uninstall-${current.app.id}`, () => bridge.uninstall(current.app.id));
    else if (current.kind === 'downgrade') install(current.app, current.version, true);
    else if (activeJobs.some((j) => j.phase === 'installing')) {
      notify(t('waitingInstall'), true);
      setConfirmation(null);
      return;
    } else void run('quit', () => bridge.quit());
    setConfirmation(null);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('library')}
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => choosePage('all')}
          aria-label="OpenStruct · Struct Launcher"
        >
          <img src="/assets/openstruct-mark.svg" alt="" />
          <span>
            <strong>OPENSTRUCT</strong>
            <small className="mono">STRUCT LAUNCHER</small>
          </span>
        </button>
        <div className="sidebar-section mono">{t('library')}</div>
        <nav aria-label={t('library')}>
          {(
            [
              { id: 'all', icon: Grid2X2, count: snapshot.catalog.apps.length },
              { id: 'installed', icon: HardDrive, count: installedCount },
              { id: 'updates', icon: RefreshCw, count: updates.length },
              { id: 'downloads', icon: ArrowDownToLine, count: activeJobs.length },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'selected' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => choosePage(item.id)}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{t(item.id)}</span>
              {item.count ? <span className="nav-count mono">{item.count}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="open-source-card">
            <Boxes size={24} strokeWidth={1.3} />
            <p>{t('openSource')}</p>
            <button onClick={() => void bridge.projectLink('repository').catch(onError)}>
              {t('github')}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'selected' : ''}`}
            aria-current={page === 'settings' ? 'page' : undefined}
            onClick={() => choosePage('settings')}
          >
            <Settings2 size={18} />
            {t('settings')}
          </button>
          <button
            className="nav-item muted"
            onClick={() => void bridge.projectLink('help').catch(onError)}
          >
            <BookOpen size={18} />
            {t('help')}
          </button>
          <span className="sidebar-version mono">
            STRUCT LAUNCHER <b>v{snapshot.launcherVersion}</b>
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="breadcrumb-symbol">/</span>
            <span>Struct Launcher</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{t(page)}</strong>
          </div>
          <div className="topbar-actions">
            <span className="native-label mono">{snapshot.native ? 'DESKTOP' : t('preview')}</span>
            <button
              className="icon-button"
              title={t('refresh')}
              aria-label={t('refresh')}
              onClick={refresh}
              disabled={Boolean(busy)}
            >
              <RefreshCw size={17} className={busy === 'refresh' ? 'spin' : ''} />
            </button>
            <button
              className="icon-button notification-button"
              title={t('updates')}
              aria-label={t('updates')}
              onClick={() => choosePage('updates')}
            >
              <Bell size={18} />
              {updates.length ? <i /> : null}
            </button>
          </div>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          {!snapshot.native ? (
            <div className="preview-banner">
              <MonitorIcon />
              <span>
                <strong>{t('preview')}</strong> · {t('previewText')}
              </span>
            </div>
          ) : null}
          {snapshot.warnings.map((warning) => (
            <div className="warning-banner" role="status" key={warning}>
              <CircleAlert size={17} />
              <span>{warning}</span>
            </div>
          ))}
          <Suspense
            fallback={
              <div className="section-loading">
                <LoaderCircle className="spin" size={24} />
              </div>
            }
          >
            {page === 'settings' ? (
              <SettingsView
                snapshot={snapshot}
                t={t}
                onSave={(settings: Settings) => {
                  void run('settings', () => bridge.saveSettings(settings), t('saved'));
                }}
                onError={onError}
                busy={Boolean(busy)}
                update={launcherUpdate}
                onCheckLauncher={() => {
                  void run('check-launcher', async () =>
                    setLauncherUpdate(await bridge.checkLauncher()),
                  );
                }}
                onUpdateLauncher={() => {
                  if (launcherUpdate?.version)
                    void run('update-launcher', () =>
                      bridge.updateLauncher(launcherUpdate.version!),
                    );
                }}
              />
            ) : page === 'downloads' ? (
              <Downloads
                snapshot={snapshot}
                t={t}
                onCancel={(job) => {
                  void run('cancel', () => bridge.cancel(job.id));
                }}
                onRetry={retry}
                onClear={() => void run('clear', () => bridge.clearHistory())}
                busy={Boolean(busy)}
              />
            ) : (
              <>
                {page === 'all' ? (
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="eyebrow">
                        <span />
                        {t('ecosystem')}
                      </span>
                      <h1 aria-label={t('heroTitle').replace('\n', ' ')}>
                        {t('heroTitle')
                          .split('\n')
                          .map((line, index) => (
                            <span key={line} className={index ? 'hero-line-accent' : ''}>
                              {line}
                            </span>
                          ))}
                      </h1>
                      <p>{t('heroText')}</p>
                      <div className="hero-actions">
                        <button
                          className="button button-primary"
                          onClick={() =>
                            catalog.current?.scrollIntoView({
                              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                                ? 'instant'
                                : 'smooth',
                              block: 'start',
                            })
                          }
                        >
                          {t('explore')}
                          <ArrowRight size={16} />
                        </button>
                        <button
                          className="hero-link"
                          onClick={() => void bridge.projectLink('website').catch(onError)}
                        >
                          {t('learnOpen')}
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="art-orbit orbit-one" />
                      <div className="art-orbit orbit-two" />
                      <div className="art-axis axis-one" />
                      <div className="art-axis axis-two" />
                      <div className="art-blueprint">
                        <svg viewBox="0 0 300 260">
                          <g fill="none" stroke="currentColor" strokeWidth=".8">
                            <path d="m45 164 89-52 122 70-89 52Z M45 152l89-52 122 70-89 52Z M45 152v12m211 6v12m-89 40v12M134 100v12 M121 104V46l31-18 31 18v88m-62-88 31 18 31-18m-31 18v88 M74 170v50m154-27v38m-154-8 154 15 M104 116 27 72m84 30L34 58" />
                            <path strokeDasharray="3 4" d="m22 151 112-65 144 83M152 19v194" />
                          </g>
                        </svg>
                      </div>
                      <img
                        className="hero-app hero-app-orange"
                        src="/assets/consolostruct-atlas.webp"
                        alt=""
                      />
                      <img
                        className="hero-app hero-app-blue"
                        src="/assets/molastruct-gaia.webp"
                        alt=""
                      />
                      <span className="art-label mono">
                        ABERTO PARA
                        <br />
                        CONSTRUIR.
                      </span>
                      <Sparkles className="art-spark" size={24} strokeWidth={1} />
                    </div>
                    <div className="hero-footer mono">
                      <span>
                        <ShieldCheck size={14} />
                        OPEN SOURCE
                      </span>
                      <span>WINDOWS & LINUX</span>
                      <span>
                        FEITO PARA ENGENHARIA <ArrowUpRight size={13} />
                      </span>
                    </div>
                  </section>
                ) : (
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">OPENSTRUCT / {t('library')}</span>
                      <h1>{t(page)}</h1>
                      <p>{page === 'installed' ? t('noInstalledText') : t('noUpdatesText')}</p>
                    </div>
                    {page === 'updates' && updates.length ? (
                      <button
                        className="button button-primary"
                        disabled={Boolean(busy)}
                        onClick={() => {
                          void run('update-all', async () => {
                            const failures: string[] = [];
                            for (const app of updates) {
                              const release = latestRelease(app, snapshot);
                              if (release && !phaseForApp(snapshot, app.id))
                                try {
                                  await bridge.install(app.id, release.version);
                                } catch (error) {
                                  failures.push(`${app.name}: ${String(error)}`);
                                }
                            }
                            if (failures.length) throw new Error(failures.join('\n'));
                          });
                        }}
                      >
                        <RefreshCw size={16} />
                        {t('updateAll')} ({updates.length})
                      </button>
                    ) : null}
                  </div>
                )}
                <div ref={catalog} className="catalog-anchor">
                  <div className="catalog-heading">
                    <div>
                      <h2>
                        {page === 'all' ? t('apps') : t(page)}
                        <span className="mono">{products.length.toString().padStart(2, '0')}</span>
                      </h2>
                      {page === 'all' ? (
                        <p>
                          {snapshot.catalog.apps.length} {t('appCount')}
                        </p>
                      ) : null}
                    </div>
                    <div className="view-switch" role="group" aria-label={t('library')}>
                      <button
                        aria-label={t('grid')}
                        title={t('grid')}
                        aria-pressed={layout === 'grid'}
                        onClick={() => setView('grid')}
                      >
                        <Grid2X2 size={16} />
                      </button>
                      <button
                        aria-label={t('list')}
                        title={t('list')}
                        aria-pressed={layout === 'list'}
                        onClick={() => setView('list')}
                      >
                        <List size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="catalog-toolbar">
                    <div className="search-field">
                      <Search size={17} aria-hidden="true" />
                      <input
                        ref={search}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('search')}
                        aria-label={t('searchLabel')}
                      />
                      {query ? (
                        <button
                          className="icon-button"
                          aria-label={t('resetSearch')}
                          onClick={() => {
                            setQuery('');
                            search.current?.focus();
                          }}
                        >
                          <X size={15} />
                        </button>
                      ) : (
                        <kbd>
                          <Command size={11} /> K
                        </kbd>
                      )}
                    </div>
                    <div className="select-field">
                      <select
                        aria-label={t('allCategories')}
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                      >
                        <option value="all">{t('allCategories')}</option>
                        {[...new Set(snapshot.catalog.apps.map((a) => a.category))].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                    <div className="select-field sort-select">
                      <select
                        aria-label={t('sort')}
                        value={sort}
                        onChange={(event) => setSort(event.target.value)}
                      >
                        <option value="az">{t('az')}</option>
                        <option value="za">{t('za')}</option>
                        <option value="recent">{t('recent')}</option>
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                  {products.length ? (
                    <div className={`products ${layout === 'list' ? 'list-layout' : ''}`}>
                      {products.map((app) => (
                        <ProductCard
                          key={app.id}
                          app={app}
                          snapshot={snapshot}
                          t={t}
                          actions={actions}
                          list={layout === 'list'}
                          busy={Boolean(busy)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={
                        page === 'updates' ? (
                          <Check size={30} />
                        ) : page === 'installed' ? (
                          <Box size={30} />
                        ) : (
                          <Search size={30} />
                        )
                      }
                      title={t(
                        query || category !== 'all'
                          ? 'noResults'
                          : page === 'installed'
                            ? 'noInstalled'
                            : page === 'updates'
                              ? 'noUpdates'
                              : 'noResults',
                      )}
                      text={t(
                        query || category !== 'all'
                          ? 'noResultsText'
                          : page === 'installed'
                            ? 'noInstalledText'
                            : page === 'updates'
                              ? 'noUpdatesText'
                              : 'noResultsText',
                      )}
                    >
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          setQuery('');
                          setCategory('all');
                          if (page !== 'all') choosePage('all');
                        }}
                      >
                        {t(query || category !== 'all' ? 'clearFilters' : 'browse')}
                      </button>
                    </EmptyState>
                  )}
                  {page === 'all' && allUnpublished ? (
                    <div className="release-preparing">
                      <span className="preparing-icon">
                        <Layers3 size={24} strokeWidth={1.3} />
                      </span>
                      <div>
                        <strong>{t('preparing')}</strong>
                        <p>{t('preparingText')}</p>
                      </div>
                      <span className="mono">
                        EM BREVE <ArrowUpRight size={14} />
                      </span>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </Suspense>
          <footer className="workspace-footer">
            <span className="footer-source">
              <i className={snapshot.catalogSource} />
              <span>
                {t(
                  snapshot.catalogSource === 'remote'
                    ? 'online'
                    : snapshot.catalogSource === 'cache'
                      ? 'offline'
                      : 'bundled',
                )}
              </span>
              {snapshot.checkedAt ? (
                <time className="mono">
                  {new Date(snapshot.checkedAt).toLocaleTimeString(snapshot.settings.language, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              ) : null}
            </span>
            <button onClick={() => void bridge.projectLink('repository').catch(onError)}>
              <Github size={15} />
              <span>Construído em comunidade</span>
              <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      {toast ? (
        <aside
          className={`toast ${toast.error ? 'is-error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <CircleAlert size={20} /> : <Check size={20} />}
          <span>{toast.message}</span>
          <button className="icon-button" aria-label={t('close')} onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </aside>
      ) : null}
      {detail && detailApp ? (
        <Suspense fallback={null}>
          <ProductDetail
            key={`${detail.id}-${detail.tab}`}
            app={detailApp}
            snapshot={snapshot}
            initialTab={detail.tab}
            t={t}
            onClose={() => setDetail(null)}
            onInstall={install}
            onPrimary={primary}
            onLink={(kind) => actions.link(detailApp, kind)}
            busy={Boolean(busy)}
          />
        </Suspense>
      ) : null}
      {confirmation ? (
        <Dialog
          title={t(
            confirmation.kind === 'uninstall'
              ? 'uninstallTitle'
              : confirmation.kind === 'downgrade'
                ? 'downgradeTitle'
                : 'closeTitle',
          )}
          onClose={() => setConfirmation(null)}
          className="confirm-dialog"
        >
          <CloseButton label={t('close')} onClick={() => setConfirmation(null)} />
          <div className="confirm-symbol">
            <CircleAlert size={28} />
          </div>
          <h2>
            {t(
              confirmation.kind === 'uninstall'
                ? 'uninstallTitle'
                : confirmation.kind === 'downgrade'
                  ? 'downgradeTitle'
                  : 'closeTitle',
            )}
          </h2>
          {confirmation.kind !== 'close' ? (
            <strong>
              {confirmation.app.name}
              {confirmation.kind === 'downgrade' ? ` · v${confirmation.version}` : ''}
            </strong>
          ) : null}
          <p>
            {t(
              confirmation.kind === 'uninstall'
                ? 'uninstallText'
                : confirmation.kind === 'downgrade'
                  ? 'downgradeText'
                  : activeJobs.some((j) => j.phase === 'installing')
                    ? 'waitingInstall'
                    : 'closeText',
            )}
          </p>
          <div className="confirm-actions">
            <button className="button button-secondary" onClick={() => setConfirmation(null)}>
              {t('cancel')}
            </button>
            <button
              className={`button ${confirmation.kind === 'uninstall' ? 'button-danger' : 'button-primary'}`}
              disabled={
                Boolean(busy) ||
                (confirmation.kind === 'close' && activeJobs.some((j) => j.phase === 'installing'))
              }
              onClick={confirm}
            >
              {t(
                confirmation.kind === 'uninstall'
                  ? 'uninstall'
                  : confirmation.kind === 'downgrade'
                    ? 'confirmInstall'
                    : 'exit',
              )}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function MonitorIcon() {
  return <Download size={16} aria-hidden="true" />;
}

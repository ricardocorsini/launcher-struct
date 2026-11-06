import { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  FolderOpen,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { bridge } from '../bridge';
import { External } from './Primitives';
import type { Message } from '../i18n';
import type { LauncherUpdate, Settings, Snapshot, Theme } from '../types';

export default function SettingsView({
  snapshot,
  t,
  onSave,
  onError,
  onCheckLauncher,
  update,
  onUpdateLauncher,
  busy,
}: {
  snapshot: Snapshot;
  t: (key: Message) => string;
  onSave: (settings: Settings) => void;
  onError: (error: unknown) => void;
  onCheckLauncher: () => void;
  update: LauncherUpdate | null;
  onUpdateLauncher: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(snapshot.settings);
  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const chooseFolder = async () => {
    try {
      const folder = await bridge.pickFolder();
      if (folder)
        patch('installRoot', `${folder}${folder.includes('\\') ? '\\' : '/'}OpenStructApps`);
    } catch (error) {
      onError(error);
    }
  };
  return (
    <section className="settings-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">STRUCT LAUNCHER / {t('settings')}</span>
          <h1>{t('general')}</h1>
          <p>{t('generalText')}</p>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <div className="settings-grid">
          <section className="setting-panel">
            <h2>{t('theme')}</h2>
            <div className="theme-options">
              {(['light', 'dark', 'system'] as Theme[]).map((theme) => {
                const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
                return (
                  <button
                    type="button"
                    key={theme}
                    className={draft.theme === theme ? 'selected' : ''}
                    aria-pressed={draft.theme === theme}
                    onClick={() => patch('theme', theme)}
                  >
                    <span className={`theme-preview theme-${theme}`}>
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>
                      <Icon size={15} />
                      {t(theme)}
                      {draft.theme === theme ? <Check size={15} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="field-label" htmlFor="language">
              {t('language')}
            </label>
            <select
              id="language"
              value={draft.language}
              onChange={(e) => patch('language', e.target.value as Settings['language'])}
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en">English</option>
            </select>
          </section>
          <section className="setting-panel">
            <h2>{t('updatePolicy')}</h2>
            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.checkOnStart}
                onChange={(e) => patch('checkOnStart', e.target.checked)}
              />
              <span>
                <strong>{t('checkOnStart')}</strong>
                <small>{t('checkOnStartText')}</small>
              </span>
            </label>
            <label className="field-label" htmlFor="channel">
              {t('channel')}
            </label>
            <select
              id="channel"
              value={draft.channel}
              onChange={(e) => patch('channel', e.target.value as Settings['channel'])}
            >
              <option value="stable">{t('stable')}</option>
              <option value="beta">{t('beta')}</option>
            </select>
            <p className="field-hint">{t('betaText')}</p>
          </section>
          <section className="setting-panel">
            <h2>{t('installFolder')}</h2>
            <p>{t('installFolderText')}</p>
            <div className="folder-field">
              <FolderOpen size={18} />
              <span className="mono">{draft.installRoot || t('defaultFolder')}</span>
            </div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void chooseFolder()}
              disabled={!snapshot.native}
            >
              <FolderOpen size={15} />
              {t('chooseFolder')}
            </button>
            {!snapshot.native ? <p className="field-hint">{t('previewText')}</p> : null}
          </section>
          <section className="setting-panel">
            <h2>{t('hidden')}</h2>
            <p>{t('hiddenText')}</p>
            {draft.hiddenApps.length ? (
              <>
                <div className="hidden-list">
                  {draft.hiddenApps.map((id) => (
                    <span key={id}>
                      {snapshot.catalog.apps.find((a) => a.id === id)?.name ?? id}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => patch('hiddenApps', [])}
                >
                  {t('restore')}
                </button>
              </>
            ) : (
              <p className="muted">{t('noHidden')}</p>
            )}
          </section>
        </div>
        <details className="advanced-settings">
          <summary>
            {t('advanced')}
            <ChevronDown size={16} />
          </summary>
          <div>
            <label className="field-label" htmlFor="catalog-url">
              {t('catalogUrl')}
            </label>
            <input
              id="catalog-url"
              type="url"
              placeholder="https://…"
              value={draft.catalogUrl ?? ''}
              disabled={!snapshot.native}
              onChange={(event) => patch('catalogUrl', event.target.value || null)}
            />
            <p className="field-hint">{t('catalogUrlText')}</p>
            <span className="source-tag mono">
              {t(
                snapshot.catalogSource === 'remote'
                  ? 'remoteCatalog'
                  : snapshot.catalogSource === 'cache'
                    ? 'cachedCatalog'
                    : 'localCatalog',
              )}
            </span>
          </div>
        </details>
        <div className="settings-save">
          <button type="submit" className="button button-primary" disabled={busy}>
            <Check size={16} />
            {t('save')}
          </button>
        </div>
      </form>
      <section className="about-panel">
        <img src="/assets/openstruct-mark.svg" alt="" />
        <div>
          <h2>{t('about')}</h2>
          <p>{t('aboutText')}</p>
          <span className="mono">
            {t('version')} {snapshot.launcherVersion} ·{' '}
            {snapshot.native ? `${snapshot.platform} ${snapshot.arch}` : t('preview')}
          </span>
        </div>
        <div className="about-actions">
          <External
            onClick={() => {
              void bridge.projectLink('repository').catch(onError);
            }}
          >
            {t('github')}
          </External>
          <button className="text-button" onClick={onCheckLauncher} disabled={busy}>
            <RefreshCw size={14} />
            {t('checkLauncher')}
          </button>
        </div>
        {update ? (
          <div className="launcher-update-info">
            {update.version ? (
              <>
                <p>Struct Launcher {update.version}</p>
                <p className="release-notes">{update.notes}</p>
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={onUpdateLauncher}
                >
                  {t('updateRestart')}
                  <ArrowUpRight size={16} />
                </button>
              </>
            ) : (
              <p>{t(update.configured ? 'launcherCurrent' : 'launcherPending')}</p>
            )}
          </div>
        ) : null}
      </section>
    </section>
  );
}

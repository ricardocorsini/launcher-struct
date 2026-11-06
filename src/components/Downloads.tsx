import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import { active, bytes, percentage } from '../domain';
import { EmptyState } from './Primitives';
import type { Message } from '../i18n';
import type { Job, Snapshot } from '../types';

export default function Downloads({
  snapshot,
  t,
  onCancel,
  onRetry,
  onClear,
  busy,
}: {
  snapshot: Snapshot;
  t: (key: Message) => string;
  onCancel: (job: Job) => void;
  onRetry: (job: Job) => void;
  onClear: () => void;
  busy: boolean;
}) {
  return (
    <section className="downloads-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">OPENSTRUCT / {t('library')}</span>
          <h1>{t('downloads')}</h1>
          <p>{t('noDownloadsText')}</p>
        </div>
        {snapshot.jobs.some((j) => !active(j.phase)) ? (
          <button className="button button-secondary" onClick={onClear} disabled={busy}>
            {t('clearHistory')}
          </button>
        ) : null}
      </div>
      {!snapshot.jobs.length ? (
        <EmptyState
          icon={<ArrowDownToLine size={30} />}
          title={t('noDownloads')}
          text={t('noDownloadsText')}
        />
      ) : (
        <div className="download-list">
          {[...snapshot.jobs].reverse().map((job) => (
            <article className="download-item" key={job.id}>
              <div className={`job-icon phase-${job.phase}`}>
                {job.phase === 'complete' ? (
                  <Check />
                ) : ['failed', 'interrupted'].includes(job.phase) ? (
                  <CircleAlert />
                ) : job.phase === 'queued' ? (
                  <Clock3 />
                ) : active(job.phase) ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <ArrowDownToLine />
                )}
              </div>
              <div className="job-info">
                <div className="job-title">
                  <h2>{job.appName}</h2>
                  <span className="mono">v{job.version}</span>
                </div>
                <div className="job-metadata">
                  <span>{t(job.phase as Message)}</span>
                  <span className="mono">
                    {bytes(job.received)} / {bytes(job.total)}
                  </span>
                </div>
                <div
                  className={`download-progress phase-${job.phase}`}
                  role="progressbar"
                  aria-label={`${t('downloads')} ${job.appName}`}
                  aria-valuenow={percentage(job)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${percentage(job)}%` }} />
                </div>
                {job.error ? <p className="job-error">{job.error}</p> : null}
              </div>
              <div className="job-controls">
                {['queued', 'downloading', 'verifying'].includes(job.phase) ? (
                  <button
                    className="icon-button"
                    onClick={() => onCancel(job)}
                    aria-label={`${t('cancel')}: ${job.appName}`}
                    title={t('cancel')}
                    disabled={busy}
                  >
                    <X size={18} />
                  </button>
                ) : ['failed', 'cancelled', 'interrupted'].includes(job.phase) ? (
                  <button
                    className="button button-secondary"
                    onClick={() => onRetry(job)}
                    disabled={busy}
                  >
                    <RotateCcw size={16} />
                    {t('retry')}
                  </button>
                ) : (
                  <span className="mono">{percentage(job)}%</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

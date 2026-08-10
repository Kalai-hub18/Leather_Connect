import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { companiesApi } from '../api/endpoints';
import { ApiError } from '../api/client';

export function OfficerRecruiters() {
  const { notify } = useToast();
  const queue = useAsync(() => companiesApi.pending(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ linkId: string; name: string } | null>(null);

  async function approve(linkId: string) {
    setBusy(linkId);
    try {
      await companiesApi.decide(linkId, true);
      notify('Approved — they can post to your college now', 'success');
      await queue.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not approve', 'error');
    } finally {
      setBusy(null);
    }
  }

  const rows = queue.data ?? [];

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Recruiter Access</h1>
          <p className="page-sub">
            Companies asking to hire from your college. Nothing they post reaches students until you
            approve them.
          </p>
        </div>
        {rows.length > 0 && <Badge tone="warning">{rows.length} waiting</Badge>}
      </div>

      <AsyncBlock
        loading={queue.loading}
        error={queue.error}
        empty={rows.length === 0}
        emptyIcon="building"
        emptyTitle="No requests"
        emptyMessage="Companies asking to hire from your college will appear here."
        onRetry={queue.reload}
      >
        <div className="stack-sm">
          {rows.map((r) => (
            <Card key={r.linkId}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--space-5)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>
                      {r.company.name}
                    </h3>
                    {r.company.status === 'PENDING' ? (
                      <Badge tone="warning">New to the platform</Badge>
                    ) : (
                      <Badge tone="success">Verified elsewhere</Badge>
                    )}
                    {r.company.priorDrives > 0 && (
                      <Badge tone="neutral">
                        {r.company.priorDrives} past drive{r.company.priorDrives === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    {[r.company.industry, r.company.location].filter(Boolean).join(' · ') ||
                      'No industry given'}
                  </div>

                  {r.company.website && (
                    <a
                      href={r.company.website}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-block',
                        marginTop: 'var(--space-2)',
                        fontSize: '0.82rem',
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      {r.company.website.replace(/^https?:\/\//, '')} →
                    </a>
                  )}

                  {r.company.description && (
                    <p
                      style={{
                        fontSize: '0.84rem',
                        color: 'var(--text-muted)',
                        margin: 'var(--space-3) 0 0',
                        lineHeight: 1.5,
                      }}
                    >
                      {r.company.description}
                    </p>
                  )}

                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
                      Recruiter{r.recruiters.length === 1 ? '' : 's'}
                    </div>
                    {r.recruiters.map((u) => (
                      <div key={u.id} style={{ fontSize: '0.84rem' }}>
                        <strong>{u.fullName}</strong>{' '}
                        <span style={{ color: 'var(--text-faint)' }}>{u.email}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)', textAlign: 'right' }}>
                    Asked {new Date(r.requestedAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      className="btn btn-danger-outline"
                      onClick={() => setRejecting({ linkId: r.linkId, name: r.company.name })}
                    >
                      Decline
                    </button>
                    <button
                      className="btn btn-success"
                      disabled={busy === r.linkId}
                      onClick={() => approve(r.linkId)}
                    >
                      {busy === r.linkId ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </AsyncBlock>

      {rejecting && (
        <DeclineForm
          linkId={rejecting.linkId}
          name={rejecting.name}
          onClose={() => setRejecting(null)}
          onDone={async () => {
            setRejecting(null);
            notify('Declined — the recruiter was told why', 'success');
            await queue.reload();
          }}
        />
      )}
    </div>
  );
}

function DeclineForm({
  linkId,
  name,
  onClose,
  onDone,
}: {
  linkId: string;
  name: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { notify } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await companiesApi.decide(linkId, false, reason);
      onDone();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not decline', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Decline ${name}`} onClose={onClose}>
      <form onSubmit={submit} className="login-form">
        <label className="field">
          <span>Why? The recruiter sees this.</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            placeholder="We couldn't verify the company from the details given — please share a company email domain."
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Decline'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

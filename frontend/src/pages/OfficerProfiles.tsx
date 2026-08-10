import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { studentsApi } from '../api/endpoints';
import { ApiError } from '../api/client';

export function OfficerProfiles() {
  const { notify } = useToast();
  const queue = useAsync(() => studentsApi.pendingReview(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; name: string } | null>(null);

  async function approve(id: string) {
    setBusy(id);
    try {
      await studentsApi.decide(id, true);
      notify('Profile approved — the student can now apply', 'success');
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
          <h1 className="page-title">Student Profiles</h1>
          <p className="page-sub">
            Approving makes a student placement-ready — until then they can browse drives but not
            apply.
          </p>
        </div>
        {rows.length > 0 && <Badge tone="warning">{rows.length} waiting</Badge>}
      </div>

      <AsyncBlock
        loading={queue.loading}
        error={queue.error}
        empty={rows.length === 0}
        emptyIcon="user"
        emptyTitle="No profiles waiting"
        emptyMessage="Everyone who submitted has been reviewed."
        onRetry={queue.reload}
      >
        <div className="stack-sm">
          {rows.map((s) => (
            <Card key={s.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--space-5)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>
                      {s.user.fullName}
                    </h3>
                    <Badge tone="neutral">{s.rollNumber}</Badge>
                  </div>

                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    {s.department.name} · Batch {s.batchYear} · CGPA{' '}
                    <span className="mono">{s.cgpa}</span> ·{' '}
                    <span className="mono">{s.activeBacklogs}</span> backlog
                    {s.activeBacklogs === 1 ? '' : 's'}
                  </div>

                  {s.about && (
                    <p
                      style={{
                        fontSize: '0.84rem',
                        color: 'var(--text-muted)',
                        margin: 'var(--space-3) 0 0',
                        lineHeight: 1.5,
                      }}
                    >
                      {s.about}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                      marginTop: 'var(--space-3)',
                    }}
                  >
                    {s.skills.map((skill) => (
                      <Badge key={skill} tone="accent">
                        {skill}
                      </Badge>
                    ))}
                  </div>

                  {s.resumeUrl && (
                    <a
                      href={s.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-block',
                        marginTop: 'var(--space-3)',
                        fontSize: '0.82rem',
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      Open resume →
                    </a>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                  <button
                    className="btn btn-danger-outline"
                    onClick={() => setRejecting({ id: s.id, name: s.user.fullName })}
                  >
                    Request changes
                  </button>
                  <button
                    className="btn btn-success"
                    disabled={busy === s.id}
                    onClick={() => approve(s.id)}
                  >
                    {busy === s.id ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </AsyncBlock>

      {rejecting && (
        <RejectForm
          profileId={rejecting.id}
          name={rejecting.name}
          onClose={() => setRejecting(null)}
          onDone={async () => {
            setRejecting(null);
            notify('Sent back to the student', 'success');
            await queue.reload();
          }}
        />
      )}
    </div>
  );
}

function RejectForm({
  profileId,
  name,
  onClose,
  onDone,
}: {
  profileId: string;
  name: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { notify } = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await studentsApi.decide(profileId, false, note);
      onDone();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not send it back', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Changes for ${name}`} onClose={onClose}>
      <form onSubmit={submit} className="login-form">
        <label className="field">
          <span>What should they fix?</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            minLength={3}
            placeholder="Your resume link isn't accessible — please share it with view permission."
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send back'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/endpoints';
import type { AppNotification } from '../api/types';

/** How long ago, in the shortest form that's still clear. */
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  async function refreshCount() {
    try {
      const { count } = await notificationsApi.unreadCount();
      setUnread(count);
    } catch {
      // A failed poll shouldn't surface an error — the next tick retries.
    }
  }

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;

    notificationsApi.list().then(setItems).catch(() => setItems([]));

    const onClickAway = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);

    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  async function openNotification(n: AppNotification) {
    setOpen(false);
    if (!n.readAt) {
      await notificationsApi.markRead(n.id).catch(() => {});
      refreshCount();
    }
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    await notificationsApi.markAllRead().catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <div className="bell-wrap" ref={panelRef}>
      <button
        className="bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-panel-head">
            <span>Notifications</span>
            {unread > 0 && (
              <button className="bell-mark-all" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>

          <div className="bell-list">
            {items.length === 0 ? (
              <div className="bell-empty">Nothing yet. You'll hear about drives here.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  className={`bell-item${n.readAt ? '' : ' unread'}`}
                  onClick={() => openNotification(n)}
                >
                  <div className="bell-item-title">{n.title}</div>
                  <div className="bell-item-body">{n.body}</div>
                  <div className="bell-item-time">{timeAgo(n.createdAt)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

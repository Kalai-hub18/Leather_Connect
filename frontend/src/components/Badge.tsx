type Tone = 'success' | 'warning' | 'critical' | 'neutral' | 'accent';

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const statusTone: Record<string, Tone> = {
  Applied: 'neutral',
  Screening: 'neutral',
  Shortlisted: 'accent',
  'Written Test': 'neutral',
  'Technical Interview': 'accent',
  'HR Interview': 'accent',
  Selected: 'success',
  Rejected: 'critical',
  Joined: 'success',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? 'neutral'}>{status}</Badge>;
}

import React from 'react';
import './Badge.css';

/* Status color map from Stitch screens — all statuses across modules */
export const STATUS_MAP: Record<string, { text: string; bg: string; border: string; glow?: string; label: string }> = {
  // Lead statuses
  new:             { text: 'var(--badge-new)',        bg: 'var(--badge-new-bg)',        border: 'var(--badge-new-border)',        glow: 'var(--badge-new-glow)', label: 'New' },
  contacted:       { text: 'var(--badge-contacted)',  bg: 'var(--badge-contacted-bg)',  border: 'var(--badge-contacted-border)',  label: 'Contacted' },
  interested:      { text: 'var(--badge-interested)', bg: 'var(--badge-interested-bg)', border: 'var(--badge-interested-border)', label: 'Interested' },
  quotation_sent:  { text: 'var(--badge-quotation)',  bg: 'var(--badge-quotation-bg)',  border: 'var(--badge-quotation-border)',  label: 'Quoted' },
  booked:          { text: 'var(--badge-booked)',     bg: 'var(--badge-booked-bg)',     border: 'var(--badge-booked-border)',     glow: 'var(--badge-booked-glow)', label: 'Booked' },
  lost:            { text: 'var(--badge-lost)',       bg: 'var(--badge-lost-bg)',       border: 'var(--badge-lost-border)',       label: 'Lost' },
  // Job statuses
  scheduled:       { text: 'var(--badge-scheduled)',    bg: 'var(--badge-scheduled-bg)',    border: 'var(--badge-scheduled-border)',    label: 'Scheduled' },
  car_in:          { text: 'var(--badge-car-in)',       bg: 'var(--badge-car-in-bg)',       border: 'var(--badge-car-in-border)',       label: 'Car In' },
  washing:         { text: 'var(--badge-washing)',      bg: 'var(--badge-washing-bg)',      border: 'var(--badge-washing-border)',      label: 'Washing' },
  in_progress:     { text: 'var(--badge-in-progress)',  bg: 'var(--badge-in-progress-bg)',  border: 'var(--badge-in-progress-border)',  label: 'In Progress' },
  coating:         { text: 'var(--badge-in-progress)',  bg: 'var(--badge-in-progress-bg)',  border: 'var(--badge-in-progress-border)',  label: 'Coating' },
  qc:              { text: 'var(--badge-qc)',           bg: 'var(--badge-qc-bg)',           border: 'var(--badge-qc-border)',           label: 'QC' },
  rework:          { text: 'var(--badge-rework)',       bg: 'var(--badge-rework-bg)',       border: 'var(--badge-rework-border)',       label: 'Rework' },
  ready:           { text: 'var(--badge-ready)',        bg: 'var(--badge-ready-bg)',        border: 'var(--badge-ready-border)',        label: 'Ready' },
  delivered:       { text: 'var(--badge-delivered)',     bg: 'var(--badge-delivered-bg)',     border: 'var(--badge-delivered-border)',    label: 'Delivered' },
  cancelled:       { text: 'var(--badge-cancelled)',    bg: 'var(--badge-cancelled-bg)',    border: 'var(--badge-cancelled-border)',    label: 'Cancelled' },
  // Invoice/Payment statuses
  draft:           { text: 'var(--badge-draft)',          bg: 'var(--badge-draft-bg)',          border: '#d1d5db', label: 'Draft' },
  sent:            { text: 'var(--badge-sent)',           bg: 'var(--badge-sent-bg)',           border: '#93c5fd',  label: 'Sent' },
  partially_paid:  { text: 'var(--badge-partially-paid)', bg: 'var(--badge-partially-paid-bg)', border: '#fcd34d', label: 'Partial' },
  paid:            { text: 'var(--badge-paid)',           bg: 'var(--badge-paid-bg)',           border: '#86efac',   label: 'Paid' },
  // Booking
  confirmed:       { text: 'var(--badge-booked)',     bg: 'var(--badge-booked-bg)',     border: 'var(--badge-booked-border)', label: 'Confirmed' },
  completed:       { text: 'var(--badge-delivered)',   bg: 'var(--badge-delivered-bg)',   border: 'var(--badge-delivered-border)', label: 'Completed' },
  no_show:         { text: 'var(--badge-rework)',      bg: 'var(--badge-rework-bg)',      border: 'var(--badge-rework-border)', label: 'No Show' },
  // Generic
  active:          { text: 'var(--color-success)',     bg: 'var(--color-success-bg)',     border: 'var(--color-success-border)', label: 'Active' },
  inactive:        { text: 'var(--badge-delivered)',   bg: 'var(--badge-delivered-bg)',   border: 'var(--badge-delivered-border)', label: 'Inactive' },
  prep:            { text: '#EAB308',                  bg: '#fef9c3',         border: '#fde047', label: 'Prep' },
};

interface BadgeProps {
  status: string;
  label?: string;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const Badge: React.FC<BadgeProps> = ({ status, label, pulse = false, size = 'md' }) => {
  const key = status.toLowerCase().replace(/[\s-]+/g, '_');
  const cfg = STATUS_MAP[key] || {
    text: 'var(--color-text-muted)',
    bg: 'var(--color-surface-hover)',
    border: 'var(--color-border)',
    label: status.replace(/_/g, ' '),
  };

  const displayLabel = label || cfg.label || status;

  return (
    <span
      className={`goc-badge goc-badge--${size}`}
      style={{
        color: cfg.text,
        background: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      <span
        className={`goc-badge-dot ${pulse ? 'goc-badge-dot--pulse' : ''}`}
        style={{
          backgroundColor: cfg.text,
          boxShadow: cfg.glow ? `0 0 8px ${cfg.glow}` : 'none',
        }}
      />
      {displayLabel}
    </span>
  );
};

export default Badge;

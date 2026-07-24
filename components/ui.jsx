'use client';

import React from 'react';
import { Users, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { C } from './tokens';

export function StatCard({ label, value, dark, accent }) {
  return (
    <div
      className="rounded-2xl px-4 py-4 flex-1 min-w-[150px]"
      style={{ background: dark ? C.dark : C.paper, border: `1px solid ${C.border}` }}
    >
      <div
        className="text-[11px] tracking-wide uppercase mb-1"
        style={{ color: dark ? C.goldLight : C.muted, fontFamily: 'ui-sans-serif, system-ui' }}
      >
        {label}
      </div>
      <div
        className="text-xl font-semibold"
        style={{ color: dark ? '#fff' : (accent || C.text), fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'sage' }) {
  const map = {
    sage: { bg: C.sageLight, fg: C.sage },
    brick: { bg: C.brickLight, fg: C.brick },
    gold: { bg: '#F6EBD0', fg: '#8A6412' },
  };
  const t = map[tone];
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: t.bg, color: t.fg, fontFamily: 'ui-sans-serif, system-ui' }}
    >
      {children}
    </span>
  );
}

export function SectionHeader({ title, sub, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: C.text, fontFamily: 'ui-serif, Georgia' }}>{title}</h2>
        {sub && <p className="text-xs" style={{ color: C.muted }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block text-xs mb-2" style={{ color: C.muted }}>
      <span className="block mb-1 font-medium">{label}</span>
      {children}
    </label>
  );
}

export function IconBtn({ onClick, children, tone = 'muted', title }) {
  const colorMap = { muted: C.muted, brick: C.brick, sage: C.sage, gold: '#8A6412' };
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg hover:opacity-70 transition"
      style={{ color: colorMap[tone] }}
    >
      {children}
    </button>
  );
}

export function PrimaryBtn({ onClick, children, style }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition active:scale-[0.98]"
      style={{ background: C.dark, color: '#fff', ...style }}
    >
      {children}
    </button>
  );
}

export function EmptyState({ text }) {
  return (
    <div
      className="text-center py-10 rounded-xl text-sm"
      style={{ color: C.muted, border: `1px dashed ${C.border}` }}
    >
      {text}
    </div>
  );
}

export function InsightsPanel({ insights, compact }) {
  if (!insights || insights.length === 0) return null;
  const iconFor = (type) => (
    type === 'new' ? <Users size={14} /> :
    type === 'growth' ? <TrendingUp size={14} /> :
    type === 'risk' ? <TrendingDown size={14} /> : <Wallet size={14} />
  );
  const list = compact ? insights.slice(0, 3) : insights;
  return (
    <div className="space-y-1.5">
      {list.map((it, i) => (
        <div
          key={i}
          className="rounded-xl px-3 py-2.5 flex items-start gap-2 text-xs"
          style={{ background: it.tone === 'brick' ? C.brickLight : it.tone === 'gold' ? '#F6EBD0' : C.sageLight }}
        >
          <span className="mt-0.5" style={{ color: it.tone === 'brick' ? C.brick : it.tone === 'gold' ? '#8A6412' : C.sage }}>{iconFor(it.type)}</span>
          <span style={{ color: C.text }}>{it.text}</span>
        </div>
      ))}
    </div>
  );
}

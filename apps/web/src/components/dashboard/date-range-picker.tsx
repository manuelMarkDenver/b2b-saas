'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DateRange = { from: string; to: string };

type Preset = { label: string; key: string };

const PRESETS: Preset[] = [
  { label: 'Today', key: 'today' },
  { label: 'Last 7 days', key: '7d' },
  { label: 'This month', key: 'month' },
  { label: 'Last 30 days', key: '30d' },
  { label: 'Last 3 months', key: '90d' },
  { label: 'Custom', key: 'custom' },
];

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

export function presetToRange(key: string): DateRange {
  const now = new Date();
  const today = toISO(now);
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case '7d': {
      const f = new Date(now);
      f.setDate(f.getDate() - 6);
      return { from: toISO(f), to: today };
    }
    case 'month': {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toISO(f), to: today };
    }
    case '30d': {
      const f = new Date(now);
      f.setDate(f.getDate() - 29);
      return { from: toISO(f), to: today };
    }
    case '90d': {
      const f = new Date(now);
      f.setDate(f.getDate() - 89);
      return { from: toISO(f), to: today };
    }
    default:
      return { from: today, to: today };
  }
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState('7d');
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);

  function selectPreset(key: string) {
    setActivePreset(key);
    if (key !== 'custom') {
      onChange(presetToRange(key));
      setOpen(false);
    }
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange({ from: customFrom, to: customTo });
      setOpen(false);
    }
  }

  const displayLabel =
    activePreset === 'custom'
      ? `${value.from} → ${value.to}`
      : PRESETS.find((p) => p.key === activePreset)?.label ?? 'Last 7 days';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        {displayLabel}
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-border bg-background shadow-lg">
            <div className="py-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => selectPreset(preset.key)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted',
                    activePreset === preset.key ? 'bg-primary/10 text-primary font-medium' : 'text-foreground',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {activePreset === 'custom' && (
              <div className="border-t border-border px-4 py-3 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  onClick={applyCustom}
                  disabled={!customFrom || !customTo || customFrom > customTo}
                  className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

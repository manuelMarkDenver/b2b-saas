'use client';

import * as React from 'react';
import { Download, Search, X, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ── types ────────────────────────────────────────────────────────────────────

export type FilterOption = { value: string; label: string };

export type FilterField =
  | { type: 'search'; key: string; placeholder?: string }
  | { type: 'select'; key: string; label: string; options: FilterOption[] }
  | { type: 'toggle'; key: string; label: string };

export type FilterValues = Record<string, string | boolean>;

interface FilterBarProps {
  filters: FilterField[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onExport?: () => void;
  exportLabel?: string;
  /** When true the filter fields are hidden behind a collapsible funnel toggle */
  collapsible?: boolean;
  className?: string;
}

// ── component ─────────────────────────────────────────────────────────────────

export function FilterBar({
  filters,
  values,
  onChange,
  onExport,
  exportLabel = 'Export CSV',
  collapsible = false,
  className,
}: FilterBarProps) {
  const [expanded, setExpanded] = React.useState(!collapsible);

  function set(key: string, value: string | boolean) {
    onChange({ ...values, [key]: value });
  }

  function clear(key: string) {
    const next = { ...values };
    delete next[key];
    onChange(next);
  }

  const activeCount = filters.filter((f) => {
    const v = values[f.key];
    return v !== undefined && v !== '' && v !== false;
  }).length;

  const hasActiveFilters = activeCount > 0;

  const filterFields = (
    <>
      {filters.map((f) => {
        if (f.type === 'search') {
          return (
            <div key={f.key} className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder={f.placeholder ?? 'Search…'}
                value={(values[f.key] as string) ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                className="pl-8 pr-7 h-8 text-sm"
              />
              {values[f.key] && (
                <button
                  type="button"
                  onClick={() => clear(f.key)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        }

        if (f.type === 'select') {
          return (
            <select
              key={f.key}
              value={(values[f.key] as string) ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        }

        if (f.type === 'toggle') {
          const active = values[f.key] === true;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => set(f.key, !active)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {f.label}
              {active && <X className="h-3 w-3" />}
            </button>
          );
        }

        return null;
      })}

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => onChange({})}
        >
          Clear
        </Button>
      )}
    </>
  );

  if (collapsible) {
    return (
      <div className={cn('space-y-2', className)}>
        {/* Toolbar row: funnel toggle + export */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
              expanded || hasActiveFilters
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Filters
            {activeCount > 0 && !expanded && (
              <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </button>

          <div className="flex-1" />

          {onExport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={onExport}
            >
              <Download className="h-3.5 w-3.5" />
              {exportLabel}
            </Button>
          )}
        </div>

        {/* Expandable filter fields */}
        {expanded && (
          <div className="flex flex-wrap items-center gap-2">
            {filterFields}
          </div>
        )}
      </div>
    );
  }

  // Non-collapsible (original layout)
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className={cn('flex items-center text-xs text-muted-foreground', hasActiveFilters && 'text-primary')}>
        <ListFilter className="h-3.5 w-3.5" />
      </span>
      {filterFields}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export */}
      {onExport && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onExport}
        >
          <Download className="h-3.5 w-3.5" />
          {exportLabel}
        </Button>
      )}
    </div>
  );
}

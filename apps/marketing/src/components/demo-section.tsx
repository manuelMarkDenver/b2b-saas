'use client';

import { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { marketingConfig } from '@/config/marketing.config';
import { PLATFORM_FEATURES } from '@repo/shared';
import {
  Package, ShoppingCart, CreditCard, Users, BookOpen,
  BarChart2, GitBranch, Store, CheckCircle, TrendingUp,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Package, ShoppingCart, CreditCard, Users, BookOpen, BarChart2, GitBranch, Store,
};

/**
 * Animated product demo with optional voice-over audio.
 * Mimics a product walkthrough using CSS-animated UI elements.
 * When audioSrc file doesn't exist, the play button is still shown but
 * the audio element gracefully handles the missing file.
 */
export function DemoSection() {
  const { demo } = marketingConfig;
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [step, setStep] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const enabled = PLATFORM_FEATURES.filter((f) => f.shipped);

  const DEMO_STEPS = [
    { label: 'Dashboard', icon: TrendingUp, description: 'Your operations at a glance' },
    { label: 'Inventory', icon: Package, description: 'Live stock levels across all products' },
    { label: 'New Order', icon: ShoppingCart, description: 'Create an order from your catalog' },
    { label: 'Payment', icon: CreditCard, description: 'Log and verify payment proof' },
  ];

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {
        // Audio file not yet generated — silently ignore
      });
      setPlaying(true);
      // Auto-advance demo steps while audio plays
      let s = 0;
      const interval = setInterval(() => {
        s += 1;
        if (s >= DEMO_STEPS.length) { clearInterval(interval); return; }
        setStep(s);
      }, 4000);
    }
  }

  function toggleMute() {
    if (audioRef.current) audioRef.current.muted = !muted;
    setMuted(!muted);
  }

  const CurrentIcon = DEMO_STEPS[step].icon;

  return (
    <section id="demo" className="py-20 md:py-28 bg-slate-900">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={demo.audioSrc}
        onEnded={() => { setPlaying(false); setStep(0); }}
        preload="none"
      />

      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400 mb-3">
            Product demo
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            {demo.title}
          </h2>
          <p className="mt-4 text-lg text-slate-400">{demo.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-5 gap-8 items-start">
          {/* Step nav */}
          <div className="md:col-span-2 space-y-2">
            {DEMO_STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              return (
                <button
                  key={s.label}
                  onClick={() => setStep(i)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{s.label}</p>
                    <p className={`text-xs ${active ? 'text-indigo-200' : 'text-slate-500'}`}>
                      {s.description}
                    </p>
                  </div>
                </button>
              );
            })}

            {/* Audio controls */}
            <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-700">
              <button
                onClick={togglePlay}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? 'Pause' : 'Play walkthrough'}
              </button>
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Voice-over narration included — {demo.audioSrc ? 'click play' : 'audio coming soon'}
            </p>
          </div>

          {/* Animated mock screen */}
          <div className="md:col-span-3">
            <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-800 shadow-2xl">
              {/* Fake browser chrome */}
              <div className="flex items-center gap-1.5 bg-slate-900 px-4 py-3 border-b border-slate-700">
                <span className="h-3 w-3 rounded-full bg-red-500/70" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
                <div className="ml-3 flex-1 rounded-md bg-slate-700 h-5 max-w-xs text-xs text-slate-400 flex items-center px-3">
                  app.operix.io
                </div>
              </div>

              {/* Mock UI */}
              <div className="p-6 min-h-[320px] animate-fade-in" key={step}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
                    <CurrentIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{DEMO_STEPS[step].label}</p>
                    <p className="text-xs text-slate-400">{DEMO_STEPS[step].description}</p>
                  </div>
                </div>

                {/* Fake content rows */}
                {step === 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Orders', value: '128', color: 'text-indigo-400' },
                      { label: 'Pending', value: '14', color: 'text-yellow-400' },
                      { label: 'Low Stock', value: '3', color: 'text-red-400' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl bg-slate-700/50 p-3">
                        <p className="text-xs text-slate-400">{stat.label}</p>
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                    <div className="col-span-3 space-y-2 mt-2">
                      {[85, 62, 45].map((w, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="h-2 rounded-full bg-indigo-500/30 flex-1">
                            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${w}%` }} />
                          </div>
                          <span className="text-xs text-slate-400">{w}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-2">
                    {enabled.slice(0, 4).map((f, i) => {
                      const Icon = ICON_MAP[f.icon] ?? Package;
                      return (
                        <div key={f.key} className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-200">{f.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-slate-600">
                              <div
                                className="h-1.5 rounded-full bg-emerald-500"
                                style={{ width: `${[78, 92, 55, 100][i]}%` }}
                              />
                            </div>
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3">
                    {['Item #1 — Cement Bag (50kg)', 'Item #2 — Steel Rebar 10mm', 'Item #3 — PVC Pipe 4"'].map((item, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-200">{item}</span>
                        </div>
                        <span className="text-sm font-semibold text-indigo-400">
                          × {[5, 20, 3][i]}
                        </span>
                      </div>
                    ))}
                    <button className="w-full mt-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white">
                      Confirm Order
                    </button>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3">
                      <CheckCircle className="h-6 w-6 text-emerald-400" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-400">Payment Verified</p>
                        <p className="text-xs text-slate-400">Order #00128 — ₱12,500.00</p>
                      </div>
                    </div>
                    {['GCash transfer — proof attached', 'Bank deposit — verified'].map((item, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2.5">
                        <span className="text-sm text-slate-300">{item}</span>
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

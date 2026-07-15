"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
} from "recharts";
import { runKalman, rmse, type KalmanStep } from "@/lib/kalman";

const C = {
  accent: "#22d3ee",
  truth: "#34d399",
  measure: "#64748b",
  gain: "#f59e0b",
  band: "rgba(34,211,238,0.14)",
  grid: "#1a2230",
  axis: "#5a6b80",
};

const STEPS = 140;
const DT = 1;

export default function Home() {
  const [q, setQ] = useState(0.02); // process noise
  const [r, setR] = useState(40); // measurement noise (filter's assumption)
  const [sensorNoise, setSensorNoise] = useState(6); // true sensor std
  const [seed, setSeed] = useState(7);
  const [speed, setSpeed] = useState(60); // fps
  const [step, setStep] = useState(STEPS);
  const [playing, setPlaying] = useState(false);

  const data: KalmanStep[] = useMemo(
    () => runKalman({ q, r, sensorNoise, steps: STEPS, dt: DT, seed }),
    [q, r, sensorNoise, seed]
  );

  // Animation loop — reveal the filter one step at a time.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= STEPS) {
          setPlaying(false);
          return STEPS;
        }
        return s + 1;
      });
    }, 1000 / speed);
    return () => clearInterval(id);
  }, [playing, speed]);

  const visible = data.slice(0, Math.max(step, 2));

  const metrics = useMemo(() => {
    const truth = visible.map((d) => d.truePos);
    const rawRmse = rmse(
      visible.map((d) => d.measurement),
      truth
    );
    const filtRmse = rmse(
      visible.map((d) => d.estimate),
      truth
    );
    const improvement = rawRmse > 0 ? ((rawRmse - filtRmse) / rawRmse) * 100 : 0;
    const currentStd = visible[visible.length - 1]?.std ?? 0;
    return { rawRmse, filtRmse, improvement, currentStd };
  }, [visible]);

  const play = () => {
    setStep(0);
    setPlaying(true);
  };

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8">
      {/* Header */}
      <header className="mb-7">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-accent">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          Engineering Lab · Sensor Fusion
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Kalman Filter Visualizer
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          A noisy sensor and a motion model, fused into one confident estimate.
          Tune how much the filter trusts each, and watch the uncertainty band
          shrink as it learns.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        {/* Controls */}
        <aside className="flex flex-col gap-4 rounded-xl border border-border bg-panel p-5">
          <div>
            <h2 className="text-sm font-semibold">Controls</h2>
            <p className="mt-0.5 text-xs text-muted">
              Sliders re-filter the same measurements — compare tunings fairly.
            </p>
          </div>

          <Slider
            label="Process noise · Q"
            hint="How much the filter distrusts its motion model. Higher → follows measurements more."
            value={q}
            min={0.001}
            max={0.5}
            step={0.001}
            onChange={setQ}
            format={(v) => v.toFixed(3)}
          />
          <Slider
            label="Measurement noise · R"
            hint="How much the filter distrusts the sensor. Higher → smoother, but laggier."
            value={r}
            min={1}
            max={300}
            step={1}
            onChange={setR}
            format={(v) => v.toFixed(0)}
          />
          <Slider
            label="True sensor noise · σ"
            hint="The actual scatter injected into measurements. Match R to σ² for a well-tuned filter."
            value={sensorNoise}
            min={0}
            max={20}
            step={0.5}
            onChange={setSensorNoise}
            format={(v) => v.toFixed(1)}
          />
          <Slider
            label="Animation speed"
            hint="Steps revealed per second."
            value={speed}
            min={5}
            max={140}
            step={5}
            onChange={setSpeed}
            format={(v) => `${v.toFixed(0)} fps`}
          />

          <div className="mt-1 flex gap-2">
            {playing ? (
              <button
                onClick={() => setPlaying(false)}
                className="flex-1 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={play}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-[#04121a] transition hover:brightness-110"
              >
                ▶ Play
              </button>
            )}
            <button
              onClick={() => {
                setPlaying(false);
                setStep(STEPS);
              }}
              className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
            >
              Show all
            </button>
            <button
              onClick={() => setSeed((s) => s + 1)}
              className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
              title="New random measurements"
            >
              ⟳
            </button>
          </div>
        </aside>

        {/* Charts + metrics */}
        <section className="flex flex-col gap-5">
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label="Raw sensor RMSE"
              value={metrics.rawRmse.toFixed(2)}
              tone="measure"
            />
            <Metric
              label="Filtered RMSE"
              value={metrics.filtRmse.toFixed(2)}
              tone="accent"
            />
            <Metric
              label="Error reduced"
              value={`${metrics.improvement.toFixed(0)}%`}
              tone="truth"
            />
            <Metric
              label="Uncertainty ±2σ"
              value={metrics.currentStd.toFixed(2)}
              tone="muted"
            />
          </div>

          {/* Main chart */}
          <div className="rounded-xl border border-border bg-panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Position tracking</h3>
              <Legend />
            </div>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={visible}
                  margin={{ top: 6, right: 12, bottom: 0, left: -12 }}
                >
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="t"
                    stroke={C.axis}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={C.axis}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f141c",
                      border: "1px solid #1e2836",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#8b98a9" }}
                  />
                  <Area
                    dataKey="band"
                    stroke="none"
                    fill={C.band}
                    isAnimationActive={false}
                    name="±2σ confidence"
                  />
                  <Scatter
                    dataKey="measurement"
                    fill={C.measure}
                    line={false}
                    isAnimationActive={false}
                    name="Measurement"
                  />
                  <Line
                    dataKey="truePos"
                    stroke={C.truth}
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                    name="True position"
                  />
                  <Line
                    dataKey="estimate"
                    stroke={C.accent}
                    dot={false}
                    strokeWidth={2.4}
                    isAnimationActive={false}
                    name="Filter estimate"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Kalman gain chart */}
          <div className="rounded-xl border border-border bg-panel p-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Kalman gain</h3>
              <span className="text-xs text-muted">
                trust in the measurement vs. the model — it settles as the filter
                converges
              </span>
            </div>
            <div className="h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={visible}
                  margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                >
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="t"
                    stroke={C.axis}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={C.axis}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f141c",
                      border: "1px solid #1e2836",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#8b98a9" }}
                  />
                  <Line
                    dataKey="gain"
                    stroke={C.gain}
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    name="Gain"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-8 border-t border-border pt-4 text-xs text-muted">
        Engineering Labs · built by Aryaman — no API keys, no backend, the filter
        runs entirely in your browser.
      </footer>
    </main>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium">{label}</label>
        <span className="font-mono text-xs text-accent">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-2"
      />
      <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>
    </div>
  );
}

const TONES: Record<string, string> = {
  accent: "#22d3ee",
  truth: "#34d399",
  measure: "#94a3b8",
  muted: "#8b98a9",
};

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-2xl font-semibold"
        style={{ color: TONES[tone] }}
      >
        {value}
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { c: C.truth, label: "True" },
    { c: C.measure, label: "Measured" },
    { c: C.accent, label: "Estimate" },
    { c: "rgba(34,211,238,0.4)", label: "±2σ" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: it.c }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

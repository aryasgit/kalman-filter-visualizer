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
  estimate: "#16c784",
  truth: "#c2c6cd",
  measure: "#5c5c5c",
  gain: "#ff2b2b",
  band: "rgba(22,199,132,0.10)",
  grid: "rgba(255,255,255,0.045)",
  axis: "#3a3a3a",
  tick: "#787b86",
};

const TOOLTIP = {
  background: "#0a0a0a",
  border: "1px solid #262626",
  borderRadius: 0,
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: "0.02em",
};

const STEPS = 140;
const DT = 1;

export default function Home() {
  const [q, setQ] = useState(0.02);
  const [r, setR] = useState(40);
  const [sensorNoise, setSensorNoise] = useState(6);
  const [seed, setSeed] = useState(7);
  const [speed, setSpeed] = useState(60);
  const [step, setStep] = useState(STEPS);
  const [playing, setPlaying] = useState(false);

  const data: KalmanStep[] = useMemo(
    () => runKalman({ q, r, sensorNoise, steps: STEPS, dt: DT, seed }),
    [q, r, sensorNoise, seed]
  );

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

  const m = useMemo(() => {
    const truth = visible.map((d) => d.truePos);
    const rawRmse = rmse(visible.map((d) => d.measurement), truth);
    const filtRmse = rmse(visible.map((d) => d.estimate), truth);
    const improvement = rawRmse > 0 ? ((rawRmse - filtRmse) / rawRmse) * 100 : 0;
    const std = visible[visible.length - 1]?.std ?? 0;
    const gain = visible[visible.length - 1]?.gain ?? 0;
    return { rawRmse, filtRmse, improvement, std, gain };
  }, [visible]);

  const converged = m.improvement > 0;
  const play = () => {
    setStep(0);
    setPlaying(true);
  };

  return (
    <div className="app">
      {/* ============ header ============ */}
      <header className="header">
        <div className="logo">
          <span className="mark">K</span>
          KALMAN <span className="sub">· SENSOR FUSION</span>
        </div>
        <div className="hstats">
          <div className="hstat">
            <span className="l">FILTERED RMSE</span>
            <span className="v num up">{m.filtRmse.toFixed(2)}</span>
          </div>
          <div className="hstat">
            <span className="l">±2<span className="sig">σ</span></span>
            <span className="v num">{m.std.toFixed(2)}</span>
          </div>
          <div className="hstat">
            <span className="l">ERROR CUT</span>
            <span className={`v num ${converged ? "up" : "down"}`}>
              {m.improvement.toFixed(0)}%
            </span>
          </div>
        </div>
      </header>

      {/* ============ body ============ */}
      <div className="body">
        {/* ---- left rail: controls ---- */}
        <aside className="rail left">
          <div className="section-title">
            FILTER TUNING <span className="count">SAME MEASUREMENTS</span>
          </div>

          <Field
            label="PROCESS NOISE · Q"
            value={q}
            fmt={(v) => v.toFixed(3)}
            min={0.001}
            max={0.5}
            step={0.001}
            onChange={setQ}
            lo="0.001"
            hi="0.5"
            hint="Distrust in the motion model. Higher → the filter chases the sensor."
          />
          <Field
            label="MEASUREMENT NOISE · R"
            value={r}
            fmt={(v) => v.toFixed(0)}
            min={1}
            max={300}
            step={1}
            onChange={setR}
            lo="1"
            hi="300"
            hint="Distrust in the sensor. Higher → smoother, but the estimate lags."
          />
          <Field
            label={<>TRUE SENSOR NOISE · <span className="sig">σ</span></>}
            value={sensorNoise}
            fmt={(v) => v.toFixed(1)}
            min={0}
            max={20}
            step={0.5}
            onChange={setSensorNoise}
            lo="0"
            hi="20"
            hint="Actual scatter injected into measurements. Tune R ≈ σ² for a matched filter."
          />

          <div className="section-title">PLAYBACK</div>
          <Field
            label="SPEED"
            value={speed}
            fmt={(v) => `${v.toFixed(0)} FPS`}
            min={5}
            max={140}
            step={5}
            onChange={setSpeed}
            lo="5"
            hi="140"
          />
          <div className="btns">
            {playing ? (
              <button className="btn primary" onClick={() => setPlaying(false)}>
                ❚❚ PAUSE
              </button>
            ) : (
              <button className="btn primary" onClick={play}>
                ▶ PLAY
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                setPlaying(false);
                setStep(STEPS);
              }}
            >
              ALL
            </button>
            <button
              className="btn icon"
              title="New measurement noise"
              onClick={() => setSeed((s) => s + 1)}
            >
              ⟳
            </button>
          </div>
        </aside>

        {/* ---- center: charts ---- */}
        <main className="center">
          <div className="chart-block main">
            <div className="chart-head">
              <span className="ct">
                POSITION TRACKING <span className="muted">· step {visible.length}/{STEPS}</span>
              </span>
              <div className="legend">
                <span><i style={{ background: C.truth }} /> TRUE</span>
                <span><i className="dot" style={{ background: C.measure }} /> MEASURED</span>
                <span><i style={{ background: C.estimate }} /> ESTIMATE</span>
                <span><i className="band" style={{ background: C.band }} /> ±2<span className="sig">σ</span></span>
              </div>
            </div>
            <div className="chart-canvas">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={visible} margin={{ top: 8, right: 14, bottom: 0, left: -6 }}>
                  <CartesianGrid stroke={C.grid} />
                  <XAxis dataKey="t" stroke={C.axis} tick={{ fontSize: 10, fill: C.tick }} tickLine={false} />
                  <YAxis stroke={C.axis} tick={{ fontSize: 10, fill: C.tick }} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP} labelStyle={{ color: "#8a8a8a" }} cursor={{ stroke: "#333" }} />
                  <Area dataKey="band" stroke="none" fill={C.band} isAnimationActive={false} name="±2σ" />
                  <Scatter dataKey="measurement" fill={C.measure} line={false} isAnimationActive={false} name="MEASURED" />
                  <Line dataKey="truePos" stroke={C.truth} dot={false} strokeWidth={1.4} isAnimationActive={false} name="TRUE" />
                  <Line dataKey="estimate" stroke={C.estimate} dot={false} strokeWidth={2.2} isAnimationActive={false} name="ESTIMATE" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-block gain">
            <div className="chart-head">
              <span className="ct">
                KALMAN GAIN <span className="muted">· measurement trust, settles on convergence</span>
              </span>
            </div>
            <div className="chart-canvas">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visible} margin={{ top: 8, right: 14, bottom: 0, left: -6 }}>
                  <CartesianGrid stroke={C.grid} />
                  <XAxis dataKey="t" stroke={C.axis} tick={{ fontSize: 10, fill: C.tick }} tickLine={false} />
                  <YAxis stroke={C.axis} tick={{ fontSize: 10, fill: C.tick }} tickLine={false} domain={[0, 1]} />
                  <Tooltip contentStyle={TOOLTIP} labelStyle={{ color: "#8a8a8a" }} cursor={{ stroke: "#333" }} />
                  <Line dataKey="gain" stroke={C.gain} dot={false} strokeWidth={2} isAnimationActive={false} name="GAIN" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </main>

        {/* ---- right rail: readout + stats ---- */}
        <aside className="rail right">
          <div className="readout">
            <div className="ro-top">
              <span className={`ro-verdict ${converged ? "" : "warn"}`}>
                {converged ? "FILTER CONVERGED" : "OVER-SMOOTHED"}
              </span>
              <span className="ro-conf">{Math.abs(m.improvement).toFixed(0)}% VS RAW</span>
            </div>
            <div className="ro-line">
              <span className="d">→</span>
              {converged ? (
                <span>
                  Fusion cut sensor error by <b>{m.improvement.toFixed(0)}%</b> — the estimate is tighter than any single reading.
                </span>
              ) : (
                <span>
                  R is too high: the filter over-trusts the model and <b>lags</b> the maneuvering target. Lower R or raise Q.
                </span>
              )}
            </div>
            <div className="ro-line">
              <span className="d">→</span>
              <span>
                Current confidence is <b>±{(2 * m.std).toFixed(1)}</b> around the estimate; the gain has {m.gain < 0.35 ? "settled" : "not yet settled"}.
              </span>
            </div>
          </div>

          <div className="section-title">PERFORMANCE</div>
          <div className="stats">
            <Stat label="RAW SENSOR RMSE" value={m.rawRmse.toFixed(2)} sub="unfiltered" />
            <Stat label="FILTERED RMSE" value={m.filtRmse.toFixed(2)} tone="pos" sub="vs truth" />
            <Stat
              label="ERROR REDUCED"
              value={`${m.improvement.toFixed(0)}%`}
              tone={converged ? "pos" : "neg"}
              sub="raw → filtered"
            />
            <Stat label={<>UNCERTAINTY ±2<span className="sig">σ</span></>} value={m.std.toFixed(2)} sub="filter confidence" />
            <Stat label="FINAL GAIN" value={m.gain.toFixed(3)} sub="steady state" />
            <Stat label="STEPS" value={`${visible.length}`} sub={`of ${STEPS}`} />
          </div>

          <div className="foot">
            Engineering Labs · built by Aryaman. No API keys, no backend — the
            filter runs in your browser. <a href="https://github.com/aryasgit/kalman-filter-visualizer" target="_blank" rel="noreferrer">Source →</a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  fmt,
  min,
  max,
  step,
  onChange,
  lo,
  hi,
  hint,
}: {
  label: React.ReactNode;
  value: number;
  fmt: (v: number) => string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  lo: string;
  hi: string;
  hint?: string;
}) {
  return (
    <div className="field">
      <div className="range-row">
        <span className="rl">{label}</span>
        <span className="rv">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="range-scale">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: React.ReactNode;
  value: string;
  sub: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className={`stat ${tone ?? ""}`}>
      <span className="sl">{label}</span>
      <span className="sv num">{value}</span>
      <span className="sb">{sub}</span>
    </div>
  );
}

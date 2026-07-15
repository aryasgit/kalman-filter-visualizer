// A 1-D constant-velocity Kalman filter, written out in scalar form so the
// predict/update loop is readable rather than hidden behind a matrix library.
//
// State x = [position, velocity]^T
// F = [[1, dt], [0, 1]]           (constant-velocity motion model)
// H = [1, 0]                      (we only measure position)
// Q = q * discrete white-noise-acceleration covariance
// R = r                           (measurement noise variance the filter assumes)

export interface KalmanParams {
  q: number; // process-noise scale — how much we distrust the motion model
  r: number; // measurement-noise variance — how much we distrust the sensor
  sensorNoise: number; // TRUE std of the noise injected into measurements
  steps: number;
  dt: number;
  seed: number;
}

export interface KalmanStep {
  t: number;
  truePos: number;
  measurement: number;
  estimate: number;
  band: [number, number]; // estimate ± 2σ (position uncertainty)
  gain: number; // Kalman gain for position
  std: number; // sqrt(P[0][0]) — the filter's own confidence
}

// Deterministic RNG so changing Q/R re-filters the SAME noisy data —
// you compare tunings on identical measurements, not a fresh random draw.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller: two uniforms in, one standard-normal sample out.
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// The "real" trajectory: a maneuvering target (sine + slow drift). It is NOT a
// pure constant-velocity path, so the filter's model is deliberately imperfect.
function truePosition(t: number): number {
  return 40 * Math.sin(0.045 * t) + 0.18 * t;
}

export function runKalman(p: KalmanParams): KalmanStep[] {
  const { q, r, sensorNoise, steps, dt, seed } = p;
  const rng = mulberry32(seed);

  // Initial state estimate and covariance (start uncertain).
  let pos = truePosition(0);
  let vel = 0;
  // Covariance P = [[a, b], [b, c]], symmetric.
  let a = 100,
    b = 0,
    c = 100;

  const out: KalmanStep[] = [];

  for (let t = 0; t < steps; t++) {
    const truePos = truePosition(t);
    const measurement = truePos + sensorNoise * gaussian(rng);

    // --- PREDICT ---
    // x = F x
    pos = pos + dt * vel;
    // vel unchanged under constant-velocity model
    // P = F P F^T + Q
    const aP = a + 2 * dt * b + dt * dt * c;
    const bP = b + dt * c;
    const cP = c;
    // discrete white-noise-acceleration process noise
    const q00 = q * (dt * dt * dt * dt) / 4;
    const q01 = q * (dt * dt * dt) / 2;
    const q11 = q * dt * dt;
    a = aP + q00;
    b = bP + q01;
    c = cP + q11;

    // --- UPDATE ---
    const y = measurement - pos; // innovation
    const S = a + r; // H P H^T + R
    const k0 = a / S; // Kalman gain (position)
    const k1 = b / S; // Kalman gain (velocity)
    pos = pos + k0 * y;
    vel = vel + k1 * y;
    // P = (I - K H) P
    const aNew = (1 - k0) * a;
    const bNew = (1 - k0) * b;
    const cNew = c - k1 * b;
    a = aNew;
    b = bNew;
    c = cNew;

    const std = Math.sqrt(Math.max(a, 0));
    out.push({
      t,
      truePos,
      measurement,
      estimate: pos,
      band: [pos - 2 * std, pos + 2 * std],
      gain: k0,
      std,
    });
  }

  return out;
}

// Root-mean-square error helper for the metric cards.
export function rmse(values: number[], truth: number[]): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - truth[i];
    sum += d * d;
  }
  return Math.sqrt(sum / values.length);
}

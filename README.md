# Kalman Filter · Sensor-Fusion Visualizer

> Fuse two noisy sensors into one confident estimate — and watch the uncertainty shrink in real time.

`Next.js` · `TypeScript` · `Vercel` · **[Live demo →](#)**

## What it does

Two sensors report the same moving target, both noisy in different ways. The Kalman filter combines them — plus a motion model — into a single estimate that's better than either sensor alone. The dashboard shows the true path, the raw measurements, and the filtered estimate side by side, with a shaded band showing how confident the filter is at every step.

## The theory worth understanding

A Kalman filter runs a two-step loop:

- **Predict** — use the motion model to guess the next state and *grow* the uncertainty.
- **Update** — pull the guess toward the new measurement, weighted by the **Kalman gain**.

The gain is the whole story: it's the ratio of how much you trust the model (**process noise Q**) versus the measurement (**measurement noise R**). High gain → chase the sensor. Low gain → trust the model. The **covariance** is the filter's own confidence, and watching it shrink as measurements arrive is the "aha" of the whole thing.

## What the dashboard shows

- True path vs. noisy measurements vs. filtered estimate (live)
- **Covariance band** — the estimate's confidence envelope
- **Kalman gain over time** — see it settle
- Sliders for **Q** and **R** to feel the trust tradeoff
- **RMSE** metric: filtered vs. raw, to prove it actually helps
- Toggle: **synthetic data** ↔ a recorded **BARQ** trajectory trace

## Architecture

```
noisy sensor A ┐
               ├─→ predict → update (Kalman gain) → estimate + covariance → charts
motion model ──┘         (all in-browser, TypeScript)
```

## Tech

Next.js (App Router) · TypeScript · Plotly for charts. No backend, no API keys — the filter runs client-side.

## Run locally

```bash
npm install
npm run dev
```

## Caveats & what I learned

- The filter assumes **linear dynamics and Gaussian noise** — break either and it degrades.
- **Mistuned Q/R is the #1 failure:** too-low R makes it track noise; too-high R makes it lag reality.
- Covariance is optimistic — it reflects the *model's* belief, not ground truth. If the model is wrong, the filter is confidently wrong.
- The one-liner: *"I built it to watch the covariance shrink as the filter learns to trust its model."*

---

Author: **Aryaman**

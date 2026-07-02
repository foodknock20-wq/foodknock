// src/components/shared/splash/index.ts
//
// FoodKnock Splash System — internal barrel.
//
// Mirrors the "one door in" pattern already established elsewhere in
// this codebase (e.g. src/lib/notifications/index.ts,
// src/lib/automation/runner/index.ts) — anything that ever needs a splash
// primitive directly (a future test file, a Storybook-style preview, a
// debug page) imports from here rather than reaching into
// splash/layers/* or splash/motionTokens.ts individually.
//
// SplashScreen.tsx itself (the component actually mounted by layout.tsx)
// intentionally stays OUTSIDE this folder, at its original path
// (@/components/shared/SplashScreen) — so no existing import needs to
// change for this module to exist.

export { useSplashLifecycle } from "./useSplashLifecycle";
export type { SplashLifecycle, UseSplashLifecycleOptions } from "./useSplashLifecycle";

export { default as Veil } from "./layers/Veil";
export { default as ParticleField } from "./layers/ParticleField";
export { default as LogoMark } from "./layers/LogoMark";
export { default as BrandReveal } from "./layers/BrandReveal";

export * from "./types";
export * from "./motionTokens";
export { SPLASH_PARTICLES } from "./particles";
export { markSplashEvent } from "./splashDebug";
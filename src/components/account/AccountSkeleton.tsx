// src/components/account/AccountSkeleton.tsx
//
// Presentational-only skeleton primitives for /account/* route loading.tsx
// files. No data fetching here. Matches the light premium customer theme
// (fk-* tokens already used by AccountHub/ProfileForm/AddressManager) so
// swapping in real content never jumps colors or spacing — only the
// Suspense boundary created by each loading.tsx unmounts this.
//
// Uses Tailwind's built-in `animate-pulse` (already the convention in
// AdminListSkeleton) plus `motion-reduce:animate-none` so
// prefers-reduced-motion users get a static placeholder instead of pulsing.

export function SkeletonBlock({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse motion-reduce:animate-none rounded-fk-sm bg-fk-surface-selected ${className}`} />;
}

export function SkeletonCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
    return (
        <div className={`rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-4 ${className}`}>
            {children}
        </div>
    );
}

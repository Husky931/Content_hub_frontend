import { type ReactNode } from "react";

export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/** Keeps button width stable during loading by rendering invisible text + overlaid spinner */
export function ButtonSpinner({ loading, children, spinnerClass }: { loading: boolean; children: ReactNode; spinnerClass?: string }) {
  if (!loading) return <>{children}</>;
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className="invisible">{children}</span>
      <span className="absolute inset-0 flex items-center justify-center">
        <Spinner className={spinnerClass} />
      </span>
    </span>
  );
}

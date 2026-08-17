import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="mb-1 text-xs font-medium tracking-wide text-text-2 uppercase">{eyebrow}</p> : null}
        <h1 className="text-[22px] leading-7 font-semibold tracking-tight text-text sm:text-2xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-text-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  description,
  children,
  className = "",
  padded = true,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <div className={`border-b border-line ${padded ? "px-5 py-4" : "px-5 py-4"}`}>
          <h2 className="text-[15px] font-semibold text-text">{title}</h2>
          {description ? <p className="mt-1 text-sm text-text-2">{description}</p> : null}
        </div>
      ) : null}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input ${className}`} {...props} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-text">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-text-2">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-text">{title}</p>
      {description ? <p className="mt-1 text-sm text-text-2">{description}</p> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  extra,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  extra?: ReactNode;
}) {
  return (
    <article className="card p-5">
      <p className="text-[13px] font-medium text-text-2">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-[28px] leading-none font-semibold tracking-tight">{value}</p>
        {extra}
      </div>
      {hint ? <p className="mt-3 text-xs text-text-2">{hint}</p> : null}
    </article>
  );
}

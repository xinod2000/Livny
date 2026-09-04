import { useEffect, useRef, useState, type ReactNode } from "react";

/* Появление блока при попадании во вьюпорт */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${on ? "reveal-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* Заголовок раздела в стиле конструкторской документации */
export function SectionHead({
  index,
  kicker,
  title,
  meta,
}: {
  index: string;
  kicker: string;
  title: string;
  meta?: string;
}) {
  return (
    <Reveal>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] tracking-[0.22em] text-amber uppercase">
            <span className="text-tx-dim">{"//"}</span> {index} · {kicker}
          </div>
          <h2 className="font-display mt-3 text-3xl font-800 tracking-tight text-tx uppercase sm:text-4xl font-extrabold">
            {title}
          </h2>
        </div>
        {meta && (
          <div className="border-l-2 border-amber/60 pl-4 font-mono text-xs leading-relaxed text-tx-dim max-w-xs">
            {meta}
          </div>
        )}
      </div>
    </Reveal>
  );
}

/* Светодиод с подписью */
export function Led({
  color,
  label,
  on,
  blink,
}: {
  color: "grn" | "amber" | "red" | "cy";
  label: string;
  on: boolean;
  blink?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`led ${on ? `led-${color}` : ""} ${
          on && blink ? "led-blink" : ""
        }`}
      />
      <span className="font-mono text-[10px] tracking-[0.14em] text-tx-dim uppercase">
        {label}
      </span>
    </div>
  );
}

/* Иконки типов POU для дерева проекта */
export function KindIcon({ kind }: { kind: string }) {
  const base = "h-3.5 w-3.5 flex-none";
  switch (kind) {
    case "DUT":
      return (
        <svg viewBox="0 0 16 16" className={base} fill="none">
          <path d="M8 1.5 14 4.5 8 7.5 2 4.5Z" stroke="#52d3b2" strokeWidth="1.3" />
          <path d="M2 8 8 11 14 8" stroke="#52d3b2" strokeWidth="1.3" />
          <path d="M2 11.5 8 14.5 14 11.5" stroke="#52d3b2" strokeWidth="1.3" opacity=".5" />
        </svg>
      );
    case "GVL":
      return (
        <svg viewBox="0 0 16 16" className={base} fill="none">
          <circle cx="8" cy="8" r="6" stroke="#7ab0ff" strokeWidth="1.3" />
          <path d="M2 8h12M8 2c-2 2-2 10 0 12M8 2c2 2 2 10 0 12" stroke="#7ab0ff" strokeWidth="1.1" />
        </svg>
      );
    case "FB":
      return (
        <svg viewBox="0 0 16 16" className={base} fill="none">
          <rect x="4" y="3" width="8" height="10" stroke="#f6a821" strokeWidth="1.3" />
          <path d="M1 6h3M1 10h3M12 6h3M12 10h3" stroke="#f6a821" strokeWidth="1.3" />
        </svg>
      );
    case "PRG":
      return (
        <svg viewBox="0 0 16 16" className={base} fill="none">
          <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="#5fd7ff" strokeWidth="1.3" />
          <path d="M6.5 5.5 11 8l-4.5 2.5Z" stroke="#5fd7ff" strokeWidth="1.2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" className={base} fill="none">
          <path d="M4 1.5h5L12.5 5v9.5h-8.5Z" stroke="#97a6b9" strokeWidth="1.3" />
          <path d="M9 1.5V5h3.5" stroke="#97a6b9" strokeWidth="1.2" />
        </svg>
      );
  }
}

export function ScaleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M12 3v4M4 21h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 7 5.5 9.5M12 7l6.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.5 9.5 3 15a3 3 0 0 0 5 0l-2.5-5.5ZM18.5 12 16 17.5a3 3 0 0 0 5 0L18.5 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 21v-4h8v4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

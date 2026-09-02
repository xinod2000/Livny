import { useEffect, useRef, useState } from "react";
import { cycleStates } from "../data/project";
import { Led, Reveal } from "./ui";

/* ─────────────────────────────────────────────────────────────────────
   Живая мнемосхема дозатора. Модель повторяет логику FB_DoserControl:
   двухступенчатая подача, отсечка «на лету» с адаптацией Δ, досыпка.
   Время условно ускорено для наглядности.
   ───────────────────────────────────────────────────────────────────── */

type SimState =
  | "READY" | "CLAMP" | "TARE" | "COARSE" | "FINE"
  | "SETTLE" | "CHECK" | "TOPUP" | "UNCLAMP" | "PAUSE";

interface Sim {
  st: SimState;
  t: number;            // время в состоянии, с
  w: number;            // вес на платформе (брутто), кг
  tare: number;
  setpoint: number;
  learned: number;      // текущая Δлету (адаптивная), кг
  inflightTrue: number; // фактическое «зависание» (с дрейфом), кг
  topups: number;
  count: number;
  totalKg: number;
  lastW: number;
  lastErr: number;
  flow: number;         // скорость потока, кг/мин
  falling: number;      // сколько кг ещё «летит» в мешок
  bagDrop: number;      // смещение мешка при сбросе, px
}

const DT = 0.05;

function freshSim(setpoint: number): Sim {
  return {
    st: "READY", t: 0, w: 0.12, tare: 0, setpoint,
    learned: 0.15, inflightTrue: 0.148, topups: 0,
    count: 0, totalKg: 0, lastW: 0, lastErr: 0, flow: 0,
    falling: 0, bagDrop: 0,
  };
}

function step(s: Sim, auto: boolean): Sim {
  const n = { ...s };
  n.t += DT;
  const cut = n.setpoint * 0.1;                    // грубая отсечка ~10 %
  const drift = Math.sin(n.count * 1.7) * 0.028;   // дрейф «железа»
  n.inflightTrue = 0.148 + drift;
  const noise = (Math.random() - 0.5) * 0.004;

  switch (n.st) {
    case "READY":
      n.w = 0.12 + noise;                          // оператор надел новый мешок
      n.tare = 0; n.flow = 0; n.bagDrop = 0;
      if (auto && n.t > 0.7) { n.st = "CLAMP"; n.t = 0; }
      break;

    case "CLAMP":
      n.w = 0.12 + noise; n.flow = 0;
      if (n.t > 0.6) { n.st = "TARE"; n.t = 0; }
      break;

    case "TARE":
      n.w = 0.12 + noise;
      if (n.t > 1.0) { n.tare = n.w; n.st = "COARSE"; n.t = 0; }
      break;

    case "COARSE": {
      const rate = 4.4;
      n.w += rate * DT + noise;
      n.flow = rate * 60 * (0.96 + Math.random() * 0.08);
      if (n.w >= n.setpoint - cut) { n.st = "FINE"; n.t = 0; }
      break;
    }

    case "FINE": {
      const rate = 0.85;
      n.w += rate * DT + noise;
      n.flow = rate * 60 * (0.95 + Math.random() * 0.1);
      if (n.w >= n.setpoint - n.learned) {
        n.falling = n.inflightTrue + (Math.random() - 0.5) * 0.01;
        n.st = "SETTLE"; n.t = 0;
      }
      break;
    }

    case "SETTLE":
      // продукт «долетает» в мешок за первые 0.4 с
      if (n.falling > 0) {
        const add = Math.min(n.falling, n.falling * 8 * DT + 0.004);
        n.w += add; n.falling -= add;
      }
      n.w += noise * 0.5;
      n.flow = Math.max(0, n.flow - 300 * DT);
      if (n.t > 1.2) { n.st = "CHECK"; n.t = 0; }
      break;

    case "CHECK": {
      const net = n.w - n.tare;
      const err = net - n.setpoint;
      const tol = 0.05;
      if (err < -tol && n.topups < 2) {
        n.st = "TOPUP"; n.t = 0; n.topups += 1;
      } else {
        // адаптация Δ: Δ := clamp(Δ + 0.3·ε, 0.02…0.8)
        n.learned = Math.min(0.8, Math.max(0.02, n.learned + 0.3 * err));
        n.count += 1;
        n.totalKg += net;
        n.lastW = net;
        n.lastErr = err;
        n.st = "UNCLAMP"; n.t = 0;
      }
      break;
    }

    case "TOPUP": {
      const rate = 0.5;
      n.w += rate * DT + noise;
      n.flow = rate * 60;
      if (n.t > 0.4) { n.falling = 0.02; n.st = "SETTLE"; n.t = 0; }
      break;
    }

    case "UNCLAMP":
      n.flow = 0;
      n.bagDrop = Math.min(70, n.t * 160);
      n.w = Math.max(0.12 * (1 - n.t / 0.5), 0);
      if (n.t > 0.7) { n.st = "PAUSE"; n.t = 0; }
      break;

    case "PAUSE":
      n.w = 0; n.bagDrop = 0;
      if (n.t > 0.6) {
        if (auto) { n.st = "CLAMP"; n.w = 0.12; }
        else n.st = "READY";
        n.t = 0;
      }
      break;
  }
  return n;
}

const ST_LABEL: Record<SimState, string> = {
  READY: "ГОТОВ", CLAMP: "ЗАЖИМ", TARE: "ТАРА", COARSE: "ГРУБО",
  FINE: "ТОЧНО", SETTLE: "УСПОК", CHECK: "КОНТР", TOPUP: "ДОСЫП",
  UNCLAMP: "СБРОС", PAUSE: "ПАУЗА",
};

function MimicSvg({ s }: { s: Sim }) {
  const filling = s.st === "COARSE" || s.st === "FINE" || s.st === "TOPUP";
  const coarse = s.st === "COARSE";
  const fine = s.st === "FINE" || s.st === "TOPUP";
  const clamped = !["READY", "UNCLAMP", "PAUSE"].includes(s.st);
  const net = Math.max(0, s.w - s.tare);
  const frac = Math.min(1, net / s.setpoint);
  const bagTop = 258;
  const bagBottom = 392;
  const fillY = bagBottom - 8 - frac * (bagBottom - bagTop - 26);
  const bagVisible = s.st !== "PAUSE";

  const steel = "#5a6d84";
  const steelDim = "#3a4a5e";
  const body = "#1a2330";
  const sugar = "#e8c07a";
  const amber = "#f6a821";
  const label = "#7d90a6";

  return (
    <svg viewBox="0 0 600 470" className="h-auto w-full" role="img" aria-label="Мнемосхема дозатора">
      <defs>
        <clipPath id="bagClip">
          <path d="M272,258 C262,300 252,340 250,388 L350,388 C348,340 338,300 328,258 Z" />
        </clipPath>
        <linearGradient id="sugarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2d391" />
          <stop offset="100%" stopColor="#c99b52" />
        </linearGradient>
      </defs>

      {/* бункер */}
      <path d="M130,34 L370,34 L330,108 L170,108 Z" fill={body} stroke={steel} strokeWidth="1.6" />
      <path d="M178,60 L322,60 L308,100 L192,100 Z" fill={sugar} opacity="0.85" />
      <path d="M200,108 L300,108 L300,124 L200,124 Z" fill={body} stroke={steel} strokeWidth="1.4" />
      <text x="130" y="26" fontSize="10" fontFamily="IBM Plex Mono" fill={label}>БУНКЕР САХАРА</text>

      {/* патрубки к шнекам */}
      <path d="M215,124 L200,140" stroke={steelDim} strokeWidth="1.4" fill="none" />
      <path d="M285,124 L370,140" stroke={steelDim} strokeWidth="1.4" fill="none" />

      {/* шнек 1 — грубый */}
      <g>
        <circle cx="200" cy="152" r="27" fill={body} stroke={coarse ? amber : steel} strokeWidth="2" />
        <g className={coarse ? "auger-spin" : ""}>
          <path d="M200,131 L200,173 M182,141 L218,163 M218,141 L182,163" stroke={coarse ? amber : steelDim} strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <circle cx="200" cy="152" r="4" fill={coarse ? amber : steelDim} />
        <text x="128" y="156" fontSize="10" fontFamily="IBM Plex Mono" fill={label} textAnchor="end">ШНЕК 1</text>
        <text x="128" y="168" fontSize="9" fontFamily="IBM Plex Mono" fill={coarse ? amber : "#4c5d72"} textAnchor="end">R1 · ГРУБО</text>
      </g>

      {/* шнек 2 — точный */}
      <g>
        <circle cx="372" cy="152" r="17" fill={body} stroke={fine ? amber : steel} strokeWidth="2" />
        <g className={fine ? "auger-spin-slow" : ""}>
          <path d="M372,139 L372,165 M361,145 L383,159 M383,145 L361,159" stroke={fine ? amber : steelDim} strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx="372" cy="152" r="3" fill={fine ? amber : steelDim} />
        <text x="444" y="150" fontSize="10" fontFamily="IBM Plex Mono" fill={label}>ШНЕК 2</text>
        <text x="444" y="162" fontSize="9" fontFamily="IBM Plex Mono" fill={fine ? amber : "#4c5d72"}>R2 · ТОЧНО</text>
      </g>

      {/* самотёки */}
      <path d="M200,179 L200,224 L282,248" fill="none" stroke={steelDim} strokeWidth="1.6" />
      <path d="M372,169 L372,224 L320,248" fill="none" stroke={steelDim} strokeWidth="1.6" />
      {coarse && <path className="stream" d="M203,181 L203,222 L281,245" fill="none" stroke={amber} strokeWidth="3" opacity="0.9" />}
      {fine && <path className="stream" d="M370,171 L370,222 L321,245" fill="none" stroke={amber} strokeWidth="2.4" opacity="0.9" />}

      {/* зажим */}
      <g>
        <rect x={clamped ? 254 : 240} y="238" width="16" height="18" rx="2" fill={body} stroke={clamped ? amber : steel} strokeWidth="1.5" style={{ transition: "all .35s" }} />
        <rect x={clamped ? 330 : 344} y="238" width="16" height="18" rx="2" fill={body} stroke={clamped ? amber : steel} strokeWidth="1.5" style={{ transition: "all .35s" }} />
        <text x="300" y="232" fontSize="9" fontFamily="IBM Plex Mono" fill={label} textAnchor="middle">ЗАЖИМ R0</text>
      </g>

      {/* мешок с сахаром */}
      {bagVisible && (
        <g style={{ transform: `translateY(${s.bagDrop}px)`, transition: "transform .25s linear" }}>
          <path d="M272,258 C262,300 252,340 250,388 L350,388 C348,340 338,300 328,258 Z" fill="#243140" stroke={steel} strokeWidth="1.6" opacity="0.92" />
          <g clipPath="url(#bagClip)">
            <rect x="246" y={fillY} width="110" height={bagBottom - fillY} fill="url(#sugarGrad)" style={{ transition: "y .12s linear" }} />
          </g>
          <path d="M272,258 L328,258" stroke={steel} strokeWidth="2" />
        </g>
      )}
      <text x="228" y="330" fontSize="9" fontFamily="IBM Plex Mono" fill={label} textAnchor="end">МЕШОК</text>

      {/* весовая платформа + тензодатчик */}
      <rect x="222" y="396" width="156" height="12" rx="2" fill={body} stroke={steel} strokeWidth="1.6" />
      <rect x="268" y="412" width="64" height="18" rx="2" fill={body} stroke={filling ? amber : steelDim} strokeWidth="1.4" />
      <text x="300" y="425" fontSize="9" fontFamily="IBM Plex Mono" fill={filling ? amber : label} textAnchor="middle">ТЕНЗО</text>
      <text x="396" y="405" fontSize="9" fontFamily="IBM Plex Mono" fill={label}>МВ110-224.1ТД</text>

      {/* конвейер */}
      <line className="conveyor-line" x1="150" y1="448" x2="450" y2="448" stroke="#46586e" strokeWidth="3" strokeLinecap="round" />
      <circle cx="150" cy="448" r="5" fill={body} stroke={steelDim} strokeWidth="1.5" />
      <circle cx="450" cy="448" r="5" fill={body} stroke={steelDim} strokeWidth="1.5" />

      {/* лампа */}
      <g>
        <circle cx="548" cy="52" r="13" fill={filling ? "rgba(246,168,33,.16)" : "transparent"} stroke={filling ? amber : steelDim} strokeWidth="1.6" className={filling ? "lamp-pulse" : ""} />
        <circle cx="548" cy="52" r="5" fill={filling ? amber : "#33404f"} />
        <text x="548" y="78" fontSize="8.5" fontFamily="IBM Plex Mono" fill={label} textAnchor="middle">R3</text>
      </g>

      {/* выноска текущего веса */}
      <g>
        <line x1="384" y1="402" x2="470" y2="402" stroke={steelDim} strokeWidth="1" strokeDasharray="3 3" />
        <text x="478" y="398" fontSize="10" fontFamily="IBM Plex Mono" fill="#5fd7ff">
          {(s.w - s.tare).toFixed(3)} кг
        </text>
        <text x="478" y="412" fontSize="8.5" fontFamily="IBM Plex Mono" fill={label}>НЕТТО</text>
      </g>
    </svg>
  );
}

export default function Mimic() {
  const [sim, setSim] = useState<Sim>(() => freshSim(25));
  const [auto, setAuto] = useState(true);
  const simRef = useRef(sim);
  const autoRef = useRef(auto);
  simRef.current = sim;
  autoRef.current = auto;

  useEffect(() => {
    const id = setInterval(() => {
      setSim((s) => step(s, autoRef.current));
    }, DT * 1000);
    return () => clearInterval(id);
  }, []);

  const net = Math.max(0, sim.w - sim.tare);
  const running = ["CLAMP", "TARE", "COARSE", "FINE", "SETTLE", "CHECK", "TOPUP", "UNCLAMP", "PAUSE"].includes(sim.st);
  const startEnabled = sim.st === "READY" && !auto;
  const setpoint = sim.setpoint;

  const pressStart = () => {
    if (simRef.current.st === "READY") {
      setSim({ ...simRef.current, st: "CLAMP", t: 0 });
    } else {
      // перезапуск демонстрации с текущей уставкой
      setSim({ ...freshSim(simRef.current.setpoint) });
    }
  };
  const pressStop = () => {
    const s = simRef.current;
    if (running && s.st !== "UNCLAMP" && s.st !== "PAUSE") {
      setSim({ ...s, st: "UNCLAMP", t: 0, flow: 0 });
    }
  };
  const changeSet = (v: number) => {
    const s = simRef.current;
    setSim({ ...s, setpoint: v });
  };

  return (
    <Reveal>
      <div className="panel frame-corners overflow-hidden">
        <div className="panel-head justify-between">
          <span>Мнемосхема · весовой дозатор сахара</span>
          <span className="hidden sm:inline text-tx-dim">FB_DoserControl.st · цикл ~12 с (ускоренно)</span>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
          {/* ── SVG-мнемосхема ── */}
          <div className="border-b border-line-soft p-4 lg:border-r lg:border-b-0">
            <MimicSvg s={sim} />
          </div>

          {/* ── пульт оператора ── */}
          <div className="flex flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.2em] text-tx-dim uppercase">Вес нетто</span>
              <div className="flex gap-4">
                <Led color="grn" label="Готов" on={sim.st === "READY"} />
                <Led color="amber" label="Работа" on={running} blink={sim.st === "COARSE" || sim.st === "FINE" || sim.st === "TOPUP"} />
                <Led color="cy" label="RS-485" on blink />
              </div>
            </div>

            <div className="digits mt-1 text-[52px] leading-none font-bold text-cy sm:text-[64px]">
              {net.toFixed(3)}
              <span className="ml-2 text-lg font-medium text-tx-dim">кг</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded border border-line-soft bg-line-soft">
              {[
                { l: "Уставка", v: `${setpoint.toFixed(1)} кг`, c: "text-amber" },
                { l: "Δ лету", v: `${(sim.learned * 1000).toFixed(0)} г`, c: "text-tx" },
                { l: "Поток", v: `${sim.flow.toFixed(0)} кг/мин`, c: "text-cy" },
                { l: "Мешков", v: `${sim.count}`, c: "text-grn" },
                { l: "Посл. ошибка", v: `${sim.count ? (sim.lastErr * 1000).toFixed(0) : "—"} г`, c: sim.count && Math.abs(sim.lastErr) > 0.05 ? "text-red" : "text-tx" },
                { l: "Досыпки", v: `${sim.topups}`, c: "text-tx" },
              ].map((it) => (
                <div key={it.l} className="bg-ink-850 px-3 py-2.5">
                  <div className="font-mono text-[9.5px] tracking-[0.12em] text-tx-dim uppercase">{it.l}</div>
                  <div className={`digits-amber font-display mt-0.5 text-lg font-semibold ${it.c}`}>{it.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 rounded border border-line-soft bg-ink-850 px-3 py-2.5">
              <span className="font-mono text-[10px] tracking-[0.16em] text-tx-dim uppercase">Состояние</span>
              <span className="font-display text-xl font-bold tracking-wider text-amber-hi">{ST_LABEL[sim.st]}</span>
              <span className="ml-auto font-mono text-[10px] text-tx-dim">
                {cycleStates.find((c) => c.st === sim.st)?.note ?? "простой"}
              </span>
            </div>

            {/* кнопки */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button className="btn-hmi btn-start" onClick={pressStart} disabled={!startEnabled && sim.st !== "READY"}>
                ПУСК
              </button>
              <button className="btn-hmi btn-stop" onClick={pressStop}>
                СТОП
              </button>
              <div className="ml-auto flex overflow-hidden rounded border border-line">
                {[25, 50].map((v) => (
                  <button key={v} className={`seg ${setpoint === v ? "seg-on" : ""}`} onClick={() => changeSet(v)}>
                    {v} кг
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-3 select-none">
              <button
                role="switch"
                aria-checked={auto}
                onClick={() => setAuto(!auto)}
                className={`relative h-5 w-10 rounded-full border transition-colors ${auto ? "border-grn/70 bg-grn/25" : "border-line bg-ink-850"}`}
              >
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${auto ? "left-[22px] bg-grn" : "left-0.5 bg-tx-dim"}`}
                />
              </button>
              <span className="font-mono text-[11px] tracking-wide text-tx-mut" onClick={() => setAuto(!auto)}>
                Автоцикл — мешок за мешком
              </span>
            </label>

            <p className="mt-4 border-t border-line-soft pt-3 font-mono text-[10.5px] leading-relaxed text-tx-dim">
              Δ «на лету» обучается на каждой дозе: ε = факт − задание, Δ ← Δ + 0,3·ε.
              Следите, как ошибка устаканивается около нуля за несколько циклов.
            </p>
          </div>
        </div>

        {/* лента состояний автомата */}
        <div className="border-t border-line-soft bg-ink-850/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {cycleStates.map((c, i) => {
              const active = c.st === sim.st;
              const passed = cycleStates.findIndex((x) => x.st === sim.st);
              return (
                <div key={c.code} className="flex items-center gap-1.5">
                  <span
                    className={`rounded-sm border px-2 py-1 font-mono text-[10px] tracking-widest transition-all duration-300 ${
                      active
                        ? "border-amber bg-amber/15 text-amber-hi shadow-[0_0_14px_rgba(246,168,33,0.25)]"
                        : i < passed
                        ? "border-line-soft text-tx-dim"
                        : "border-line-soft text-tx-dim/70"
                    }`}
                  >
                    {c.code}
                  </span>
                  {i < cycleStates.length - 1 && (
                    <svg viewBox="0 0 8 8" className="h-2 w-2 text-line">
                      <path d="M1 1l5 3-5 3z" fill="currentColor" />
                    </svg>
                  )}
                </div>
              );
            })}
            <span className="ml-auto hidden rounded-sm border border-red/40 px-2 py-1 font-mono text-[10px] tracking-widest text-red/70 md:inline">
              АВАРИЯ · 999
            </span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

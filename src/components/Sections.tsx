import { useState } from "react";
import { algoSteps, commissioning, hardware, ioDi, ioDo, weightCh } from "../data/project";
import { Reveal, SectionHead } from "./ui";

/* ── 02 · АЛГОРИТМ ─────────────────────────────────────────────────── */
export function AlgorithmSection() {
  return (
    <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
      {/* математика отсечки — липкая колонка */}
      <Reveal className="lg:sticky lg:top-24 lg:self-start">
        <div className="panel frame-corners p-6">
          <div className="font-mono text-[11px] tracking-[0.22em] text-amber uppercase">Математика отсечки</div>
          <p className="mt-3 text-sm leading-relaxed text-tx-mut">
            Питатель физически не может остановиться мгновенно: между командой
            «закрыть» и реальной остановкой в мешок успевает упасть ещё немного
            сахара. Автомат закрывает шнек <em className="text-tx">заранее</em> — на величину Δ.
          </p>

          <div className="mt-5 space-y-3 font-mono text-[12.5px]">
            <div className="rounded border border-line-soft bg-ink-950/70 p-3">
              <span className="text-tx-dim">грубая:</span>{" "}
              <span className="text-cy">W<sub>отс</sub> = W<sub>зад</sub> − 2,5 кг</span>
            </div>
            <div className="rounded border border-line-soft bg-ink-950/70 p-3">
              <span className="text-tx-dim">точная:</span>{" "}
              <span className="text-cy">W<sub>отс</sub> = W<sub>зад</sub> − Δ<sub>лету</sub></span>
            </div>
            <div className="rounded border border-amber/35 bg-amber/5 p-3 text-amber-hi">
              Δ<sub>лету</sub> ← clamp( Δ<sub>лету</sub> + 0,3·ε ,&nbsp;20…800 г )
              <div className="mt-1 text-[11px] text-tx-mut">ε = W<sub>факт</sub> − W<sub>зад</sub> — ошибка каждой дозы</div>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-[13px] text-tx-mut">
            {[
              ["±50 г", "технологический допуск (0,2 %) — жёстче ГОСТ 8.579-2002"],
              ["2,5 с", "окно контроля потока: нет прироста — «затор шнека»"],
              ["≤ 3", "попытки досыпки малым шнеком при недовесе"],
            ].map(([v, t]) => (
              <li key={v} className="flex gap-3">
                <span className="digits-amber font-display w-14 flex-none font-bold text-amber">{v}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* шаги цикла */}
      <div className="relative">
        <div className="absolute top-2 bottom-2 left-[26px] hidden w-px bg-line sm:block" />
        <div className="space-y-4">
          {algoSteps.map((s, i) => (
            <Reveal key={s.n} delay={i * 60}>
              <div className="group relative flex gap-5 rounded-md border border-line-soft bg-ink-850/70 p-5 transition-all hover:border-amber/50 hover:bg-ink-800 sm:ml-0">
                <div className="relative z-10 flex h-[52px] w-[52px] flex-none items-center justify-center rounded border border-line bg-ink-900 font-display text-lg font-bold text-amber transition-colors group-hover:border-amber/60 group-hover:text-amber-hi">
                  {s.n}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-lg font-semibold text-tx">{s.t}</h3>
                    <span className="rounded-sm border border-cy/30 bg-cy/5 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-cy/80">
                      {s.tag}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-tx-mut">{s.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 04 · КАРТА СИГНАЛОВ ───────────────────────────────────────────── */
function Screw({ on }: { on?: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 flex-none rounded-full border ${
        on ? "border-amber/70 bg-amber/25" : "border-ink-600 bg-ink-750"
      }`}
    />
  );
}

export function IoSection() {
  return (
    <div className="space-y-6">
      {/* топология RS-485 */}
      <Reveal>
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] tracking-[0.2em] text-amber uppercase">Топология RS-485 · COM2</span>
            <span className="font-mono text-[10.5px] text-tx-dim">115200 бит/с · 8N1 · протоколы ОВЕН / Modbus RTU</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {[
              { t: "СПК107", s: "мастер шины" },
              { t: "МВ110-224.1ТД", s: "адрес 16 · вес" },
              { t: "МВ110-8Д.4Р", s: "адрес 17 · DI/реле" },
              { t: "120 Ом", s: "терминатор" },
            ].map((n, i, arr) => (
              <div key={n.t} className="flex flex-1 basis-40 items-center gap-2">
                <div className="w-full rounded border border-line bg-ink-900 px-3 py-2 text-center transition-colors hover:border-amber/50">
                  <div className="font-display text-[13px] font-semibold text-tx">{n.t}</div>
                  <div className="font-mono text-[9.5px] text-tx-dim">{n.s}</div>
                </div>
                {i < arr.length - 1 && (
                  <svg viewBox="0 0 24 10" className="h-2.5 w-6 flex-none text-line">
                    <line x1="0" y1="5" x2="24" y2="5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M18 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-tx-dim">
            Опрос — ФБ-шаблонами Mv110Td и Mv110_8D4R (библиотека шаблонов МХ110, поставка ОВЕН для CODESYS 3.5).
            Выходы шаблонов связываются с переменными GVL — см. README.txt.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* МВ110-8Д.4Р */}
        <Reveal delay={80}>
          <div className="panel h-full">
            <div className="panel-head justify-between">
              <span>МВ110-8Д.4Р · дискретные каналы</span>
              <span className="text-amber">адр. 17</span>
            </div>
            <div className="grid sm:grid-cols-2">
              <div className="border-b border-line-soft p-4 sm:border-r sm:border-b-0">
                <div className="mb-2 font-mono text-[10px] tracking-[0.18em] text-tx-dim uppercase">Входы DI0…DI7</div>
                <div className="space-y-1.5">
                  {ioDi.map((d) => (
                    <div key={d.ch} className="group flex items-start gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-ink-750">
                      <span className="mt-1"><Screw on /></span>
                      <span className="w-8 flex-none font-mono text-[10.5px] text-cy">{d.ch}</span>
                      <span className="min-w-0">
                        <span className="block font-mono text-[11.5px] font-semibold text-tx">{d.sig}</span>
                        <span className="block text-[10.5px] leading-snug text-tx-dim">{d.wire} — {d.why}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <div className="mb-2 font-mono text-[10px] tracking-[0.18em] text-tx-dim uppercase">Реле R0…R3</div>
                <div className="space-y-1.5">
                  {ioDo.map((d) => (
                    <div key={d.ch} className="group flex items-start gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-ink-750">
                      <span className="mt-1"><Screw on /></span>
                      <span className="w-8 flex-none font-mono text-[10.5px] text-amber">{d.ch}</span>
                      <span className="min-w-0">
                        <span className="block font-mono text-[11.5px] font-semibold text-tx">{d.sig}</span>
                        <span className="block text-[10.5px] leading-snug text-tx-dim">{d.load} — {d.why}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded border border-red/30 bg-red/5 p-2.5 font-mono text-[10.5px] leading-relaxed text-tx-mut">
                  <span className="text-red">DI2 — НЗ-контакт.</span> Обрыв цепи аварийного стопа
                  воспринимается как нажатие: выходы гаснут в следующем скане.
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* МВ110-224.1ТД */}
        <Reveal delay={160}>
          <div className="panel h-full">
            <div className="panel-head justify-between">
              <span>МВ110-224.1ТД · весовой канал</span>
              <span className="text-amber">адр. 16</span>
            </div>
            <div className="p-4">
              <div className="space-y-1.5">
                {weightCh.map((d) => (
                  <div key={d.p} className="flex items-start gap-3 rounded-sm px-1.5 py-2 transition-colors hover:bg-ink-750">
                    <span className="mt-1"><Screw on /></span>
                    <span className="w-28 flex-none font-mono text-[11px] font-semibold text-cy">{d.p}</span>
                    <span className="text-[12px] leading-snug text-tx-mut">{d.v}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded border border-line-soft bg-line-soft">
                {[
                  ["g_rWeightRaw", "вес, кг"],
                  ["g_xWeightValid", "данные OK"],
                  ["g_xWeightErr", "ошибка модуля"],
                  ["g_xTareToModule", "команда «ноль»"],
                ].map(([v, d]) => (
                  <div key={v} className="bg-ink-850 px-3 py-2">
                    <div className="font-mono text-[11px] text-amber-hi">{v}</div>
                    <div className="font-mono text-[9.5px] text-tx-dim">{d}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-tx-dim">
                Калибровка — образцовыми гирями через Owen Configurator;
                в программе остаётся только программная тара мешка и фильтр.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/* ── 05 · ОБОРУДОВАНИЕ ─────────────────────────────────────────────── */
export function HardwareSection() {
  return (
    <div className="panel divide-y divide-line-soft">
      {hardware.map((h, i) => (
        <Reveal key={h.name} delay={i * 70}>
          <div className="group grid gap-4 p-5 transition-colors hover:bg-ink-800/60 md:grid-cols-[280px_1fr] md:p-6">
            <div className="border-l-2 border-line pl-4 transition-colors group-hover:border-amber">
              <div className="font-mono text-[10px] tracking-[0.18em] text-amber uppercase">{h.tag}</div>
              <div className="font-display mt-1 text-xl font-bold text-tx">{h.name}</div>
              <div className="mt-0.5 text-[12.5px] text-tx-mut">{h.role}</div>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {h.specs.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-3 border-b border-line-soft/60 pb-1.5">
                  <span className="w-20 flex-none font-mono text-[10px] tracking-widest text-tx-dim uppercase">{k}</span>
                  <span className="text-[13px] text-tx-mut">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ── 06 · ПУСКОНАЛАДКА ─────────────────────────────────────────────── */
export function CommissioningSection() {
  const [done, setDone] = useState<boolean[]>(() => commissioning.map(() => false));
  const progress = Math.round((done.filter(Boolean).length / commissioning.length) * 100);

  return (
    <div className="panel p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-4">
        <div className="font-mono text-[11px] tracking-[0.2em] text-amber uppercase">Чек-лист ввода в эксплуатацию</div>
        <div className="ml-auto flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber to-grn transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-display text-sm font-bold text-tx">{progress}%</span>
        </div>
      </div>

      <ol className="mt-5 grid gap-2 md:grid-cols-2">
        {commissioning.map((c, i) => (
          <li key={i}>
            <button
              onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              className={`flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left transition-all ${
                done[i]
                  ? "border-grn/40 bg-grn/5"
                  : "border-line-soft bg-ink-850 hover:border-amber/40 hover:bg-ink-800"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-sm border font-mono text-[11px] transition-colors ${
                  done[i] ? "border-grn bg-grn text-ink-950" : "border-ink-600 text-tx-dim"
                }`}
              >
                {done[i] ? "✓" : i + 1}
              </span>
              <span className={`text-[13px] leading-relaxed ${done[i] ? "text-tx-dim line-through" : "text-tx-mut"}`}>
                {c}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

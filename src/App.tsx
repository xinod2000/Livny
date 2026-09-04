import CodeBrowser from "./components/CodeBrowser";
import Mimic from "./components/Mimic";
import {
  AlgorithmSection,
  CommissioningSection,
  HardwareSection,
  IoSection,
} from "./components/Sections";
import { Led, Reveal, ScaleMark, SectionHead } from "./components/ui";
import { stFiles } from "./data/project";

const NAV = [
  ["#mimic", "Мнемосхема"],
  ["#algorithm", "Алгоритм"],
  ["#code", "Код"],
  ["#io", "Сигналы"],
  ["#hardware", "Оборудование"],
  ["#setup", "Пусконаладка"],
] as const;

const TICKER = [
  "ОВЕН СПК107 · CODESYS 3.5.17",
  "IEC 61131-3 · Structured Text",
  "МВ110-224.1ТД · адрес 16 · тензоканал 24 бит",
  "МВ110-8Д.4Р · адрес 17 · 8 DI / 4 реле",
  "RS-485 · 115200 8N1 · протокол ОВЕН / Modbus RTU",
  "отсечка «на лету» с адаптацией Δ",
  "допуск ±50 г на мешок 25 кг",
  "рецепты 25 / 50 кг · статистика смены",
];

function TopBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-900/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-2.5 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <ScaleMark className="h-6 w-6 text-amber" />
          <span className="leading-none">
            <span className="font-display block text-[15px] font-bold tracking-wide text-tx">
              САХАР·ДОЗАТОР
            </span>
            <span className="font-mono block text-[9px] tracking-[0.24em] text-tx-dim">
              ПРОЕКТ «ЛИВНЫ» · 25/50 КГ
            </span>
          </span>
        </a>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-sm px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-tx-mut transition-colors hover:bg-ink-750 hover:text-amber-hi"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Led color="grn" label="RUN" on blink />
          <Led color="cy" label="COM" on />
          <Led color="red" label="ALM" on={false} />
        </div>
      </div>

      {/* бегущая строка */}
      <div className="overflow-hidden border-t border-line-soft bg-ink-950/80">
        <div className="ticker-track flex gap-10 py-1 font-mono text-[10px] tracking-[0.14em] whitespace-nowrap text-tx-dim">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-10">
              <span className={i % 4 === 0 ? "text-amber/80" : ""}>{t}</span>
              <span className="text-line">▪</span>
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

function TitleBlock() {
  return (
    <Reveal>
      <div className="mb-8 border border-line bg-ink-850/70">
        <div className="grid sm:grid-cols-[1fr_300px]">
          <div className="p-6 sm:p-8">
            <div className="font-mono text-[11px] tracking-[0.24em] text-amber uppercase">
              Рабочая документация · программный модуль
            </div>
            <h1 className="font-display mt-3 text-[34px] leading-[1.05] font-black tracking-tight text-tx uppercase sm:text-5xl">
              Весовой дозатор
              <br />
              сахара <span className="text-amber">в мешки</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-tx-mut">
              Полный комплект программы на Structured Text для контроллера{" "}
              <span className="text-tx">ОВЕН СПК107</span>: автомат на 12 состояний,
              двухступенчатая подача с отсечкой «на лету», адаптация по ошибке каждой
              дозы, аварии и сервис экрана. Переменные не привязаны к физическим
              каналам — маппинг выполняется интегратором в CODESYS.
            </p>
          </div>
          {/* штамп */}
          <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-1 sm:border-t-0 sm:border-l">
            {[
              ["ПЛК", "ОВЕН СПК107"],
              ["Среда", "CODESYS 3.5.17"],
              ["Стандарт", "IEC 61131-3 · ST"],
              ["Модули", "МВ110-224.1ТД, МВ110-8Д.4Р"],
              ["POU", `${stFiles.length} объектов · GVL`],
            ].map(([k, v]) => (
              <div key={k} className="bg-ink-850 px-4 py-2.5">
                <div className="font-mono text-[9px] tracking-[0.2em] text-tx-dim uppercase">{k}</div>
                <div className="font-mono mt-0.5 text-[12px] font-semibold text-tx">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-ink-950/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <ScaleMark className="h-5 w-5 text-amber" />
            <span className="font-display text-sm font-bold tracking-wide text-tx">САХАР·ДОЗАТОР · «ЛИВНЫ»</span>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-tx-dim">
            Программа правления весовым дозатором сахара в мешки. Репозиторий
            Structured Text готов к переносу в проект CODESYS 3.5.17 — файлы
            скачиваются из раздела «Код».
          </p>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.2em] text-tx-dim uppercase">Состав репозитория Livny</div>
          <ul className="mt-3 grid grid-cols-1 gap-1.5">
            {stFiles.map((f) => (
              <li key={f.name}>
                <a
                  href={`${import.meta.env.BASE_URL}Livny/${f.name}`}
                  download
                  className="font-mono text-[11.5px] text-tx-mut transition-colors hover:text-amber-hi"
                >
                  ↓ {f.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.2em] text-tx-dim uppercase">Опора проекта</div>
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-tx-mut">
            <li>IEC 61131-3 — языки программирования ПЛК</li>
            <li>ГОСТ 8.579-2002 — фасованные товары (допуски)</li>
            <li>Шаблоны модулей МХ110 для CODESYS (ОВЕН)</li>
            <li>RS-485 / Modbus RTU — сеть полевых модулей</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line-soft py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 font-mono text-[10px] tracking-[0.16em] text-tx-dim sm:px-6">
          <span>ОВЕН СПК107 · МВ110-224.1ТД · МВ110-8Д.4Р</span>
          <span>ST · IEC 61131-3 · комментарии на русском</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div id="top" className="bg-blueprint noise min-h-screen">
      <TopBar />

      <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <TitleBlock />

        <section id="mimic" className="scroll-mt-28">
          <SectionHead
            index="01"
            kicker="живая демонстрация"
            title="Мнемосхема дозирования"
            meta="Модель повторяет логику FB_DoserControl: двухступенчатая подача, Δ «на лету», досыпка, сброс мешка."
          />
          <Mimic />
        </section>

        <section id="algorithm" className="mt-24 scroll-mt-28">
          <SectionHead
            index="02"
            kicker="технология"
            title="Алгоритм весового дозирования"
            meta="Почему точность ±50 г достигается шнеками и пневматикой без сервоприводов."
          />
          <AlgorithmSection />
        </section>

        <section id="code" className="mt-24 scroll-mt-28">
          <SectionHead
            index="03"
            kicker="репозиторий Livny"
            title="Исходный код · Structured Text"
            meta="9 файлов: DUT, GVL, 4 функциональных блока, 2 программы, README. Скачиваются и переносятся в CODESYS как есть."
          />
          <CodeBrowser />
        </section>

        <section id="io" className="mt-24 scroll-mt-28">
          <SectionHead
            index="04"
            kicker="вводы / выводы"
            title="Карта сигналов"
            meta="Назначение каждого канала МВ110-8Д.4Р и весового тракта МВ110-224.1ТД. Логические имена — в GVL."
          />
          <IoSection />
        </section>

        <section id="hardware" className="mt-24 scroll-mt-28">
          <SectionHead
            index="05"
            kicker="аппаратная часть"
            title="Оборудование ОВЕН"
            meta="Контроллер-панель СПК107 и два модуля серии МВ110 на общей шине RS-485."
          />
          <HardwareSection />
        </section>

        <section id="setup" className="mt-24 scroll-mt-28">
          <SectionHead
            index="06"
            kicker="ввод в эксплуатацию"
            title="Пусконаладка"
            meta="Порядок работ от переноса POU до проверки аварийных сценариев."
          />
          <CommissioningSection />
        </section>
      </main>

      <Footer />
    </div>
  );
}

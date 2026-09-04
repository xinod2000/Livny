import { useMemo, useState } from "react";
import { downloadText, stFiles, totalLines } from "../data/project";
import { KindIcon, Reveal } from "./ui";

/* ─────────────────────────────────────────────────────────────────────
   Подсветка Structured Text (IEC 61131-3): комментарии, строки,
   ключевые слова, типы, литералы времени и числа.
   ───────────────────────────────────────────────────────────────────── */

const KW = [
  "IF","THEN","ELSIF","ELSE","END_IF","CASE","OF","END_CASE","FOR","TO","BY",
  "DO","END_FOR","WHILE","END_WHILE","REPEAT","UNTIL","END_REPEAT","RETURN",
  "EXIT","VAR","VAR_INPUT","VAR_OUTPUT","VAR_IN_OUT","VAR_GLOBAL","END_VAR",
  "TYPE","END_TYPE","STRUCT","END_STRUCT","PROGRAM","END_PROGRAM",
  "FUNCTION_BLOCK","END_FUNCTION_BLOCK","FUNCTION","END_FUNCTION","TRUE",
  "FALSE","NOT","AND","OR","XOR","MOD","CONSTANT","RETAIN","INITIAL","AT",
].join("|");

const TY = [
  "REAL","LREAL","INT","DINT","SINT","UINT","UDINT","USINT","BOOL","BYTE",
  "WORD","DWORD","TIME","DATE","STRING","TON","TOF","TP","R_TRIG","F_TRIG",
  "CTU","CTD","LIMIT","MIN","MAX","ABS","SEL","TO_INT",
].join("|");

const MASTER = new RegExp(
  "(\\/\\/[^\\n]*)" + // 1  строковый комментарий
    "|(\\(\\*[\\s\\S]*?\\*\\))" + // 2  блочный комментарий
    "|('[^'\\n]*')" + // 3  строковый литерал
    "|(\\{[^\\n}]*\\})" + // 4  {pragma}
    "|\\b(" + KW + ")\\b" + // 5  ключевые слова
    "|\\b(" + TY + ")\\b" + // 6  типы
    "|(T#[0-9]+(?:MS|S|M|H|D)?)" + // 7  литерал времени
    "|(\\b[0-9]+(?:\\.[0-9]+)?\\b)", // 8  числа
  "g"
);

const CLS = [
  "", "com", "com", "str", "prag", "kw", "ty", "num", "num",
];
const STYLE: Record<string, string> = {
  com: "italic text-[#71917c]",
  str: "text-[#e2b46b]",
  prag: "text-[#8fa0b5]",
  kw: "text-[#7ab0ff]",
  ty: "text-[#52d3b2]",
  num: "text-[#f0a35e]",
};

interface Tok { t: string; c: string }

function highlight(code: string): Tok[][] {
  const lines: Tok[][] = [[]];
  const push = (text: string, c: string) => {
    const parts = text.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p.length) lines[lines.length - 1].push({ t: p, c });
    });
  };
  let last = 0;
  MASTER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MASTER.exec(code))) {
    if (m.index > last) push(code.slice(last, m.index), "");
    let g = 0;
    for (let i = 1; i <= 8; i++) if (m[i] !== undefined) { g = i; break; }
    push(m[0], CLS[g]);
    last = MASTER.lastIndex;
  }
  push(code.slice(last), "");
  return lines;
}

const KIND_COLOR: Record<string, string> = {
  DUT: "text-[#52d3b2] border-[#52d3b2]/40 bg-[#52d3b2]/10",
  GVL: "text-[#7ab0ff] border-[#7ab0ff]/40 bg-[#7ab0ff]/10",
  FB: "text-amber border-amber/40 bg-amber/10",
  PRG: "text-cy border-cy/40 bg-cy/10",
  DOC: "text-tx-mut border-line bg-ink-750",
};

export default function CodeBrowser() {
  const [idx, setIdx] = useState(4); // по умолчанию — автомат дозирования
  const [copied, setCopied] = useState(false);
  const file = stFiles[idx];

  const lines = useMemo(() => highlight(file.code), [file]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard недоступен — молча */
    }
  };

  return (
    <Reveal>
      <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
        {/* дерево проекта */}
        <div className="panel self-start">
          <div className="panel-head justify-between">
            <span>Проект · Livny</span>
            <span>{stFiles.length} POU</span>
          </div>
          <div className="p-2">
            {stFiles.map((f, i) => (
              <button
                key={f.name}
                onClick={() => setIdx(i)}
                className={`group mb-0.5 flex w-full items-center gap-2.5 rounded-sm border-l-2 px-2.5 py-2 text-left transition-all ${
                  i === idx
                    ? "border-amber bg-ink-700"
                    : "border-transparent hover:border-line hover:bg-ink-800"
                }`}
              >
                <KindIcon kind={f.kind} />
                <span className="min-w-0">
                  <span className={`block truncate font-mono text-[11.5px] ${i === idx ? "text-tx" : "text-tx-mut group-hover:text-tx"}`}>
                    {f.name}
                  </span>
                  <span className="block truncate text-[10.5px] text-tx-dim">{f.title}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-line-soft px-4 py-3 font-mono text-[10.5px] leading-relaxed text-tx-dim">
            {totalLines.toLocaleString("ru-RU")} строк · IEC 61131-3 (ST)
            <br />
            Комментарии — на русском языке
          </div>
        </div>

        {/* просмотрщик */}
        <div className="panel min-w-0">
          <div className="panel-head flex-wrap justify-between gap-y-2">
            <div className="flex items-center gap-3">
              <span className={`rounded-sm border px-1.5 py-0.5 text-[9.5px] tracking-widest ${KIND_COLOR[file.kind]}`}>
                {file.kind}
              </span>
              <span className="text-tx-mut normal-case tracking-normal">{file.desc}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="mr-2 text-tx-dim">{lines.length} стр.</span>
              <button
                onClick={copy}
                className="rounded-sm border border-line bg-ink-800 px-2.5 py-1 font-mono text-[10.5px] tracking-wide text-tx-mut transition-colors hover:border-amber/60 hover:text-amber-hi"
              >
                {copied ? "✓ Скопировано" : "Копировать"}
              </button>
              <button
                onClick={() => downloadText(file.name, file.code)}
                className="rounded-sm border border-amber/50 bg-amber/10 px-2.5 py-1 font-mono text-[10.5px] tracking-wide text-amber-hi transition-colors hover:bg-amber/20"
              >
                Скачать {file.name.endsWith(".md") ? ".md" : ".st"}
              </button>
            </div>
          </div>

          <div className="code-scroll max-h-[560px] overflow-auto bg-ink-950/80 py-3">
            <pre className="min-w-max px-0 font-mono text-[12px] leading-[1.62]">
              {lines.map((ln, i) => (
                <div key={i} className="flex hover:bg-ink-800/50">
                  <span className="w-12 flex-none pr-4 text-right text-tx-dim/45 select-none">
                    {i + 1}
                  </span>
                  <span className="pr-6 whitespace-pre">
                    {ln.length === 0
                      ? " "
                      : ln.map((t, j) =>
                          t.c ? (
                            <span key={j} className={STYLE[t.c]}>
                              {t.t}
                            </span>
                          ) : (
                            <span key={j} className="text-[#d5deea]">
                              {t.t}
                            </span>
                          )
                        )}
                  </span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

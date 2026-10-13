"use client";

import { useMemo, useState } from "react";

type StatusTone = "good" | "bad" | "neutral" | "warn";

type LoadRow = {
  loadNo: string;
  material: string;
  lsf: number | null;
  al2o3: number | null;
  cl: number | null;
  moisture: number | null;
};

type ParsedSummary = {
  date: string;
  sectionDateLabel: string;
  materialHauling: {
    nem: number | null;
    isuru: number | null;
    usableHauling: number | null;
    usableHigh: number | null;
    usableBreakBoulders: number | null;
    rejectHandling: number | null;
    overSizeBoulders: number | null;
    rainfall: number | null;
  };
  chemistry: {
    mHaAverage: {
      lsf: number | null;
      al2o3: number | null;
      cl: number | null;
      moisture: number | null;
    };
    overallAverage: {
      lsf: number | null;
      al2o3: number | null;
      cl: number | null;
      moisture: number | null;
    };
  };
  stock: {
    hgl: number | null;
    lgl: number | null;
    fgl: number | null;
    boulders: number | null;
    wetHeap: number | null;
  };
  dispatch: {
    trainMt: number | null;
    trainRakes: number | null;
    roadMt: number | null;
    roadTrucks: number | null;
  };
  hglLoads: LoadRow[];
  hglAverage: {
    lsf: number | null;
    al2o3: number | null;
    cl: number | null;
    moisture: number | null;
  };
  lglAvailable: boolean;
  rawMeal: {
    rm01: number | null;
    rm02: number | null;
  };
  crusher: {
    haulingIn: number | null;
    dispatchedOut: number | null;
  };
};

const SAMPLE_INPUT = `📊 Daily Production & Quality Summary (2026/10/12)
🚛 Material Hauling & Quantity
	NEM: 1,344.81 MT
	ISURU: 2,965.83 MT
	Usable Hauling: 2,100 MT (1,800 MT High & 300 MT Break Boulders)
	Reject Handling: Nil
	Over Size Boulders: 100 MT
	Rainfall: 0.20 mm

🧪 Yesterday Hauling Chemistry (Quarry XRF - 12 Oct 2026)
	MHA Average (Samples 01 to 05): LSF: 122 | Al2O3: 2.39% | Cl-: 0.041% | Moisture: 11.47%
	Overall Average: LSF: 129 | Al2O3: 2.39% | Cl-: 0.041% | Moisture: 11.33%

🏔️ Ramp Stock Inventory Status
	HGL: 69,272 MT
	LGL: 48,563 MT
	FGL: 0 MT
	Boulders: 10,031 MT
	Wet Heap: 3,950 MT

🚚 Dispatch Summary & Quality
	Train Dispatch: 2,284 MT (04 Rakes)
	Road Dispatch: 712.18 MT (46 Trucks)

HGL / SM Loads Details (LN-39 MHB, LN-40 MHF, LN-41 MHB, LN-42 MHB):
	LN-39 (MHB): LSF: 145.92 | Al2O3: 2.24% | Cl-: 0.037% | Moisture: 7.90%
	LN-40 (MHF): LSF: 140.49 | Al2O3: 2.10% | Cl-: 0.036% | Moisture: 8.50%
	LN-41 (MHB): LSF: 135.50 | Al2O3: 2.29% | Cl-: 0.035% | Moisture: 8.80%
	LN-42 (MHB): LSF: 131.55 | Al2O3: 2.50% | Cl-: 0.036% | Moisture: 8.40%
	Average LSF: 138.37
	Al2O3 Average: 2.41%
	Cl- Average: 0.036%
	Load Moisture Average: 8.40%

LGL Load Details:
	No LGL Loads Dispatched

⚙️ Raw Meal Shift Average Std Check
	RM 01 Shift Avg Std: 3.48
	RM 02 Shift Avg Std: 3.65

🏭 Quarry Crusher Status
	Hauling (In): 300 MT
	Dispatched (Out): Nil`;

const numberFromText = (input: string): number | null => {
  const clean = input.replace(/,/g, "").trim();
  if (!clean || /^nil$/i.test(clean) || /^n\/a$/i.test(clean)) return 0;
  const match = clean.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const formatNumber = (value: number | null, digits = 2) => {
  if (value === null || Number.isNaN(value)) return "-";
  const decimals = Number.isInteger(value) ? 0 : digits;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
};

const formatPercent = (value: number | null, digits = 3) => {
  if (value === null) return "-";
  return `${value.toFixed(digits)}%`;
};

const statusBadge = (tone: StatusTone) => {
  switch (tone) {
    case "good":
      return "bg-emerald-600 text-white";
    case "bad":
      return "bg-red-600 text-white";
    case "warn":
      return "bg-amber-500 text-white";
    default:
      return "bg-slate-200 text-slate-800";
  }
};

const getUsableStatus = (value: number | null): StatusTone => {
  if (value === null) return "neutral";
  return value >= 4500 ? "good" : "bad";
};

const getLsfStatus = (value: number | null): StatusTone => {
  if (value === null) return "neutral";
  return value >= 115 && value <= 145 ? "good" : "bad";
};

const getClStatus = (value: number | null): StatusTone => {
  if (value === null) return "neutral";
  return value <= 0.04 ? "good" : "bad";
};

const getMoistureStatus = (value: number | null): StatusTone => {
  if (value === null) return "neutral";
  return value <= 7 ? "good" : "bad";
};

const getStockStatus = (value: number | null, target: number): StatusTone => {
  if (value === null) return "neutral";
  return value >= target ? "good" : "bad";
};

const getStdStatus = (value: number | null): StatusTone => {
  if (value === null) return "neutral";
  return value <= 6 ? "good" : "bad";
};

function parseLoadRows(input: string): LoadRow[] {
  const rows = Array.from(
    input.matchAll(
      /(LN-\d+)\s*\(([^)]+)\)\s*:\s*LSF\s*:\s*([\d.]+)\s*\|\s*Al2O3\s*:\s*([\d.]+)%\s*\|\s*Cl-\s*:\s*([\d.]+)%\s*\|\s*Moisture\s*:\s*([\d.]+)%/gi,
    ),
  );

  return rows.map((match) => ({
    loadNo: match[1],
    material: match[2],
    lsf: numberFromText(match[3]),
    al2o3: numberFromText(match[4]),
    cl: numberFromText(match[5]),
    moisture: numberFromText(match[6]),
  }));
}

function parseSummary(input: string): ParsedSummary {
  const date = input.match(/Summary\s*\((\d{4}\/\d{2}\/\d{2})\)/i)?.[1] ?? "YYYY/MM/DD";
  const chemistryDate = input.match(/Yesterday Hauling Chemistry\s*\(([^)]+)\)/i)?.[1] ?? "Quarry XRF";

  const hglLoads = parseLoadRows(input);

  return {
    date,
    sectionDateLabel: chemistryDate,
    materialHauling: {
      nem: numberFromText(input.match(/NEM:\s*([\d,.]+)/i)?.[1] ?? ""),
      isuru: numberFromText(input.match(/ISURU:\s*([\d,.]+)/i)?.[1] ?? ""),
      usableHauling: numberFromText(input.match(/Usable Hauling:\s*([\d,.]+)/i)?.[1] ?? ""),
      usableHigh: numberFromText(input.match(/Usable Hauling:[^(]*\(([\d,.]+)\s*MT\s*High/i)?.[1] ?? ""),
      usableBreakBoulders: numberFromText(input.match(/&\s*([\d,.]+)\s*MT\s*Break Boulders/i)?.[1] ?? ""),
      rejectHandling: numberFromText(input.match(/Reject Handling:\s*([^\n]+)/i)?.[1] ?? ""),
      overSizeBoulders: numberFromText(input.match(/Over Size Boulders:\s*([\d,.]+)/i)?.[1] ?? ""),
      rainfall: numberFromText(input.match(/Rainfall:\s*([\d,.]+)/i)?.[1] ?? ""),
    },
    chemistry: {
      mHaAverage: {
        lsf: numberFromText(input.match(/MHA Average[^\n]*LSF:\s*([\d.]+)/i)?.[1] ?? ""),
        al2o3: numberFromText(input.match(/MHA Average[^\n]*Al2O3:\s*([\d.]+)%/i)?.[1] ?? ""),
        cl: numberFromText(input.match(/MHA Average[^\n]*Cl-:\s*([\d.]+)%/i)?.[1] ?? ""),
        moisture: numberFromText(input.match(/MHA Average[^\n]*Moisture:\s*([\d.]+)%/i)?.[1] ?? ""),
      },
      overallAverage: {
        lsf: numberFromText(input.match(/Overall Average[^\n]*LSF:\s*([\d.]+)/i)?.[1] ?? ""),
        al2o3: numberFromText(input.match(/Overall Average[^\n]*Al2O3:\s*([\d.]+)%/i)?.[1] ?? ""),
        cl: numberFromText(input.match(/Overall Average[^\n]*Cl-:\s*([\d.]+)%/i)?.[1] ?? ""),
        moisture: numberFromText(input.match(/Overall Average[^\n]*Moisture:\s*([\d.]+)%/i)?.[1] ?? ""),
      },
    },
    stock: {
      hgl: numberFromText(input.match(/HGL:\s*([\d,.]+)/i)?.[1] ?? ""),
      lgl: numberFromText(input.match(/LGL:\s*([\d,.]+)/i)?.[1] ?? ""),
      fgl: numberFromText(input.match(/FGL:\s*([\d,.]+)/i)?.[1] ?? ""),
      boulders: numberFromText(input.match(/Boulders:\s*([\d,.]+)/i)?.[1] ?? ""),
      wetHeap: numberFromText(input.match(/Wet Heap:\s*([\d,.]+)/i)?.[1] ?? ""),
    },
    dispatch: {
      trainMt: numberFromText(input.match(/Train Dispatch:\s*([\d,.]+)/i)?.[1] ?? ""),
      trainRakes: numberFromText(input.match(/Train Dispatch:[^(]*\((\d+)\s*Rakes\)/i)?.[1] ?? ""),
      roadMt: numberFromText(input.match(/Road Dispatch:\s*([\d,.]+)/i)?.[1] ?? ""),
      roadTrucks: numberFromText(input.match(/Road Dispatch:[^(]*\((\d+)\s*Trucks\)/i)?.[1] ?? ""),
    },
    hglLoads,
    hglAverage: {
      lsf: numberFromText(input.match(/Average LSF:\s*([\d.]+)/i)?.[1] ?? ""),
      al2o3: numberFromText(input.match(/Al2O3 Average:\s*([\d.]+)%/i)?.[1] ?? ""),
      cl: numberFromText(input.match(/Cl- Average:\s*([\d.]+)%/i)?.[1] ?? ""),
      moisture: numberFromText(input.match(/Load Moisture Average:\s*([\d.]+)%/i)?.[1] ?? ""),
    },
    lglAvailable: !/No LGL Loads Dispatched/i.test(input),
    rawMeal: {
      rm01: numberFromText(input.match(/RM\s*0?1\s*Shift Avg Std:\s*([\d.]+)/i)?.[1] ?? ""),
      rm02: numberFromText(input.match(/RM\s*0?2\s*Shift Avg Std:\s*([\d.]+)/i)?.[1] ?? ""),
    },
    crusher: {
      haulingIn: numberFromText(input.match(/Hauling \(In\):\s*([^\n]+)/i)?.[1] ?? ""),
      dispatchedOut: numberFromText(input.match(/Dispatched \(Out\):\s*([^\n]+)/i)?.[1] ?? ""),
    },
  };
}

function SectionHeader({ title, subtitle, className = "" }: { title: string; subtitle?: string; className?: string }) {
  return (
    <div className={`rounded-t-2xl px-5 py-3 text-white ${className}`}>
      <h2 className="text-xl font-black uppercase tracking-wide">{title}</h2>
      {subtitle ? <p className="text-sm font-medium text-white/85">{subtitle}</p> : null}
    </div>
  );
}

function StatBadge({ label, value, unit, tone, footer }: { label: string; value: string; unit?: string; tone?: StatusTone; footer?: string }) {
  return (
    <div className="flex min-h-40 flex-col rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
      <p className="text-center text-sm font-bold uppercase tracking-wide text-slate-700">{label}</p>
      <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
        <div className={`text-4xl font-black ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-slate-900" : "text-slate-900"}`}>
          {value}
        </div>
        {unit ? <div className="mt-1 text-lg font-bold text-slate-700">{unit}</div> : null}
        {footer ? <div className="mt-3 text-sm font-medium text-slate-600">{footer}</div> : null}
      </div>
    </div>
  );
}

function StatusPill({ tone, text }: { tone: StatusTone; text: string }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusBadge(tone)}`}>{text}</span>;
}

export default function HomePage() {
  const [input, setInput] = useState(SAMPLE_INPUT);

  const parsed = useMemo(() => parseSummary(input), [input]);

  const highlights = useMemo(() => {
    const good: string[] = [];
    const bad: string[] = [];

    if (getStockStatus(parsed.stock.hgl, 30000) === "good") {
      good.push(`Ramp stock (HGL) ${formatNumber(parsed.stock.hgl)} MT is above target.`);
    } else {
      bad.push(`Ramp stock (HGL) ${formatNumber(parsed.stock.hgl)} MT is below 30,000 MT target.`);
    }

    if (getClStatus(parsed.hglAverage.cl) === "good") {
      good.push(`Average Cl- ${formatPercent(parsed.hglAverage.cl, 3)} is within target.`);
    } else {
      bad.push(`Average Cl- ${formatPercent(parsed.hglAverage.cl, 3)} exceeded the 0.040% target.`);
    }

    if (getStdStatus(parsed.rawMeal.rm01) === "good" && getStdStatus(parsed.rawMeal.rm02) === "good") {
      good.push("Raw meal shift average standard is within limit for RM 01 and RM 02.");
    } else {
      bad.push("One or more raw meal shift averages are out of standard.");
    }

    if (parsed.dispatch.trainMt) {
      good.push(`Train dispatch reached ${formatNumber(parsed.dispatch.trainMt)} MT (${formatNumber(parsed.dispatch.trainRakes)} rakes).`);
    }

    if (parsed.dispatch.roadMt) {
      good.push(`Road dispatch reached ${formatNumber(parsed.dispatch.roadMt)} MT (${formatNumber(parsed.dispatch.roadTrucks)} trucks).`);
    }

    if (getUsableStatus(parsed.materialHauling.usableHauling) === "bad") {
      bad.push(`Usable hauling ${formatNumber(parsed.materialHauling.usableHauling)} MT is below 4,500 MT target.`);
    }

    if (getLsfStatus(parsed.hglAverage.lsf) === "bad") {
      bad.push(`HGL/SM average LSF ${formatNumber(parsed.hglAverage.lsf)} is outside 115-145 range.`);
    }

    if (getMoistureStatus(parsed.hglAverage.moisture) === "bad") {
      bad.push(`Load moisture average ${formatPercent(parsed.hglAverage.moisture, 2)} is above 7.00% target.`);
    }

    if (parsed.chemistry.overallAverage.moisture && parsed.chemistry.overallAverage.moisture > 10) {
      bad.push(`Yesterday hauling moisture ${formatPercent(parsed.chemistry.overallAverage.moisture, 2)} remained high.`);
    }

    if ((parsed.materialHauling.rainfall ?? 0) > 0) {
      bad.push(`Rainfall ${formatNumber(parsed.materialHauling.rainfall)} mm may have affected moisture levels.`);
    }

    return { good: good.slice(0, 5), bad: bad.slice(0, 5) };
  }, [parsed]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_28%,#f8fafc_55%,#e2e8f0_100%)] px-4 py-6 text-slate-900 lg:px-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-2xl backdrop-blur print:hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Dashboard Generator</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Daily Production &amp; Quality Summary to Dashboard</h1>
              <p className="mt-2 text-sm text-slate-600">
                Paste your written daily summary in the same format, and the page will instantly convert it into a presentation-style dashboard. Use the download button to save it like a dashboard photo.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setInput(SAMPLE_INPUT)}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow hover:bg-slate-800"
              >
                Load Sample
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-sky-500"
              >
                Save / Print Dashboard
              </button>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="mt-5 min-h-[320px] w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400"
            placeholder="Paste your daily summary here..."
          />
        </section>

        <section id="dashboard" className="overflow-hidden rounded-[2rem] border-4 border-white bg-[#e8f4fb] shadow-[0_30px_80px_rgba(15,23,42,0.18)] print:rounded-none print:border-0 print:shadow-none">
          <div className="grid gap-0 bg-[#e8f4fb]">
            <header className="flex flex-col gap-4 bg-[linear-gradient(135deg,#0f4c81_0%,#154c7e_35%,#173f67_100%)] px-6 py-5 text-white lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="hidden h-20 w-28 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-[linear-gradient(135deg,#b45309,#f59e0b)] text-5xl shadow-inner sm:flex">
                  🚜
                </div>
                <div>
                  <h1 className="text-3xl font-black uppercase tracking-wide sm:text-5xl">Daily Production &amp; Quality Summary</h1>
                  <p className="mt-1 text-xl font-medium text-white/90 sm:text-3xl">Quarry Operations</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-3 self-start rounded-2xl bg-red-700 px-5 py-4 text-2xl font-black shadow-lg sm:text-4xl lg:self-center">
                <span className="text-3xl sm:text-4xl">📅</span>
                <span>{parsed.date}</span>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[2.4fr_1fr]">
              <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white/60">
                <SectionHeader title="Material Hauling & Quantity" className="bg-[linear-gradient(90deg,#0d6ea8,#9bd3f3)]" />
                <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-6">
                  <StatBadge label="NEM" value={formatNumber(parsed.materialHauling.nem)} unit="MT" />
                  <StatBadge label="ISURU" value={formatNumber(parsed.materialHauling.isuru)} unit="MT" />
                  <div className="flex min-h-40 flex-col rounded-2xl border border-green-100 bg-[linear-gradient(180deg,#eaffea,#ffffff)] p-4 shadow-sm">
                    <p className="text-center text-sm font-bold uppercase tracking-wide text-slate-700">Usable Hauling</p>
                    <div className="mt-2 text-center text-3xl">🪨</div>
                    <div className="mt-1 text-center text-4xl font-black text-red-600">{formatNumber(parsed.materialHauling.usableHauling)}</div>
                    <div className="text-center text-lg font-bold text-slate-700">MT</div>
                    <div className="mt-2 text-center text-xs font-medium text-slate-600">Target ≥ 4,500 MT</div>
                    <div className="mt-3 flex justify-center">
                      <StatusPill
                        tone={getUsableStatus(parsed.materialHauling.usableHauling)}
                        text={getUsableStatus(parsed.materialHauling.usableHauling) === "good" ? "In Target" : "Out of Target"}
                      />
                    </div>
                  </div>
                  <StatBadge label="Reject Handling" value={formatNumber(parsed.materialHauling.rejectHandling)} unit="MT" />
                  <StatBadge label="Over Size Boulders" value={formatNumber(parsed.materialHauling.overSizeBoulders)} unit="MT" />
                  <StatBadge label="Rainfall" value={formatNumber(parsed.materialHauling.rainfall)} unit="mm" />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-cyan-300 bg-white/60">
                <SectionHeader title="Yesterday Hauling Chemistry" subtitle={parsed.sectionDateLabel} className="bg-[linear-gradient(90deg,#045b7c,#0d6f95)]" />
                <div className="p-3">
                  <table className="w-full border-collapse overflow-hidden rounded-xl text-sm">
                    <thead>
                      <tr className="bg-slate-200 text-left text-slate-800">
                        <th className="border border-slate-300 px-3 py-2 font-bold">Parameter</th>
                        <th className="border border-slate-300 px-3 py-2 font-bold">MHA Avg</th>
                        <th className="border border-slate-300 px-3 py-2 font-bold">Overall Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["LSF", formatNumber(parsed.chemistry.mHaAverage.lsf), formatNumber(parsed.chemistry.overallAverage.lsf)],
                        ["Al₂O₃ (%)", formatPercent(parsed.chemistry.mHaAverage.al2o3, 2), formatPercent(parsed.chemistry.overallAverage.al2o3, 2)],
                        ["Cl⁻ (%)", formatPercent(parsed.chemistry.mHaAverage.cl, 3), formatPercent(parsed.chemistry.overallAverage.cl, 3)],
                        ["Moisture (%)", formatPercent(parsed.chemistry.mHaAverage.moisture, 2), formatPercent(parsed.chemistry.overallAverage.moisture, 2)],
                      ].map((row) => (
                        <tr key={row[0]} className="bg-white/80">
                          <td className="border border-slate-300 px-3 py-2 font-semibold">{row[0]}</td>
                          <td className="border border-slate-300 px-3 py-2">{row[1]}</td>
                          <td className="border border-slate-300 px-3 py-2">{row[2]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-3 lg:grid-cols-[1.7fr_1.2fr_1fr]">
              <div className="overflow-hidden rounded-2xl border border-green-300 bg-white/60">
                <SectionHeader title="Ramp Stock Inventory Status" className="bg-[linear-gradient(90deg,#238636,#52b14f)]" />
                <div className="p-4">
                  <div className="grid h-64 grid-cols-5 items-end gap-4 rounded-xl border border-slate-200 bg-white px-4 pb-8 pt-4">
                    {[
                      { key: "HGL", value: parsed.stock.hgl, color: "bg-green-600" },
                      { key: "LGL", value: parsed.stock.lgl, color: "bg-sky-500" },
                      { key: "FGL", value: parsed.stock.fgl, color: "bg-slate-400" },
                      { key: "Boulders", value: parsed.stock.boulders, color: "bg-amber-600" },
                      { key: "Wet Heap", value: parsed.stock.wetHeap, color: "bg-fuchsia-500" },
                    ].map((item) => {
                      const max = Math.max(
                        parsed.stock.hgl ?? 0,
                        parsed.stock.lgl ?? 0,
                        parsed.stock.fgl ?? 0,
                        parsed.stock.boulders ?? 0,
                        parsed.stock.wetHeap ?? 0,
                        1,
                      );
                      const height = `${Math.max(((item.value ?? 0) / max) * 100, 2)}%`;

                      return (
                        <div key={item.key} className="flex h-full flex-col items-center justify-end gap-2">
                          <div className="text-center text-sm font-black text-slate-900">{formatNumber(item.value)}</div>
                          <div className={`w-full rounded-t-lg ${item.color}`} style={{ height }} />
                          <div className="text-center text-sm font-bold text-slate-700">{item.key}</div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">Target ≥ 30,000 MT for HGL</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-blue-300 bg-white/60">
                <SectionHeader title="Dispatch Summary & Quality" className="bg-[linear-gradient(90deg,#114b7a,#76a9d2)]" />
                <div className="grid gap-3 p-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-violet-200 bg-[linear-gradient(180deg,#f2e7ff,#ffffff)] p-5 text-center">
                    <div className="text-5xl">🚆</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">Train Dispatch</div>
                    <div className="mt-2 text-5xl font-black text-slate-900">{formatNumber(parsed.dispatch.trainMt)}</div>
                    <div className="text-xl font-bold text-slate-700">MT</div>
                    <div className="mt-2 text-lg text-slate-700">({formatNumber(parsed.dispatch.trainRakes)} Rakes)</div>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-[linear-gradient(180deg,#fff1d9,#ffffff)] p-5 text-center">
                    <div className="text-5xl">🚚</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">Road Dispatch</div>
                    <div className="mt-2 text-5xl font-black text-slate-900">{formatNumber(parsed.dispatch.roadMt)}</div>
                    <div className="text-xl font-bold text-slate-700">MT</div>
                    <div className="mt-2 text-lg text-slate-700">({formatNumber(parsed.dispatch.roadTrucks)} Trucks)</div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-amber-300 bg-white/60">
                <SectionHeader title="Quarry Crusher Status" className="bg-[linear-gradient(90deg,#7a4a12,#9a6a36)]" />
                <div className="grid h-full grid-cols-2 gap-0 p-3">
                  <div className="flex flex-col items-center justify-center border-r border-slate-300 rounded-l-xl bg-white p-5 text-center">
                    <div className="text-5xl">🚜</div>
                    <div className="mt-2 text-2xl font-black">Hauling (In)</div>
                    <div className="mt-2 text-5xl font-black">{formatNumber(parsed.crusher.haulingIn)}</div>
                    <div className="text-xl font-bold text-slate-700">MT</div>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-r-xl bg-white p-5 text-center">
                    <div className="text-5xl">🪨</div>
                    <div className="mt-2 text-2xl font-black">Dispatched (Out)</div>
                    <div className="mt-2 text-5xl font-black">{formatNumber(parsed.crusher.dispatchedOut)}</div>
                    <div className="text-xl font-bold text-slate-700">MT</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[2.3fr_1fr]">
              <div className="overflow-hidden rounded-2xl border border-cyan-300 bg-white/60">
                <SectionHeader
                  title="HGL / SM Loads Details"
                  subtitle={parsed.hglLoads.length ? parsed.hglLoads.map((row) => `${row.loadNo} ${row.material}`).join(", ") : "No load details parsed"}
                  className="bg-[linear-gradient(90deg,#0b6fa1,#51b6d9)]"
                />
                <div className="overflow-x-auto p-3">
                  <table className="w-full border-collapse overflow-hidden rounded-xl text-sm">
                    <thead>
                      <tr className="bg-slate-200 text-slate-900">
                        <th className="border border-slate-300 px-3 py-2">Load No.</th>
                        <th className="border border-slate-300 px-3 py-2">Material</th>
                        <th className="border border-slate-300 px-3 py-2">LSF</th>
                        <th className="border border-slate-300 px-3 py-2">Status</th>
                        <th className="border border-slate-300 px-3 py-2">Al₂O₃ (%)</th>
                        <th className="border border-slate-300 px-3 py-2">Cl⁻ (%)</th>
                        <th className="border border-slate-300 px-3 py-2">Moisture (%)</th>
                        <th className="border border-slate-300 px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.hglLoads.map((row) => (
                        <tr key={row.loadNo} className="bg-white/85 text-center">
                          <td className="border border-slate-300 px-3 py-2 font-bold">{row.loadNo}</td>
                          <td className="border border-slate-300 px-3 py-2 font-semibold">{row.material}</td>
                          <td className={`border border-slate-300 px-3 py-2 font-black ${getLsfStatus(row.lsf) === "bad" ? "bg-red-50 text-red-600" : "bg-green-50 text-emerald-700"}`}>
                            {formatNumber(row.lsf)}
                          </td>
                          <td className="border border-slate-300 px-3 py-2">
                            <StatusPill tone={getLsfStatus(row.lsf)} text={getLsfStatus(row.lsf) === "good" ? "In Target" : "Out of Target"} />
                          </td>
                          <td className="border border-slate-300 px-3 py-2">{formatPercent(row.al2o3, 2)}</td>
                          <td className="border border-slate-300 px-3 py-2">{formatPercent(row.cl, 3)}</td>
                          <td className={`border border-slate-300 px-3 py-2 font-black ${getMoistureStatus(row.moisture) === "bad" ? "bg-red-50 text-red-600" : "bg-green-50 text-emerald-700"}`}>
                            {formatPercent(row.moisture, 2)}
                          </td>
                          <td className="border border-slate-300 px-3 py-2">
                            <StatusPill tone={getMoistureStatus(row.moisture)} text={getMoistureStatus(row.moisture) === "good" ? "In Target" : "Out of Target"} />
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-sky-50 text-center font-bold">
                        <td className="border border-slate-300 px-3 py-2">Average</td>
                        <td className="border border-slate-300 px-3 py-2">-</td>
                        <td className="border border-slate-300 px-3 py-2">{formatNumber(parsed.hglAverage.lsf)}</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <StatusPill tone={getLsfStatus(parsed.hglAverage.lsf)} text={getLsfStatus(parsed.hglAverage.lsf) === "good" ? "In Target" : "Out of Target"} />
                        </td>
                        <td className="border border-slate-300 px-3 py-2">{formatPercent(parsed.hglAverage.al2o3, 2)}</td>
                        <td className="border border-slate-300 px-3 py-2">{formatPercent(parsed.hglAverage.cl, 3)}</td>
                        <td className="border border-slate-300 px-3 py-2">{formatPercent(parsed.hglAverage.moisture, 2)}</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <StatusPill tone={getMoistureStatus(parsed.hglAverage.moisture)} text={getMoistureStatus(parsed.hglAverage.moisture) === "good" ? "In Target" : "Out of Target"} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-cyan-300 bg-white/60">
                <SectionHeader title="LGL Load Details" subtitle={parsed.lglAvailable ? "Parsed from input" : "No LGL Loads Dispatched"} className="bg-[linear-gradient(90deg,#1597b5,#69c9d0)]" />
                <div className="p-3">
                  <table className="w-full border-collapse rounded-xl text-sm">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="border border-slate-300 px-3 py-2 text-left">Parameter</th>
                        <th className="border border-slate-300 px-3 py-2 text-left">Value</th>
                        <th className="border border-slate-300 px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white/85">
                        <td className="border border-slate-300 px-3 py-2 font-semibold">LGL Loads</td>
                        <td className="border border-slate-300 px-3 py-2">{parsed.lglAvailable ? "Available in text" : "No loads dispatched"}</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <StatusPill tone={parsed.lglAvailable ? "good" : "neutral"} text={parsed.lglAvailable ? "Available" : "No Data"} />
                        </td>
                      </tr>
                      <tr className="bg-white/85">
                        <td className="border border-slate-300 px-3 py-2 font-semibold">Average Cl⁻</td>
                        <td className="border border-slate-300 px-3 py-2">{formatPercent(parsed.hglAverage.cl, 3)}</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <StatusPill tone={getClStatus(parsed.hglAverage.cl)} text={getClStatus(parsed.hglAverage.cl) === "good" ? "In Target" : "Out of Target"} />
                        </td>
                      </tr>
                      <tr className="bg-white/85">
                        <td className="border border-slate-300 px-3 py-2 font-semibold">Average Moisture</td>
                        <td className="border border-slate-300 px-3 py-2">{formatPercent(parsed.hglAverage.moisture, 2)}</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <StatusPill tone={getMoistureStatus(parsed.hglAverage.moisture)} text={getMoistureStatus(parsed.hglAverage.moisture) === "good" ? "In Target" : "Out of Target"} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[1.1fr_1.6fr]">
              <div className="overflow-hidden rounded-2xl border border-cyan-300 bg-white/60">
                <SectionHeader title="Raw Meal Shift Average Std Check" className="bg-[linear-gradient(90deg,#127aa0,#2d93b5)]" />
                <div className="p-3">
                  <table className="w-full border-collapse rounded-xl text-sm">
                    <thead>
                      <tr className="bg-slate-200 text-left">
                        <th className="border border-slate-300 px-3 py-2">Raw Meal</th>
                        <th className="border border-slate-300 px-3 py-2">Shift Avg Std</th>
                        <th className="border border-slate-300 px-3 py-2">Target</th>
                        <th className="border border-slate-300 px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["RM 01", parsed.rawMeal.rm01],
                        ["RM 02", parsed.rawMeal.rm02],
                      ].map(([name, value]) => (
                        <tr key={String(name)} className="bg-white/85">
                          <td className="border border-slate-300 px-3 py-3 font-bold">{name}</td>
                          <td className="border border-slate-300 px-3 py-3">{formatNumber(value as number | null)}</td>
                          <td className="border border-slate-300 px-3 py-3">≤ 6.0</td>
                          <td className="border border-slate-300 px-3 py-3">
                            <StatusPill tone={getStdStatus(value as number | null)} text={getStdStatus(value as number | null) === "good" ? "Within Standard" : "Out of Standard"} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-cyan-300 bg-white/60">
                <SectionHeader title="Key Highlights" className="bg-[linear-gradient(90deg,#1684ae,#409dc2)]" />
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <div className="space-y-3 md:border-r md:border-slate-300 md:pr-4">
                    {highlights.good.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm text-slate-800">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">✓</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3 md:pl-2">
                    {highlights.bad.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm text-slate-800">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">!</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

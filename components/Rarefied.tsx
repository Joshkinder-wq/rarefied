"use client";

import React, { useState, useMemo, useRef } from "react";
import { toPng } from "html-to-image";

// ============================================================
// PERCENTILE LOOKUP TABLES
// Sources: ATO Taxation Statistics 2022-23, ABS Employee
// Earnings Aug 2025, ABS Survey of Income & Housing 2021-22,
// ABS National Health Survey (height), van den Hoek et al. 2024
// (J Sci Med Sport, n=809,986 powerlifters), Natsal-3 / GSS for
// sexual frequency, Cooper Institute / general race data for 5K.
// ============================================================

const interp = (table: number[][], x: number) => {
  if (x <= table[0][0]) return table[0][1];
  if (x >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [v1, p1] = table[i];
    const [v2, p2] = table[i + 1];
    if (x >= v1 && x <= v2) {
      const ratio = (x - v1) / (v2 - v1);
      return p1 + ratio * (p2 - p1);
    }
  }
  return 50;
};

const incomeAU = [
  [20000, 10], [40000, 25], [60000, 40], [80000, 55],
  [100000, 68], [130000, 80], [160000, 88], [200000, 93],
  [260000, 97], [350000, 99], [500000, 99.5], [1000000, 99.9],
];

const incomeGlobal = [
  [2000, 30], [5000, 50], [10000, 65], [20000, 78],
  [35000, 87], [55000, 93], [80000, 96], [120000, 98.5],
  [200000, 99.5], [500000, 99.9],
];

const wealthAU = (age: number) => {
  if (age < 35) return [
    [0, 5], [20000, 20], [80000, 40], [164000, 50],
    [350000, 70], [600000, 85], [1000000, 93], [2000000, 98], [5000000, 99.5],
  ];
  if (age < 45) return [
    [0, 5], [50000, 15], [200000, 35], [380000, 50],
    [700000, 70], [1200000, 85], [2000000, 93], [4000000, 98], [10000000, 99.5],
  ];
  if (age < 55) return [
    [0, 5], [100000, 15], [350000, 35], [610000, 50],
    [1000000, 68], [1800000, 83], [3000000, 92], [6000000, 98], [15000000, 99.5],
  ];
  if (age < 65) return [
    [0, 5], [150000, 15], [500000, 35], [880000, 50],
    [1500000, 68], [2500000, 83], [4000000, 92], [8000000, 98], [20000000, 99.5],
  ];
  return [
    [0, 5], [150000, 15], [450000, 35], [850000, 50],
    [1400000, 68], [2300000, 83], [3800000, 92], [7500000, 98], [18000000, 99.5],
  ];
};

const wealthGlobal = [
  [0, 10], [1000, 25], [10000, 50], [50000, 75],
  [150000, 88], [500000, 96], [1000000, 98.8], [10000000, 99.9],
];

const heightPercentile = (cm: number, region: string) => {
  const mean = region === "AU" ? 178 : 174;
  const sd = 7;
  const z = (cm - mean) / sd;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p * 100;
};

const liftPercentile = (lift: number, bw: number, type: string) => {
  if (!lift || !bw) return null;
  const ratio = lift / bw;
  const tables: Record<string, number[][]> = {
    bench: [[0, 5], [0.4, 15], [0.6, 25], [0.8, 40], [1.0, 55], [1.2, 70], [1.4, 82], [1.6, 90], [1.8, 95], [2.0, 98], [2.5, 99.7]],
    squat: [[0, 5], [0.6, 15], [0.9, 28], [1.2, 45], [1.5, 60], [1.8, 75], [2.1, 86], [2.4, 93], [2.7, 97], [3.0, 99], [3.5, 99.8]],
    deadlift: [[0, 5], [0.8, 15], [1.2, 28], [1.5, 42], [1.8, 55], [2.1, 70], [2.4, 82], [2.7, 90], [3.0, 95], [3.3, 98], [3.8, 99.7]],
  };
  return interp(tables[type], ratio);
};

const fiveKPercentile = (seconds: number) => {
  if (!seconds) return null;
  const table = [[900, 99.5], [1080, 97], [1200, 92], [1380, 82], [1500, 70], [1620, 55], [1800, 38], [2100, 22], [2400, 12], [3600, 3]];
  return interp(table, seconds);
};

const sexPercentile = (perWeek: number, age: number) => {
  if (perWeek == null) return null;
  let table;
  if (age < 30) table = [[0, 22], [0.25, 38], [0.5, 52], [1, 65], [2, 82], [3, 92], [4, 96], [5, 98], [7, 99.5]];
  else if (age < 45) table = [[0, 18], [0.25, 32], [0.5, 48], [1, 62], [2, 80], [3, 91], [4, 96], [5, 98.5], [7, 99.7]];
  else if (age < 60) table = [[0, 25], [0.25, 42], [0.5, 58], [1, 73], [2, 88], [3, 95], [4, 98], [5, 99.3], [7, 99.8]];
  else table = [[0, 35], [0.25, 55], [0.5, 70], [1, 85], [2, 95], [3, 98.5], [4, 99.5], [5, 99.8]];
  return interp(table, perWeek);
};

const langPercentile = (n: number) => interp([[1, 40], [2, 75], [3, 92], [4, 97], [5, 99], [6, 99.7]], n);

const maritalScore = (status: string, age: number) => {
  if (status === "married") return age < 30 ? 80 : age < 40 ? 65 : 55;
  if (status === "defacto") return age < 30 ? 70 : age < 40 ? 55 : 45;
  if (status === "engaged") return 70;
  if (status === "dating") return 50;
  if (status === "single") return age < 30 ? 50 : age < 40 ? 35 : 25;
  if (status === "divorced") return 30;
  return 50;
};

const kidsPercentile = (kids: number, age: number) => {
  if (age < 30) return interp([[0, 25], [1, 75], [2, 92], [3, 98], [4, 99.5]], kids);
  if (age < 40) return interp([[0, 35], [1, 60], [2, 85], [3, 95], [4, 98.5]], kids);
  if (age < 55) return interp([[0, 20], [1, 40], [2, 75], [3, 92], [4, 98]], kids);
  return interp([[0, 18], [1, 35], [2, 70], [3, 90], [4, 97]], kids);
};

const labelFor = (p: number) => {
  if (p >= 99) return "TOP 1%";
  if (p >= 95) return "TOP 5%";
  if (p >= 90) return "TOP 10%";
  if (p >= 75) return "TOP 25%";
  if (p >= 50) return "ABOVE AVERAGE";
  if (p >= 25) return "BELOW MEDIAN";
  return "BOTTOM QUARTILE";
};

const verdictFor = (p: number) => {
  if (p >= 99) return "Rarefied air. You exist on a tail of the curve most men can't see.";
  if (p >= 95) return "An exceptional composite. The room knows when you walk in.";
  if (p >= 90) return "Top decile. You've out-built the vast majority of your peers.";
  if (p >= 75) return "Strong showing. Comfortably in the upper quartile.";
  if (p >= 50) return "Above the median. You're winning more rounds than you're losing.";
  if (p >= 25) return "Middle of the pack. Pick a metric. Move it. Compound.";
  return "There's runway here. Every man on this list started somewhere lower.";
};

export default function Rarefied() {
  const [region, setRegion] = useState("AU");
  const [step, setStep] = useState<"input" | "results" | "truth">("input");
  const [generating, setGenerating] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    age: 35, height: 180, languages: 1, income: 100000, wealth: 200000,
    marital: "defacto", kids: 0, bodyweight: 85, bench: 100, squat: 140,
    deadlift: 180, fivek: 1620, sexWeekly: 1.5,
  });

  const update = (k: string, v: any) => setForm({ ...form, [k]: v });

  const results: any = useMemo(() => {
    const r: any = {};
    r.income = interp(region === "AU" ? incomeAU : incomeGlobal, form.income);
    r.wealth = region === "AU" ? interp(wealthAU(form.age), form.wealth) : interp(wealthGlobal, form.wealth);
    r.height = heightPercentile(form.height, region);
    r.languages = langPercentile(form.languages);
    r.marital = maritalScore(form.marital, form.age);
    r.kids = kidsPercentile(form.kids, form.age);
    r.bench = liftPercentile(form.bench, form.bodyweight, "bench");
    r.squat = liftPercentile(form.squat, form.bodyweight, "squat");
    r.deadlift = liftPercentile(form.deadlift, form.bodyweight, "deadlift");
    r.fivek = fiveKPercentile(form.fivek);
    r.sex = sexPercentile(form.sexWeekly, form.age);
    const weights: Record<string, number> = {
      income: 1.2, wealth: 1.2, height: 0.7, languages: 0.7,
      marital: 0.8, kids: 0.8, bench: 0.7, squat: 0.7,
      deadlift: 0.7, fivek: 0.9, sex: 0.9,
    };
    let total = 0, w = 0;
    Object.keys(weights).forEach((k) => {
      if (r[k] != null) { total += r[k] * weights[k]; w += weights[k]; }
    });
    r.composite = w > 0 ? total / w : 50;
    return r;
  }, [form, region]);

  const formatSec = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];

  const breakdown = [
    { key: "income", name: "Income", value: results.income, hint: region === "AU" ? "AU males" : "Global" },
    { key: "wealth", name: "Net wealth", value: results.wealth, hint: `Age ${form.age}` },
    { key: "height", name: "Height", value: results.height, hint: `${form.height}cm` },
    { key: "languages", name: "Languages", value: results.languages, hint: `${form.languages} spoken` },
    { key: "marital", name: "Partnership", value: results.marital, hint: form.marital },
    { key: "kids", name: "Children", value: results.kids, hint: `${form.kids} kids` },
    { key: "bench", name: "Bench press", value: results.bench, hint: `${(form.bench/form.bodyweight).toFixed(2)}× BW` },
    { key: "squat", name: "Squat", value: results.squat, hint: `${(form.squat/form.bodyweight).toFixed(2)}× BW` },
    { key: "deadlift", name: "Deadlift", value: results.deadlift, hint: `${(form.deadlift/form.bodyweight).toFixed(2)}× BW` },
    { key: "fivek", name: "5km run", value: results.fivek, hint: formatSec(form.fivek) },
    { key: "sex", name: "Bedroom frequency", value: results.sex, hint: `${form.sexWeekly}× per week` },
  ];

  const handleShare = async () => {
    if (!shareCardRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(shareCardRef.current, { cacheBust: true, pixelRatio: 2 });
      // Try native share first (mobile)
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "rarefied.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "My Rarefied Score", text: "Where I sit on the curve." });
          setGenerating(false);
          return;
        }
      }
      // Fallback: download
      const link = document.createElement("a");
      link.download = "rarefied-score.png";
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .rarefied-root {
      min-height: 100vh; background: #0a0908;
      background-image: radial-gradient(at 20% 0%, rgba(180,140,70,0.08) 0px, transparent 50%), radial-gradient(at 80% 100%, rgba(180,140,70,0.04) 0px, transparent 50%);
      color: #e8e3d8; font-family: 'Inter', sans-serif; padding: 24px 16px 80px; position: relative; overflow-x: hidden;
    }
    .rarefied-root::before {
      content: ''; position: fixed; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
      opacity: 0.04; pointer-events: none; z-index: 0;
    }
    .container { max-width: 540px; margin: 0 auto; position: relative; z-index: 1; }
    .header { text-align: center; padding: 24px 0 32px; border-bottom: 1px solid rgba(180,140,70,0.2); margin-bottom: 32px; }
    .eyebrow { font-family: 'JetBrains Mono'; font-size: 10px; letter-spacing: 0.4em; color: #b48c46; text-transform: uppercase; margin-bottom: 12px; }
    .title { font-family: 'Cormorant Garamond'; font-weight: 500; font-size: 56px; letter-spacing: -0.02em; line-height: 0.95; }
    .title em { font-style: italic; color: #d4a464; font-weight: 400; }
    .subtitle { font-family: 'Cormorant Garamond'; font-style: italic; font-size: 15px; color: #8b8478; margin-top: 14px; max-width: 380px; margin-left: auto; margin-right: auto; line-height: 1.5; }
    .region-toggle { display: flex; gap: 0; margin: 24px 0 32px; border: 1px solid rgba(180,140,70,0.3); }
    .region-toggle button { flex: 1; padding: 12px; background: transparent; border: none; color: #8b8478; font-family: 'JetBrains Mono'; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; cursor: pointer; transition: all 0.3s; }
    .region-toggle button.active { background: #b48c46; color: #0a0908; }
    .section { margin-bottom: 28px; }
    .section-label { font-family: 'JetBrains Mono'; font-size: 10px; letter-spacing: 0.3em; color: #b48c46; text-transform: uppercase; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px dashed rgba(180,140,70,0.3); display: flex; justify-content: space-between; }
    .section-label span:last-child { color: #5a5347; }
    .field { margin-bottom: 18px; }
    .field-label { font-family: 'Cormorant Garamond'; font-size: 17px; color: #e8e3d8; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; }
    .field-value { font-family: 'JetBrains Mono'; font-size: 13px; color: #d4a464; }
    input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 1px; background: rgba(180,140,70,0.3); outline: none; cursor: pointer; }
    input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: #d4a464; border-radius: 50%; cursor: pointer; box-shadow: 0 0 0 4px rgba(212,164,100,0.15); }
    input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; background: #d4a464; border-radius: 50%; cursor: pointer; border: none; box-shadow: 0 0 0 4px rgba(212,164,100,0.15); }
    input[type="number"], select { width: 100%; padding: 12px 14px; background: rgba(180,140,70,0.05); border: 1px solid rgba(180,140,70,0.2); color: #e8e3d8; font-family: 'JetBrains Mono'; font-size: 14px; outline: none; }
    input[type="number"]:focus, select:focus { border-color: #b48c46; }
    select { cursor: pointer; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .compute-btn { width: 100%; padding: 18px; margin-top: 24px; background: #d4a464; color: #0a0908; border: none; font-family: 'JetBrains Mono'; font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 600; cursor: pointer; transition: all 0.3s; }
    .compute-btn:hover { background: #e8b878; transform: translateY(-1px); }
    .verdict-card { text-align: center; padding: 40px 24px; border: 1px solid rgba(180,140,70,0.4); background: linear-gradient(180deg, rgba(180,140,70,0.06) 0%, transparent 100%); margin-bottom: 32px; position: relative; }
    .verdict-card::before, .verdict-card::after { content: ''; position: absolute; width: 24px; height: 24px; border: 1px solid #d4a464; }
    .verdict-card::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
    .verdict-card::after { bottom: -1px; right: -1px; border-left: none; border-top: none; }
    .composite-num { font-family: 'Cormorant Garamond'; font-weight: 300; font-size: 96px; line-height: 1; color: #d4a464; letter-spacing: -0.04em; }
    .composite-num span { font-size: 36px; color: #b48c46; vertical-align: super; }
    .composite-label { font-family: 'JetBrains Mono'; font-size: 11px; letter-spacing: 0.4em; color: #d4a464; margin: 16px 0 12px; }
    .verdict-text { font-family: 'Cormorant Garamond'; font-style: italic; font-size: 19px; line-height: 1.4; color: #e8e3d8; max-width: 380px; margin: 0 auto; }
    .breakdown-row { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(180,140,70,0.12); }
    .breakdown-name { font-family: 'Cormorant Garamond'; font-size: 18px; }
    .breakdown-pct { font-family: 'JetBrains Mono'; font-size: 13px; color: #d4a464; min-width: 56px; text-align: right; }
    .breakdown-tag { font-family: 'JetBrains Mono'; font-size: 9px; letter-spacing: 0.2em; color: #5a5347; text-transform: uppercase; min-width: 90px; text-align: right; }
    .breakdown-bar { grid-column: 1 / -1; height: 2px; background: rgba(180,140,70,0.1); margin-top: 8px; position: relative; }
    .breakdown-bar-fill { height: 100%; background: linear-gradient(90deg, #b48c46, #d4a464); }
    .restart-btn { width: 100%; padding: 14px; margin-top: 14px; background: transparent; border: 1px solid rgba(180,140,70,0.3); color: #b48c46; font-family: 'JetBrains Mono'; font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; cursor: pointer; }
    .restart-btn:hover { border-color: #d4a464; color: #d4a464; }
    .share-btn { width: 100%; padding: 18px; margin-top: 24px; background: transparent; border: 1px solid #d4a464; color: #d4a464; font-family: 'JetBrains Mono'; font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 600; cursor: pointer; transition: all 0.3s; }
    .share-btn:hover { background: #d4a464; color: #0a0908; }
    .share-btn:disabled { opacity: 0.5; cursor: wait; }
    .footer-note { font-family: 'Cormorant Garamond'; font-style: italic; font-size: 13px; color: #5a5347; text-align: center; margin-top: 32px; line-height: 1.6; }
    .ornament { text-align: center; color: #b48c46; font-size: 16px; letter-spacing: 0.6em; margin: 24px 0; }

    /* Truth screen — the reveal */
    .truth-eyebrow { font-family: 'JetBrains Mono'; font-size: 10px; letter-spacing: 0.5em; color: #b48c46; text-transform: uppercase; text-align: center; margin-top: 32px; margin-bottom: 24px; }
    .truth-divider { text-align: center; color: #d4a464; font-size: 14px; letter-spacing: 0.6em; margin: 0 0 32px; }
    .truth-body { max-width: 460px; margin: 0 auto; }
    .truth-line { font-family: 'Cormorant Garamond'; font-size: 22px; line-height: 1.5; color: #e8e3d8; text-align: center; margin-bottom: 14px; font-weight: 400; }
    .truth-line em { color: #d4a464; font-style: italic; }
    .truth-emphasis { font-size: 26px; color: #e8b878; font-style: italic; }
    .truth-rule { width: 40px; height: 1px; background: rgba(180,140,70,0.3); margin: 32px auto; }
    .truth-mantra { font-family: 'Cormorant Garamond'; font-size: 32px; font-style: italic; color: #d4a464; text-align: center; margin: 8px 0; letter-spacing: 0.02em; line-height: 1.2; }

    /* Hidden share card — rendered off-screen, captured to PNG */
    .share-card-wrapper { position: fixed; left: -9999px; top: 0; }
    .share-card {
      width: 1080px; height: 1920px; background: #0a0908;
      background-image: radial-gradient(at 30% 20%, rgba(180,140,70,0.18) 0px, transparent 60%), radial-gradient(at 70% 80%, rgba(180,140,70,0.08) 0px, transparent 60%);
      padding: 100px 90px; color: #e8e3d8; font-family: 'Inter', sans-serif;
      display: flex; flex-direction: column; position: relative;
    }
    .share-card::before { content: ''; position: absolute; top: 50px; left: 50px; right: 50px; bottom: 50px; border: 2px solid rgba(180,140,70,0.3); pointer-events: none; }
    .share-card::after { content: ''; position: absolute; top: 70px; left: 70px; right: 70px; bottom: 70px; border: 1px solid rgba(180,140,70,0.5); pointer-events: none; }
    .sc-eyebrow { font-family: 'JetBrains Mono'; font-size: 22px; letter-spacing: 0.6em; color: #b48c46; text-transform: uppercase; text-align: center; margin-bottom: 24px; }
    .sc-title-small { font-family: 'Cormorant Garamond'; font-weight: 500; font-size: 90px; line-height: 0.9; color: #e8e3d8; text-align: center; letter-spacing: -0.02em; }
    .sc-title-small em { font-style: italic; color: #d4a464; font-weight: 400; }

    .sc-score-block { text-align: center; margin: 60px 0 30px; }
    .sc-mini-label { font-family: 'JetBrains Mono'; font-size: 18px; letter-spacing: 0.4em; color: #5a5347; text-transform: uppercase; margin-bottom: 12px; }
    .sc-mini-pct { font-family: 'Cormorant Garamond'; font-weight: 300; font-size: 160px; line-height: 1; color: #d4a464; letter-spacing: -0.04em; }
    .sc-mini-pct span { font-size: 64px; color: #b48c46; vertical-align: super; }
    .sc-mini-tier { font-family: 'JetBrains Mono'; font-size: 22px; letter-spacing: 0.5em; color: #e8b878; text-transform: uppercase; margin-top: 16px; }

    .sc-divider-small { text-align: center; color: #d4a464; font-size: 24px; letter-spacing: 0.6em; margin: 30px 0; }

    .sc-message-block { max-width: 800px; margin: 0 auto; }
    .sc-msg-line { font-family: 'Cormorant Garamond'; font-size: 38px; line-height: 1.45; color: #e8e3d8; text-align: center; margin-bottom: 14px; font-weight: 400; }
    .sc-msg-line em { color: #d4a464; font-style: italic; }
    .sc-msg-emphasis { font-family: 'Cormorant Garamond'; font-style: italic; font-size: 44px; line-height: 1.35; color: #e8b878; text-align: center; margin-bottom: 10px; }
    .sc-msg-rule { width: 60px; height: 1px; background: rgba(180,140,70,0.4); margin: 32px auto; }

    .sc-bottom { margin-top: auto; text-align: center; }
    .sc-mantra { font-family: 'Cormorant Garamond'; font-style: italic; font-size: 56px; color: #d4a464; letter-spacing: 0.01em; line-height: 1.2; }
    .sc-url { font-family: 'JetBrains Mono'; font-size: 24px; letter-spacing: 0.4em; color: #b48c46; }
  `;

  return (
    <>
      <style>{css}</style>

      {/* Hidden share card — only used for image export */}
      <div className="share-card-wrapper" aria-hidden="true">
        <div ref={shareCardRef} className="share-card">
          <div className="sc-eyebrow">An Index of Rarity</div>
          <div className="sc-title-small">Rare<em>fied</em></div>

          <div className="sc-score-block">
            <div className="sc-mini-label">My composite percentile</div>
            <div className="sc-mini-pct">{Math.round(results.composite)}<span>%</span></div>
            <div className="sc-mini-tier">{labelFor(results.composite)}</div>
          </div>

          <div className="sc-divider-small">◆</div>

          <div className="sc-message-block">
            <p className="sc-msg-line"><em>The percentile is real.</em></p>
            <p className="sc-msg-line">The verdict it implies is not.</p>
            <div className="sc-msg-rule" />
            <p className="sc-msg-line">No one on their deathbed regrets their bench press.</p>
            <p className="sc-msg-line">No child needs their father in the top 10%.</p>
            <p className="sc-msg-line">No partner falls in love with a net worth.</p>
            <div className="sc-msg-rule" />
            <p className="sc-msg-emphasis">You are not a composite score.</p>
            <p className="sc-msg-emphasis">You are a man, alive.</p>
          </div>

          <div className="sc-bottom">
            <div className="sc-mantra">Be kind. Be strong. Be here.</div>
            <div className="sc-divider-small" style={{margin: '40px 0 24px'}}>◆ ◆ ◆</div>
            <div className="sc-url">RAREFIED</div>
          </div>
        </div>
      </div>

      <div className="rarefied-root">
        <div className="container">
          <div className="header">
            <div className="eyebrow">An Index of Rarity</div>
            <h1 className="title">Rare<em>fied</em></h1>
            <p className="subtitle">Where do you sit on the curve? An honest reckoning across the metrics that quietly stratify men.</p>
          </div>

          {step === "input" && (
            <>
              <div className="region-toggle">
                <button className={region === "AU" ? "active" : ""} onClick={() => setRegion("AU")}>Australian Men</button>
                <button className={region === "Global" ? "active" : ""} onClick={() => setRegion("Global")}>Global Men</button>
              </div>

              <div className="section">
                <div className="section-label"><span>I. The Particulars</span><span>01</span></div>
                <div className="row">
                  <div className="field">
                    <div className="field-label">Age <span className="field-value">{form.age}</span></div>
                    <input type="range" min="18" max="80" value={form.age} onChange={(e) => update("age", +e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="field-label">Height (cm) <span className="field-value">{form.height}</span></div>
                    <input type="range" min="150" max="210" value={form.height} onChange={(e) => update("height", +e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <div className="field-label">Languages spoken <span className="field-value">{form.languages}</span></div>
                  <input type="range" min="1" max="6" value={form.languages} onChange={(e) => update("languages", +e.target.value)} />
                </div>
              </div>

              <div className="section">
                <div className="section-label"><span>II. Capital</span><span>02</span></div>
                <div className="field">
                  <div className="field-label">Annual income ({region === "AU" ? "AUD" : "USD"}) <span className="field-value">${form.income.toLocaleString()}</span></div>
                  <input type="range" min="0" max="500000" step="5000" value={form.income} onChange={(e) => update("income", +e.target.value)} />
                </div>
                <div className="field">
                  <div className="field-label">Net wealth ({region === "AU" ? "AUD" : "USD"}) <span className="field-value">${form.wealth.toLocaleString()}</span></div>
                  <input type="range" min="-200000" max="5000000" step="10000" value={form.wealth} onChange={(e) => update("wealth", +e.target.value)} />
                </div>
              </div>

              <div className="section">
                <div className="section-label"><span>III. The Home Front</span><span>03</span></div>
                <div className="row">
                  <div className="field">
                    <div className="field-label">Status</div>
                    <select value={form.marital} onChange={(e) => update("marital", e.target.value)}>
                      <option value="single">Single</option>
                      <option value="dating">Dating</option>
                      <option value="defacto">De facto</option>
                      <option value="engaged">Engaged</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                    </select>
                  </div>
                  <div className="field">
                    <div className="field-label">Children <span className="field-value">{form.kids}</span></div>
                    <input type="range" min="0" max="6" value={form.kids} onChange={(e) => update("kids", +e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-label"><span>IV. The Body</span><span>04</span></div>
                <div className="field">
                  <div className="field-label">Bodyweight (kg) <span className="field-value">{form.bodyweight}</span></div>
                  <input type="range" min="50" max="150" value={form.bodyweight} onChange={(e) => update("bodyweight", +e.target.value)} />
                </div>
                <div className="row3">
                  <div className="field">
                    <div className="field-label" style={{fontSize:14}}>Bench (kg)</div>
                    <input type="number" value={form.bench} onChange={(e) => update("bench", +e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="field-label" style={{fontSize:14}}>Squat (kg)</div>
                    <input type="number" value={form.squat} onChange={(e) => update("squat", +e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="field-label" style={{fontSize:14}}>Deadlift (kg)</div>
                    <input type="number" value={form.deadlift} onChange={(e) => update("deadlift", +e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <div className="field-label">5km run time <span className="field-value">{formatSec(form.fivek)}</span></div>
                  <input type="range" min="900" max="3600" step="30" value={form.fivek} onChange={(e) => update("fivek", +e.target.value)} />
                </div>
              </div>

              <div className="section">
                <div className="section-label"><span>V. The Private Life</span><span>05</span></div>
                <div className="field">
                  <div className="field-label">Sexual activity per week <span className="field-value">{form.sexWeekly}×</span></div>
                  <input type="range" min="0" max="7" step="0.25" value={form.sexWeekly} onChange={(e) => update("sexWeekly", +e.target.value)} />
                </div>
              </div>

              <button className="compute-btn" onClick={() => setStep("results")}>Render the Verdict →</button>
              <p className="footer-note">Data anchored in ATO, ABS, NCD-RisC, Natsal-3, and peer-reviewed strength normatives (n=809,986). Directional, not gospel.</p>
            </>
          )}

          {step === "results" && (
            <>
              <div className="verdict-card">
                <div className="composite-label">Composite Percentile</div>
                <div className="composite-num">{Math.round(results.composite)}<span>%</span></div>
                <div className="composite-label" style={{marginTop: 24, color: '#e8b878'}}>{labelFor(results.composite)}</div>
                <div className="ornament">◆ ◆ ◆</div>
                <p className="verdict-text">"{verdictFor(results.composite)}"</p>
              </div>

              <div className="section-label"><span>The Breakdown</span><span>BY METRIC</span></div>

              {breakdown.filter((b) => b.value != null).map((b) => (
                <div key={b.key} className="breakdown-row">
                  <div>
                    <div className="breakdown-name">{b.name}</div>
                    <div style={{fontFamily:'JetBrains Mono', fontSize:10, color:'#5a5347', marginTop:2, letterSpacing:'0.1em'}}>{b.hint}</div>
                  </div>
                  <div className="breakdown-pct">{b.value.toFixed(0)}%</div>
                  <div className="breakdown-tag">{labelFor(b.value)}</div>
                  <div className="breakdown-bar"><div className="breakdown-bar-fill" style={{width: `${Math.min(100, b.value)}%`}} /></div>
                </div>
              ))}

              <button className="share-btn" onClick={() => setStep("truth")}>
                Continue ↓
              </button>
              <button className="restart-btn" onClick={() => setStep("input")}>← Adjust Particulars</button>

              <p className="footer-note">
                Rarefied is a piece of fun. Percentiles are interpolated from public datasets — directionally true, not surgically precise.
              </p>
            </>
          )}

          {step === "truth" && (
            <>
              <div className="truth-eyebrow">A Final Word</div>
              <div className="truth-divider">◆</div>

              <div className="truth-body">
                <p className="truth-line"><em>Congratulations.</em></p>
                <p className="truth-line">You've successfully measured your worth in numbers a stranger compiled.</p>

                <div className="truth-rule" />

                <p className="truth-line">The percentile you just saw is real.</p>
                <p className="truth-line">The verdict it implies is not.</p>

                <div className="truth-rule" />

                <p className="truth-line">If your number was high, you might feel a flicker of pride. If it was low, a sting of shame.</p>
                <p className="truth-line"><em>Both are lies.</em></p>

                <div className="truth-rule" />

                <p className="truth-line">No one on their deathbed regrets their bench press.</p>
                <p className="truth-line">No child needs their father to be in the top 10%.</p>
                <p className="truth-line">No partner falls in love with a net worth.</p>

                <div className="truth-rule" />

                <p className="truth-line truth-emphasis">You are not a composite score.</p>
                <p className="truth-line truth-emphasis">You are a man, alive, on a {dayName}.</p>

                <div className="truth-rule" />

                <p className="truth-line">Put the phone down. Call someone you love. Move your body because it feels good. Earn money to build a life, not to win a game no one can win.</p>

                <div className="truth-divider" style={{margin: '40px 0 32px'}}>◆ ◆ ◆</div>

                <p className="truth-mantra">Be kind.</p>
                <p className="truth-mantra">Be strong.</p>
                <p className="truth-mantra">Be here.</p>
              </div>

              <button className="share-btn" onClick={handleShare} disabled={generating} style={{marginTop: 48}}>
                {generating ? "Generating..." : "Share This With a Mate ↗"}
              </button>
              <button className="restart-btn" onClick={() => { setStep("input"); }}>← Start Over</button>

              <p className="footer-note" style={{marginTop: 24}}>
                If this landed, send it to a man you love. He'll get the same gotcha. That's the point.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

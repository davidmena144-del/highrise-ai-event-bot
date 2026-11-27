import React from "react";
import { ControllerContext } from "../App";
import { Confidence, EventConfig } from "../../core";

const CONF_AR: Record<Confidence, string> = {
  VERIFIED: "مؤكد",
  USER_PROVIDED: "من المستخدم",
  ESTIMATED: "تقديري",
  UNKNOWN: "غير معروف",
};

export function EventSetup() {
  const ctrl = React.useContext(ControllerContext)!;
  const [cfg, setCfg] = React.useState<EventConfig>(() => JSON.parse(JSON.stringify(ctrl.config)));

  const num = (v: string) => Number(v) || 0;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">إعداد الإيفنت</h2>
      <p className="text-sm text-slate-400">
        القيم الافتراضية مبنية على مقالات الدعم الرسمية (المؤكدة) وأدلة المجتمع (التقديرية). عدّلها من اللي
        بتشوفه في اللعبة فعلًا.
      </p>

      <div className="card space-y-3">
        <label className="block">
          <span className="stat-label">مدة الإيفنت (دقائق) — الافتراضي 7 أيام (مؤكد)</span>
          <input className="input" type="number" value={cfg.durationMin}
            onChange={(e) => setCfg({ ...cfg, durationMin: num(e.target.value) })} />
        </label>
        <label className="block">
          <span className="stat-label">فترة تجدد الطاقة (دقائق لكل نقطة) — تقديري: حوالي 4</span>
          <input className="input" type="number" value={cfg.regenIntervalMin}
            onChange={(e) => setCfg({ ...cfg, regenIntervalMin: num(e.target.value) })} />
        </label>
        <label className="block">
          <span className="stat-label">الحد الأقصى للطاقة — تقديري</span>
          <input className="input" type="number" value={cfg.energyCap}
            onChange={(e) => setCfg({ ...cfg, energyCap: num(e.target.value) })} />
        </label>
        <label className="block">
          <span className="stat-label">طاقة البطارية الواحدة — تقديري</span>
          <input className="input" type="number" value={cfg.batteryEnergy}
            onChange={(e) => setCfg({ ...cfg, batteryEnergy: num(e.target.value) })} />
        </label>
      </div>

      <div className="card space-y-3">
        <h3 className="font-bold">المهام</h3>
        {cfg.tasks.map((t, i) => (
          <div key={t.id} className="grid grid-cols-4 gap-2 items-center">
            <input className="input col-span-2" value={t.nameAr}
              onChange={(e) => {
                const tasks = [...cfg.tasks];
                tasks[i] = { ...t, nameAr: e.target.value };
                setCfg({ ...cfg, tasks });
              }} />
            <label className="text-xs text-slate-400">
              طاقة
              <input className="input" type="number" value={t.energyCost}
                onChange={(e) => {
                  const tasks = [...cfg.tasks];
                  tasks[i] = { ...t, energyCost: num(e.target.value) };
                  setCfg({ ...cfg, tasks });
                }} />
            </label>
            <label className="text-xs text-slate-400">
              تذاكر
              <input className="input" type="number" value={t.baseTickets}
                onChange={(e) => {
                  const tasks = [...cfg.tasks];
                  tasks[i] = { ...t, baseTickets: num(e.target.value) };
                  setCfg({ ...cfg, tasks });
                }} />
            </label>
          </div>
        ))}
        <div className="text-xs text-slate-500">
          ثقة القواعد: {cfg.tasks.map((t) => `${t.nameAr}: ${CONF_AR[t.confidence]}`).join(" — ")}
        </div>
      </div>

      <button className="btn-primary w-full" onClick={() => ctrl.setConfig({ ...cfg, confidence: Confidence.USER_PROVIDED })}>
        حفظ وإعادة التهيئة
      </button>
    </div>
  );
}

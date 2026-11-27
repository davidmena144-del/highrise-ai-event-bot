import React from "react";
import { ControllerContext } from "../App";
import { ManualAdapter } from "../../core";

/**
 * Real Event Tracker: manual mode. The user types what they see in the
 * official app; the system recommends, never acts on the real account.
 */
export function RealTracker() {
  const ctrl = React.useContext(ControllerContext)!;
  const [energy, setEnergy] = React.useState("");
  const [batteries, setBatteries] = React.useState("");
  const [tickets, setTickets] = React.useState("");
  const [nowMin, setNowMin] = React.useState("");

  if (ctrl.mode !== "real" || !(ctrl.adapter instanceof ManualAdapter)) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">متابعة الإيفنت الحقيقي</h2>
        <div className="card text-sm">بدّل لوضع "إيفنت حقيقي" من الإعدادات عشان تستخدم المتابعة اليدوية.</div>
      </div>
    );
  }
  const adapter = ctrl.adapter;
  const rec = ctrl.autoPlayer.nextRecommendation();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">متابعة الإيفنت الحقيقي</h2>
      <div className="card border-emerald-600 text-emerald-200 text-sm">
        النظام مش بيلمس حسابك أبدًا: إنت اللي بتنفذ في التطبيق الرسمي، وهنا بنسجل ونخطط بس.
      </div>

      <div className="card space-y-3">
        <h3 className="font-bold">أدخل اللي شايفه في اللعبة</h3>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" placeholder="الطاقة الحالية" value={energy} onChange={(e) => setEnergy(e.target.value)} />
          <input className="input" type="number" placeholder="البطاريات" value={batteries} onChange={(e) => setBatteries(e.target.value)} />
          <input className="input" type="number" placeholder="التذاكر" value={tickets} onChange={(e) => setTickets(e.target.value)} />
          <input className="input" type="number" placeholder="الدقيقة الحالية من الإيفنت" value={nowMin} onChange={(e) => setNowMin(e.target.value)} />
        </div>
        <button
          className="btn-primary w-full"
          onClick={() => {
            adapter.calibrate({
              basicEnergy: energy === "" ? undefined : Number(energy),
              batteries: batteries === "" ? undefined : Number(batteries),
              tickets: tickets === "" ? undefined : Number(tickets),
              nowMin: nowMin === "" ? undefined : Number(nowMin),
            });
            ctrl.recomputePlan();
            ctrl.emit();
          }}
        >
          تحديث الحالة
        </button>
      </div>

      {rec && <div className="card border-indigo-500 text-indigo-200">التوصية الحالية: {rec}</div>}

      <div className="card space-y-2">
        <h3 className="font-bold">أكّد تنفيذ مهمة</h3>
        {ctrl.config.tasks.map((t) => (
          <button
            key={t.id}
            className="btn-ghost w-full text-start"
            onClick={() => {
              adapter.confirmTaskDone(t.id, t.baseTickets);
              ctrl.recomputePlan();
              ctrl.emit();
            }}
          >
            نفذت: {t.nameAr} ({t.energyCost} طاقة → {t.baseTickets} تذكرة)
          </button>
        ))}
        <button
          className="btn-ghost w-full text-start"
          onClick={() => {
            adapter.confirmBatteryUsed();
            ctrl.recomputePlan();
            ctrl.emit();
          }}
        >
          استخدمت بطارية
        </button>
      </div>
    </div>
  );
}

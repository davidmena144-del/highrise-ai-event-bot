import React from "react";
import { ControllerContext } from "../App";
import { nextWindowStart } from "../../core";

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

const STATUS_AR: Record<string, string> = {
  idle: "جاهز",
  running: "شغال",
  paused: "متوقف مؤقتًا",
  stopping: "بيوقف...",
  stopped: "متوقف",
  completed: "مكتمل",
  error: "خطأ",
};

export function Dashboard() {
  const ctrl = React.useContext(ControllerContext)!;
  const s = ctrl.adapter.getState();
  const config = ctrl.config;
  const progress = Math.min(100, Math.round((s.nowMin / config.durationMin) * 100));
  const tasksCompleted = Object.values(s.executions).reduce((a, b) => a + b, 0);
  const nextParty = nextWindowStart(config.windows.filter((w) => w.kind === "party_time"), s.nowMin);
  const partyIn = nextParty === null ? null : Math.max(0, Math.round(nextParty - s.nowMin));
  const bonusTotal = s.energy.bonus.reduce((a, b) => a + b.amount, 0);
  const remainingTasks = config.tasks.filter(
    (t) => t.maxExecutions === undefined || (s.executions[t.id] ?? 0) < t.maxExecutions,
  ).length;
  const report = ctrl.report;

  return (
    <div className="space-y-3">
      {ctrl.mode === "sim" && (
        <div className="card border-amber-600 text-amber-200 text-sm">
          هذه محاكاة كاملة، مش بيانات حقيقية من حسابك.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="الطاقة الحالية" value={`${s.energy.basic} / ${config.energyCap}`} />
        <Stat label="الطاقة المخزنة (بطاريات)" value={s.energy.batteries} hint={`كل بطارية = ${config.batteryEnergy} طاقة`} />
        <Stat label="طاقة إضافية" value={bonusTotal} />
        <Stat label="التذاكر" value={s.tickets.toLocaleString("ar-EG")} />
        <Stat label="تقدم الإيفنت" value={`${progress}%`} hint={`${Math.round(s.nowMin)} من ${config.durationMin} دقيقة`} />
        <Stat label="المهام المكتملة" value={tasksCompleted} />
        <Stat label="المهام المتبقية" value={remainingTasks} />
        <Stat
          label="العد التنازلي لـ Party Time"
          value={partyIn === null ? "—" : `${partyIn} د`}
          hint="مواعيد Party Time تقديرية (ESTIMATED)"
        />
        <Stat
          label="التذاكر المتوقعة"
          value={ctrl.plan ? Math.round(ctrl.plan.expectedTotalTickets).toLocaleString("ar-EG") : "—"}
          hint="حسب الخطة الحالية"
        />
        <Stat
          label="درجة التحسين"
          value={report ? `${Math.round(report.optimizationScore * 100)}%` : "—"}
          hint="الفعلي مقابل المتوقع"
        />
        <Stat label="حالة النظام" value={STATUS_AR[ctrl.autoPlayer.getStatus()] ?? ctrl.autoPlayer.getStatus()} />
      </div>
    </div>
  );
}

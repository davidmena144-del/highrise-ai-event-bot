import React from "react";
import { ControllerContext } from "../App";
import { SimulatorAdapter } from "../../core";

export function AutoPlayScreen() {
  const ctrl = React.useContext(ControllerContext)!;
  const status = ctrl.autoPlayer.getStatus();
  const p = ctrl.autoPlayer.progress();
  const log = ctrl.adapter instanceof SimulatorAdapter ? ctrl.adapter.sim.log : [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">محاكاة اللعب التلقائي</h2>
      <div className="card border-amber-600 text-amber-200 text-sm">
        دي محاكاة: كل اللي بيحصل هنا جوه بيئة افتراضية، مفيهاش أي وصول لحساب حقيقي.
      </div>

      {ctrl.mode !== "sim" ? (
        <div className="card text-sm">اللعب التلقائي شغال جوه المحاكاة بس. بدّل لوضع المحاكاة من الإعدادات.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => ctrl.start()} disabled={status === "running" || status === "paused"}>
              ▶ بدء
            </button>
            <button className="btn-ghost" onClick={() => ctrl.pause()} disabled={status !== "running"}>
              ⏸ إيقاف مؤقت
            </button>
            <button className="btn-ghost" onClick={() => ctrl.resume()} disabled={status !== "paused"}>
              ⏵ استئناف
            </button>
            <button className="btn-ghost" onClick={() => ctrl.step()} disabled={status !== "running"}>
              خطوة واحدة
            </button>
            <button className="btn-primary" onClick={() => ctrl.runToEnd()} disabled={status !== "running" && status !== "idle" && status !== "paused"}>
              ⏩ شغّل للآخر
            </button>
            <button className="btn-danger" onClick={() => ctrl.stopNow()} disabled={status !== "running" && status !== "paused"}>
              ⛔ إيقاف فوري
            </button>
            <button className="btn-ghost" onClick={() => ctrl.reset()}>🔄 جلسة جديدة</button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="card"><div className="stat-label">الدقيقة</div><div className="stat-value">{Math.round(p.nowMin)}</div></div>
            <div className="card"><div className="stat-label">التذاكر</div><div className="stat-value">{p.tickets.toLocaleString("ar-EG")}</div></div>
            <div className="card"><div className="stat-label">المهام</div><div className="stat-value">{p.tasksCompleted}</div></div>
            <div className="card"><div className="stat-label">الطاقة</div><div className="stat-value">{p.energyAvailable}</div></div>
            <div className="card"><div className="stat-label">البطاريات</div><div className="stat-value">{p.batteries}</div></div>
            <div className="card"><div className="stat-label">إعادة المحاولة</div><div className="stat-value">{p.retries}</div></div>
          </div>

          {p.currentAction && <div className="card text-sm text-indigo-200">الإجراء الحالي: {p.currentAction}</div>}

          <div className="card">
            <h3 className="font-bold mb-2">سجل الجلسة</h3>
            <div className="max-h-64 overflow-y-auto text-xs space-y-1">
              {log.length === 0 && <div className="text-slate-500">لسه مفيش أحداث.</div>}
              {[...log].reverse().slice(0, 100).map((e, i) => (
                <div key={i} className={e.kind === "network_error" ? "text-red-300" : "text-slate-300"}>
                  [{Math.round(e.atMin)}] {e.detail}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

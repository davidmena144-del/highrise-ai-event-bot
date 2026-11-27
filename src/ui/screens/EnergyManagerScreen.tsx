import React from "react";
import { ControllerContext } from "../App";
import { batteryAdvice } from "../../core";

export function EnergyManagerScreen() {
  const ctrl = React.useContext(ControllerContext)!;
  const s = ctrl.adapter.getState();
  const advice = batteryAdvice(ctrl.config, s.nowMin, s.energy.basic, s.energy.batteries);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">إدارة الطاقة</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="stat-label">الطاقة الأساسية</div>
          <div className="stat-value">{s.energy.basic} / {ctrl.config.energyCap}</div>
          <div className="text-xs text-slate-500">بتتجدد كل {ctrl.config.regenIntervalMin} دقيقة</div>
        </div>
        <div className="card">
          <div className="stat-label">البطاريات</div>
          <div className="stat-value">{s.energy.batteries}</div>
          <div className="text-xs text-slate-500">بتفضل في المخزون بين الإيفنتات (قاعدة مؤكدة)</div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold mb-2">الطاقة الإضافية</h3>
        {s.energy.bonus.length === 0 && <div className="text-sm text-slate-400">مفيش طاقة إضافية حاليًا.</div>}
        {s.energy.bonus.map((b) => (
          <div key={b.id} className="flex justify-between text-sm border-b border-slate-700 py-1">
            <span>+{b.amount} طاقة</span>
            <span className="text-slate-400">
              {b.expiresAtMin === null ? "من غير انتهاء" : `بتنتهي عند الدقيقة ${b.expiresAtMin}`}
            </span>
          </div>
        ))}
      </div>

      {advice && <div className="card border-indigo-500 text-indigo-200 text-sm">{advice.reasonAr}</div>}

      <div className="card text-sm text-slate-300 space-y-1">
        <h3 className="font-bold text-white">قواعد مؤكدة من الدعم الرسمي</h3>
        <p>• الطاقة اللي مش مستخدمة بتنتهي مع نهاية الإيفنت.</p>
        <p>• البطاريات بتفضل في المخزون للإيفنتات الجاية.</p>
        <p>• في اللعبة الحقيقية: اضغط زرار البطارية ضغطة، متطوّلش، عشان متستهلكش الكومة كلها.</p>
      </div>
    </div>
  );
}

import React from "react";
import { ControllerContext } from "../App";

export function SmartPlanner() {
  const ctrl = React.useContext(ControllerContext)!;
  const plan = ctrl.plan;
  const dp = plan ? Math.round(plan.expectedTotalTickets) : 0;
  const greedy = Math.round(ctrl.greedyTickets);
  const gain = greedy > 0 ? Math.round(((dp - greedy) / greedy) * 100) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">المخطط الذكي</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="stat-label">خطة التحسين (DP)</div>
          <div className="stat-value">{dp.toLocaleString("ar-EG")} تذكرة</div>
        </div>
        <div className="card">
          <div className="stat-label">الاستراتيجية الجشعة</div>
          <div className="stat-value">{greedy.toLocaleString("ar-EG")} تذكرة</div>
          <div className="text-xs text-slate-500">{gain > 0 ? `التحسين أفضل بنسبة ${gain}%` : "نفس النتيجة"}</div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold mb-2">الخطوات المقترحة</h3>
        {!plan || plan.steps.length === 0 ? (
          <div className="text-sm text-slate-400">مفيش خطوات متاحة دلوقتي. استنى التجدد أو استخدم بطارية.</div>
        ) : (
          <ol className="space-y-2 max-h-96 overflow-y-auto">
            {plan.steps.slice(0, 50).map((st, i) => (
              <li key={i} className="text-sm border-b border-slate-700 pb-1">
                <span className="text-slate-400">الدقيقة {st.atMin}</span> — {st.reasonAr}
              </li>
            ))}
            {plan.steps.length > 50 && (
              <li className="text-xs text-slate-500">... و {plan.steps.length - 50} خطوة تانية</li>
            )}
          </ol>
        )}
      </div>

      <div className="card text-sm text-slate-300">
        <h3 className="font-bold text-white mb-1">ليه التوصيات دي؟</h3>
        <p>
          المحرك بيستخدم برمجة ديناميكية على (الوقت × الطاقة): بيحسب أقصى تذاكر ممكنة لحد نهاية الإيفنت،
          وبيفضّل تنفيذ المهام وقت Party Time لما ده يكسب أكتر، وبيتجنب إهدار التجدد. البطاريات ليها قاعدة
          منفصلة موثقة: بتتستخدم وقت المضاعفة أو قبل نهاية الإيفنت لو التجدد مش هيكفي.
        </p>
      </div>
    </div>
  );
}

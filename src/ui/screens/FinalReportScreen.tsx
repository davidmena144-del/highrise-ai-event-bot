import React from "react";
import { ControllerContext } from "../App";

const ENDED_AR: Record<string, string> = {
  completed: "اكتملت (نفدت الموارد)",
  stopped: "أوقفها المستخدم",
  event_ended: "الإيفنت انتهى",
  error: "خطأ",
};

export function FinalReportScreen() {
  const ctrl = React.useContext(ControllerContext)!;
  const r = ctrl.report;

  if (!r) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">التقرير النهائي</h2>
        <div className="card text-sm text-slate-400">مفيش تقرير لسه. شغّل جلسة من محاكاة اللعب التلقائي الأول.</div>
      </div>
    );
  }

  const rows: Array<[string, React.ReactNode]> = [
    ["الجلسة", r.sessionId],
    ["النوع", r.namespace === "sim" ? "محاكاة" : "إيفنت حقيقي"],
    ["المدة", `${Math.round(r.durationMin)} دقيقة`],
    ["التذاكر المكتسبة", r.ticketsEarned.toLocaleString("ar-EG")],
    ["المهام المكتملة", r.tasksCompleted],
    ["الطاقة المستهلكة", r.energySpent],
    ["الطاقة المتجددة", r.energyRegenerated],
    ["طاقة إضافية مكتسبة", r.bonusEnergyGranted],
    ["طاقة إضافية ضاعت", r.bonusEnergyExpired],
    ["بطاريات مستخدمة", r.batteriesUsed],
    ["أخطاء الشبكة", r.networkErrors],
    ["الكفاءة (تذكرة/طاقة)", r.efficiency.toFixed(2)],
    ["درجة التحسين", `${Math.round(r.optimizationScore * 100)}%`],
    ["انتهت بـ", ENDED_AR[r.endedBy] ?? r.endedBy],
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">التقرير النهائي</h2>
      <div className="card">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-slate-700">
                <td className="py-2 text-slate-400">{k}</td>
                <td className="py-2 text-white font-semibold">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.notes.length > 0 && (
        <div className="card text-sm">
          <h3 className="font-bold mb-1">ملاحظات</h3>
          {r.notes.map((n, i) => (
            <div key={i} className="text-slate-300">• {n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

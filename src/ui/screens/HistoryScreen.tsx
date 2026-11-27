import React from "react";
import { ControllerContext } from "../App";

export function HistoryScreen() {
  const ctrl = React.useContext(ControllerContext)!;
  const { sim, real } = ctrl.history();

  const List = ({ title, items }: { title: string; items: ReturnType<typeof ctrl.history>["sim"] }) => (
    <div className="card">
      <h3 className="font-bold mb-2">{title}</h3>
      {items.length === 0 && <div className="text-sm text-slate-500">مفيش جلسات مسجلة.</div>}
      {items.map((r) => (
        <div key={r.sessionId} className="text-sm border-b border-slate-700 py-1">
          <span className="text-slate-400">{new Date(r.startedAt).toLocaleString("ar-EG")}</span> — {r.summary}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">سجل الجلسات</h2>
      <p className="text-xs text-slate-500">جلسات المحاكاة والجلسات الحقيقية متخزنة منفصلة تمامًا.</p>
      <List title="جلسات المحاكاة" items={sim} />
      <List title="جلسات الإيفنت الحقيقي (إدخال يدوي)" items={real} />
    </div>
  );
}

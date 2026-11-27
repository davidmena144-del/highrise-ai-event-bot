import React from "react";
import { ControllerContext } from "../App";
import { CAPABILITY_MATRIX } from "../../core";

export function SettingsScreen() {
  const ctrl = React.useContext(ControllerContext)!;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">الإعدادات</h2>

      <div className="card space-y-2">
        <h3 className="font-bold">وضع التشغيل</h3>
        <div className="flex gap-2">
          <button className={ctrl.mode === "sim" ? "btn-primary" : "btn-ghost"} onClick={() => ctrl.setMode("sim")}>
            محاكاة
          </button>
          <button className={ctrl.mode === "real" ? "btn-primary" : "btn-ghost"} onClick={() => ctrl.setMode("real")}>
            إيفنت حقيقي (إدخال يدوي)
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold mb-2">مصفوفة القدرات الرسمية</h3>
        <p className="text-xs text-slate-500 mb-2">مصادر رسمية فقط، آخر مراجعة ٢٧ نوفمبر ٢٠٢٦. ممنوع ندّعي أي قدرة مش موثقة.</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-600">
              <th className="text-start py-1">القدرة</th>
              <th className="text-start py-1">متاحة؟</th>
              <th className="text-start py-1">القيود</th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITY_MATRIX.map((c) => (
              <tr key={c.capability} className="border-b border-slate-700">
                <td className="py-1">{c.capability}</td>
                <td className="py-1">{c.available ? "✅" : "❌"}</td>
                <td className="py-1 text-slate-400">{c.limitations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card text-sm space-y-1">
        <h3 className="font-bold">الأمان</h3>
        <p>• مفيش جمع كلمات مرور أبدًا.</p>
        <p>• مفيش تخزين توكنات أو بيانات اعتماد.</p>
        <p>• مفيش تجاوز لأنظمة الحماية أو الكابتشا.</p>
        <p>• تخزين المحاكاة منفصل عن تخزين الجلسات الحقيقية.</p>
      </div>
    </div>
  );
}

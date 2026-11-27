# نتائج الاختبارات الفعلية — TEST RESULTS

تاريخ التشغيل: 27 نوفمبر 2026، `npx vitest run` (vitest 3.2.7, node 22).

```
 ✓ tests/ui.test.tsx > Arabic RTL dashboard > renders the dashboard in Arabic with RTL direction 78ms
 ✓ tests/ui.test.tsx > Arabic RTL dashboard > always shows a prominent Stop Now button 35ms
 ✓ tests/ui.test.tsx > Arabic RTL dashboard > labels the simulator as a simulation 31ms
 ✓ tests/ui.test.tsx > Arabic RTL dashboard > navigates to all nine screens 83ms
 ✓ tests/ui.test.tsx > Arabic RTL dashboard > shows the official capability matrix in settings 66ms
 ✓ tests/ui.test.tsx > Arabic RTL dashboard > stop now ends a running auto play session 34ms
 ✓ tests/simulator.test.ts > simulator + auto player: randomized full sessions > runs 400 randomized sessions to completion without invariant violations 190ms
 ✓ tests/simulator.test.ts > simulator + auto player: randomized full sessions > is deterministic for the same seed 4ms
 ✓ tests/simulator.test.ts > simulator + auto player: randomized full sessions > auto play matches the optimizer expectation on a clean run 1ms
 ✓ tests/simulator.test.ts > simulator + auto player: randomized full sessions > handles an already-expired event 0ms
 ✓ tests/simulator.test.ts > simulator + auto player: randomized full sessions > recovers from network interruptions with retries 0ms
 ✓ tests/simulator.test.ts > simulator + auto player: randomized full sessions > grants and expires bonus energy inside sessions 0ms
 ✓ tests/simulator.test.ts > auto player controls > pause/resume/stopNow state machine transitions 8ms
 ✓ tests/simulator.test.ts > auto player controls > stopNow works mid-execution and produces a partial report 1ms
 ✓ tests/simulator.test.ts > auto player controls > rejects start from an invalid state 3ms
 ✓ tests/simulator.test.ts > auto player controls > session recovery restores an interrupted session 3ms
 ✓ tests/optimizer.test.ts > optimizer: DP vs brute-force reference > matches the exhaustive reference on 300 randomized small events 89ms
 ✓ tests/optimizer.test.ts > optimizer: DP vs brute-force reference > DP is never worse than the greedy baseline (200 randomized events) 53ms
 ✓ tests/optimizer.test.ts > optimizer: DP vs brute-force reference > prefers executing during Party Time when waiting pays 0ms
 ✓ tests/optimizer.test.ts > optimizer: DP vs brute-force reference > handles zero energy with no regen: no steps, zero tickets 3ms
 ✓ tests/optimizer.test.ts > optimizer: DP vs brute-force reference > handles expired event (nowMin beyond duration) 1ms
 ✓ tests/optimizer.test.ts > optimizer: DP vs brute-force reference > every planned step carries an explanation 9ms
 ✓ tests/optimizer.test.ts > optimizer: DP vs brute-force reference > respects maxExecutions caps 0ms
 ✓ tests/energy.test.ts > EnergyManager > regenerates one point per interval up to the cap 1ms
 ✓ tests/energy.test.ts > EnergyManager > never exceeds the energy cap (zero energy / max energy edge cases) 0ms
 ✓ tests/energy.test.ts > EnergyManager > starting energy is clamped to the cap 0ms
 ✓ tests/energy.test.ts > EnergyManager > spends soonest-expiring bonus energy before basic 0ms
 ✓ tests/energy.test.ts > EnergyManager > expires bonus energy and reports it as wasted 0ms
 ✓ tests/energy.test.ts > EnergyManager > refuses to spend more than available 0ms
 ✓ tests/energy.test.ts > EnergyManager > batteries convert to energy honoring the cap 0ms
 ✓ tests/energy.test.ts > EnergyManager > throws on negative spend 0ms
 ✓ tests/isolation.test.ts > data isolation > sim and real namespaces never share keys or snapshots 2ms
 ✓ tests/isolation.test.ts > data isolation > simulated observations never upgrade real-event rules 0ms
 ✓ tests/isolation.test.ts > official adapter fails safely > throws UnsupportedCapabilityError instead of pretending 0ms
 ✓ tests/isolation.test.ts > official adapter fails safely > never claims undocumented capabilities 0ms
 ✓ tests/isolation.test.ts > manual adapter > calibrates from user input and only recommends actions 0ms
 ✓ tests/isolation.test.ts > default config honesty > labels community-sourced numbers as ESTIMATED, not VERIFIED 0ms

 Test Files  5 passed (5)
      Tests  37 passed (37)
   Start at  03:55:11
   Duration  3.22s (transform 393ms, setup 253ms, collect 664ms, tests 1.04s, environment 262ms, prepare 360ms)

```

الإجمالي: 37 اختبارًا في 5 ملفات، كلها ناجحة. التغطية تشمل: 400 جلسة محاكاة عشوائية كاملة، مقارنة DP ضد بحث شامل مرجعي في 300 إيفنت عشوائي، ومقارنة ضد الاستراتيجية الجشعة في 200 إيفنت عشوائي.

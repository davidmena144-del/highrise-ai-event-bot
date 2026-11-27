document.getElementById("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = document.getElementById("b"), err = document.getElementById("err");
  b.disabled = true; err.textContent = "";
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: document.getElementById("u").value, password: document.getElementById("p").value }) });
    if (r.ok) { location.href = "/"; return; }
    const d = await r.json().catch(() => ({}));
    err.textContent = d.error || "فشل تسجيل الدخول";
  } catch { err.textContent = "مشكلة في الاتصال"; }
  b.disabled = false;
});

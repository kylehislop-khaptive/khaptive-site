// Vercel serverless function: receives an order from the website and emails it via Resend.
// Environment variables (set in Vercel > Project > Settings > Environment Variables):
//   RESEND_API_KEY  (required)  your Resend API key
//   ORDER_TO        (required)  where orders are sent, e.g. khaptivedesign@gmail.com (comma-separate for several)
//   ORDER_FROM      (optional)  defaults to "Khaptive Orders <onboarding@resend.dev>"

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => String(s == null ? "" : s).replace(/[\r\n]+/g, " ").trim().slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const key = process.env.RESEND_API_KEY, to = process.env.ORDER_TO;
  if (!key || !to) return res.status(500).json({ ok: false, error: "Email is not configured" });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  // Spam trap: real visitors never fill this hidden field.
  if (b.website) return res.status(200).json({ ok: true });

  const name = clip(b.name, 120), email = clip(b.email, 160), phone = clip(b.phone, 60),
    address = clip(b.address, 240), date = clip(b.date, 40), notes = String(b.notes || "").trim().slice(0, 2000);
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 30).map((l) => ({ label: clip(l && l.label, 200), txt: clip(l && l.txt, 40) }));
  const total = clip(b.total, 40), savings = clip(b.savings, 40);

  if (!name || !address || !/^\S+@\S+\.\S+$/.test(email) || !lines.length)
    return res.status(400).json({ ok: false, error: "Missing required order details" });

  const text = [
    "NEW ORDER", "",
    "Agent: " + name, "Email: " + email, "Phone: " + (phone || "-"),
    "Property: " + address, "Preferred date: " + (date || "-"), "",
    "Services:", ...lines.map((l) => "- " + l.label + ": " + l.txt),
    savings ? "Bundle savings: " + savings : "",
    "", "Estimated total: " + total, "Notes: " + (notes || "-"),
  ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");

  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">' +
    "<h2>New order: " + esc(address) + "</h2>" +
    "<p><b>Agent:</b> " + esc(name) + "<br><b>Email:</b> " + esc(email) + "<br><b>Phone:</b> " + esc(phone || "-") +
    "<br><b>Property:</b> " + esc(address) + "<br><b>Preferred date:</b> " + esc(date || "-") + "</p>" +
    '<table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">' +
    lines.map((l) => '<tr><td style="border-top:1px solid #eee">' + esc(l.label) + '</td><td style="border-top:1px solid #eee;text-align:right"><b>' + esc(l.txt) + "</b></td></tr>").join("") +
    "</table>" +
    (savings ? '<p style="color:#15803d">Bundle savings: ' + esc(savings) + "</p>" : "") +
    "<p><b>Estimated total: " + esc(total) + "</b></p>" +
    "<p><b>Notes:</b> " + esc(notes || "-").replace(/\n/g, "<br>") + "</p></div>";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.ORDER_FROM || "Khaptive Orders <onboarding@resend.dev>",
        to: to.split(",").map((s) => s.trim()).filter(Boolean),
        reply_to: email,
        subject: "New order: " + address,
        text, html,
      }),
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: "Email service refused the message" });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: "Could not reach email service" });
  }
};

// The RSVP (Sections 6 and 9). This card is deliberately NOT pinned or
// scrubbed: it sits in the normal flow of the page, so once it is on screen it
// stays put while the guest types, until they choose to scroll past it.

import { RSVP_URL } from "./config.js";
import { scrollThread } from "./transition.js";
import { seam } from "./motion.js";

const DONE_KEY = "nv-rsvp-done";

// all copy is final (Section 6)
const MSG = {
  missing: "Please fill in all three so we can reach you.",
  phone: "That number doesn't look right. Mind checking it?",
  failed: "Something went wrong. Please try again, or call us on the numbers below.",
  success: (name) => `Thank you, ${name}! Expect a call from us soon.`,
};

const store = {
  get() { try { return JSON.parse(localStorage.getItem(DONE_KEY) || "null"); } catch { return null; } },
  set(v) { try { localStorage.setItem(DONE_KEY, JSON.stringify(v)); } catch { /* private mode: fine */ } },
};

export function buildRsvp(el, manifest, { reduced }, seg) {
  el.classList.add("rsvp-section");
  el.style.minHeight = `calc(var(--u) * ${seg.vh})`;

  el.innerHTML = `
    <div class="rsvp-bg" data-bg="url(/${manifest.s7_master_blur.file})"></div>
    <div class="edge edge--top" style="--c:${seg.top}"></div>
    <div class="edge edge--bottom" style="--c:${seg.bottom}"></div>
    <div class="card card--light rsvp-card acc--rsvp">
      <h2 class="title">Will you be there?</h2>
      <div class="divider"></div>
      <p class="rsvp-lede">Leave your details and we'll call you personally.</p>
      <form class="rsvp-form" novalidate>
        <label class="field"><span>Your name</span>
          <input name="name" type="text" autocomplete="name" autocapitalize="words" enterkeyhint="next" required></label>
        <label class="field"><span>Email</span>
          <input name="email" type="email" autocomplete="email" inputmode="email" enterkeyhint="next" required></label>
        <label class="field"><span>Phone number</span>
          <input name="phone" type="tel" autocomplete="tel" inputmode="tel" enterkeyhint="send" value="+91 " required></label>
        <div class="hp" aria-hidden="true"><label>Company <input name="company" type="text" tabindex="-1" autocomplete="off"></label></div>
        <p class="rsvp-msg" role="alert" aria-live="polite"></p>
        <button class="btn btn--solid rsvp-submit" type="submit"><span class="spinner" aria-hidden="true"></span><span class="lbl">Count me in</span></button>
      </form>
      <p class="rsvp-done" hidden></p>
    </div>
  `;

  const form = el.querySelector(".rsvp-form");
  const msg = el.querySelector(".rsvp-msg");
  const done = el.querySelector(".rsvp-done");
  const btn = el.querySelector(".rsvp-submit");

  const showDone = (name) => {
    form.remove();
    el.querySelector(".rsvp-lede").remove(); // the ask is answered: just the thanks remains
    done.textContent = MSG.success(name);
    done.hidden = false;
  };
  const prev = store.get();
  if (prev?.name) showDone(prev.name); // never show the form again on this device

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const name = f.name.trim(), email = f.email.trim(), phone = f.phone.trim();
    for (const i of form.querySelectorAll("input")) i.removeAttribute("aria-invalid");
    const bad = (n) => form.elements[n].setAttribute("aria-invalid", "true");

    // validation (9.2). The brief's copy has one message for missing fields
    // and one for the phone, so a short name or malformed email uses the first.
    const phoneDigits = phone.replace(/[\s-]/g, "");
    const missing = [];
    if (name.length < 2) missing.push("name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) missing.push("email");
    if (!/\d/.test(phoneDigits.replace(/^\+91/, ""))) missing.push("phone");
    if (missing.length) { missing.forEach(bad); msg.textContent = MSG.missing; return; }
    const phoneOk = phoneDigits.startsWith("+91")
      ? /^\+91\d{10}$/.test(phoneDigits)
      : /^\+\d{8,15}$/.test(phoneDigits);
    if (!phoneOk) { bad("phone"); msg.textContent = MSG.phone; return; }

    msg.textContent = "";
    btn.disabled = true;
    btn.classList.add("is-busy");
    const payload = { name, email, phone: phoneDigits, company: f.company || "" };
    try {
      if (!RSVP_URL) {
        // not configured yet: log it and carry on, so the flow can be tested (9.2)
        console.info("[rsvp] RSVP_URL not set; would submit:", payload);
        await new Promise((r) => setTimeout(r, 600));
      } else {
        // text/plain avoids a CORS preflight, which Apps Script can't answer
        const res = await fetch(RSVP_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
          redirect: "follow",
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);
      }
      store.set({ name, at: Date.now() });
      showDone(name);
    } catch (err) {
      console.warn("[rsvp] submission failed", err);
      msg.textContent = MSG.failed;
      btn.disabled = false;
      btn.classList.remove("is-busy");
    }
  });

  // the thread comes down the left, passes behind the card, and leaves for Screen 8
  scrollThread(el, reduced, (W, H) => {
    const top = seam.top(seg.xIn, W, H), bot = seam.bottom(seg.xOut, W, H);
    const P = [
      [seg.xIn * W, 0], top.next,
      [0.08 * W, 0.26 * H], [0.07 * W, 0.5 * H],
      [0.2 * W, 0.72 * H], bot.prev, [seg.xOut * W, H],
    ];
    P.head = top.head; P.tail = bot.tail;
    return P;
  }, { z: 3 });
}

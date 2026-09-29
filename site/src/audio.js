// Background music (Section 7.1). Never autoplays; starts on the tap gate.
// Fades in over 2s, loops, pauses when the tab is hidden, and exposes a mute toggle.
// Volume runs through a Web Audio GainNode because iOS Safari ignores
// HTMLMediaElement.volume, so a plain volume ramp would not fade on iPhones.

export function createAudio(src) {
  const el = new Audio(src);
  el.loop = true;
  el.preload = "none";

  let ctx = null, gain = null;
  let muted = false;
  let started = false;

  // Must run inside the tap handler: iOS only unlocks audio in a user gesture.
  function ensureGraph() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // very old browser: plays at full volume, no fade
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
  }

  function fadeTo(target, ms) {
    if (!gain) return;
    const g = gain.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + ms / 1000);
  }

  async function start() {
    if (started) return;
    started = true;
    el.preload = "auto";
    ensureGraph();
    try {
      if (ctx && ctx.state === "suspended") await ctx.resume();
      await el.play();
      if (!muted) fadeTo(1, 2000);
    } catch (e) {
      // WhatsApp/iOS may still block; tapping the sound toggle retries.
      started = false;
    }
  }

  function setMuted(m) {
    muted = m;
    if (muted) fadeTo(0, 300);
    else if (!started) start();
    else { el.play().catch(() => {}); fadeTo(1, 600); }
  }
  function toggle() { setMuted(!muted); return muted; }
  function isMuted() { return muted; }

  document.addEventListener("visibilitychange", () => {
    if (!started) return;
    if (document.hidden) el.pause();
    else if (!muted) {
      if (ctx && ctx.state === "suspended") ctx.resume();
      el.play().catch(() => {});
    }
  });

  return { start, toggle, setMuted, isMuted, el, get gain() { return gain && gain.gain.value; } };
}

// Deferred image loading (Section 8): images are created with their sources
// parked in data attributes, and a section's images only start downloading
// when loadIn() is called for it: Screen 1 on the tap, then each next section
// a few screens before the guest reaches it. Nothing loads up front.

// On a slow link, or with Data Saver on, full-bleed images use their 750px
// version (about 40% lighter) instead of letting a sharp phone screen pull
// the 1080px one: arriving in time matters more than the last bit of detail.
const conn = navigator.connection;
export const LIGHT = !!(conn && (conn.saveData || (conn.downlink && conn.downlink < 3) || /(^|-)2g|3g/.test(conn.effectiveType || "")));

export function setSrc(img, src, srcset, sizes) {
  if (srcset && LIGHT) {
    src = srcset.split(",")[0].trim().split(" ")[0]; // the smallest candidate
    srcset = null;
  }
  if (sizes) img.sizes = sizes;
  if (srcset) img.dataset.srcset = srcset;
  img.dataset.src = src;
}

export function loadIn(root) {
  for (const img of root.querySelectorAll("img[data-src]")) {
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    img.src = img.dataset.src;
    delete img.dataset.src; delete img.dataset.srcset;
  }
  for (const el of root.querySelectorAll("[data-bg]")) {
    el.style.backgroundImage = el.dataset.bg;
    delete el.dataset.bg;
  }
}

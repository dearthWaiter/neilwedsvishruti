/**
 * Neil & Vishruti · RSVP receiver (Google Apps Script web app).
 *
 * The website POSTs a small JSON body: { name, email, phone, company }.
 * `company` is a hidden "honeypot" field: real guests never see it, so if it
 * is filled in, a spam bot filled it, and the row is quietly dropped.
 *
 * Each accepted RSVP becomes one row in the first sheet:
 *   Timestamp (IST) | Name | Email | Phone
 *
 * Setup steps are in SETUP.md, next to this file.
 */

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // 1. Spam bots fill in the hidden field. Pretend all is well; save nothing.
    if (body.company) return json_({ ok: true });

    // 2. All three details are required.
    var name = clean_(body.name, 120);
    var email = clean_(body.email, 200);
    var phone = clean_(body.phone, 40);
    if (!name || !email || !phone) return json_({ ok: false, error: "missing" });

    // 3. Append the row. The lock stops two guests submitting at the same
    //    instant from overwriting each other.
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      var stamp = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a");
      sheet.appendRow([stamp, name, email, phone]);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Visiting the web-app URL in a browser shows this, which confirms it's live.
function doGet() {
  return json_({ ok: true, hello: "Neil & Vishruti RSVP is running." });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Trim, cap the length, and stop a value that starts with = + - @ from being
// read by Sheets as a formula.
function clean_(v, max) {
  var s = String(v == null ? "" : v).trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

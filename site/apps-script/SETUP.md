# Setting up the RSVP sheet

This connects the website's RSVP form to a Google Sheet. Each time a guest taps
**Count me in**, a new row appears with the time, their name, email and phone.
It takes about 10 minutes, and you only do it once.

You need a Google account. Nothing here costs money.

---

## 1. Create the Sheet

1. Go to **sheets.google.com** and click **Blank spreadsheet** (the big +).
2. Click **Untitled spreadsheet** at the top left and rename it, for example
   `Wedding RSVPs`.
3. In the first row, type these four headers, one per cell:

   | A | B | C | D |
   |---|---|---|---|
   | Timestamp (IST) | Name | Email | Phone |

4. Optional but nice: select row 1, make it **bold**, then **View → Freeze → 1 row**
   so the headers stay visible as the list grows.

Keep this as the **first tab** of the spreadsheet: that's where RSVPs are written.

## 2. Add the script

1. In the Sheet's menu, click **Extensions → Apps Script**. A new tab opens
   with a code editor and a file called `Code.gs`.
2. Delete everything in that file.
3. Open `Code.gs` from this folder (`site/apps-script/Code.gs`), copy all of it,
   and paste it into the editor.
4. Click the **Save** icon (the floppy disk), or press Cmd+S.
5. At the top left, rename the project from "Untitled project" to
   `Wedding RSVP` (click the name to edit it).

## 3. Publish it as a web app

1. At the top right, click the blue **Deploy** button → **New deployment**.
2. Next to "Select type", click the gear icon ⚙ and choose **Web app**.
3. Fill in:
   - **Description:** `RSVP`
   - **Execute as:** **Me** (your email)
   - **Who has access:** **Anyone**

   "Anyone" only means anyone can *send* an RSVP to it, which is what the
   website needs. It does **not** let anyone see the Sheet.
4. Click **Deploy**.
5. Google will ask you to **Authorize access**. Click it and choose your
   account. You'll see a warning, "Google hasn't verified this app". That's
   expected: it's your own script. Click **Advanced**, then
   **Go to Wedding RSVP (unsafe)**, then **Allow**.
6. You'll now see a **Web app URL** ending in `/exec`. Click **Copy**.

To check it's working, paste that URL into a new browser tab. You should see:
`{"ok":true,"hello":"Neil & Vishruti RSVP is running."}`

## 4. Put the URL into the website

1. Open `site/src/config.js`.
2. Paste the URL between the quotes on this line:

   ```js
   export const RSVP_URL = "";
   ```

   so it looks like:

   ```js
   export const RSVP_URL = "https://script.google.com/macros/s/AKfy.../exec";
   ```

3. Save. (Or just send the URL to Claude and it will do this for you.)

Until this URL is filled in, the form still works on screen for testing, but
nothing is saved.

## 5. Share the Sheet with family

1. Back in the Sheet, click **Share** (top right).
2. Add each family member's email.
3. Choose their access:
   - **Viewer**: can see the RSVPs, can't change anything. Good for most people.
   - **Editor**: can also add notes, like a "Called?" column. Good for whoever
     is making the calls.
4. Untick **Notify people** if you'd rather tell them yourself, then **Send**.

Tip: an Editor can add a fifth column, **Called?**, to tick off each guest.
New RSVPs only ever fill columns A to D, so an extra column is safe.

---

## If you change the script later

Editing `Code.gs` doesn't change the live version by itself. After editing:
**Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy.**
The URL stays the same, so the website doesn't need updating.

## If something goes wrong

- **Guests see "Something went wrong"**: open the URL from step 3.6 in a
  browser. If it doesn't show the "running" message, redeploy (step 3) and make
  sure **Who has access** is **Anyone**.
- **Nothing appears in the Sheet**: make sure the headers are on the **first
  tab**, and that you pasted the URL ending in `/exec` (not `/dev`).
- **You deleted the headers by accident**: just type them back into row 1.

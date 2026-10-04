# BRIEF: Neil & Vishruti Wedding Invitation Website

Build brief for Claude Code. Read this whole file before writing any code.

---

## 1. What we are building

A scroll-driven, single-page wedding invitation at **neilwedsvishruti.in**.

A red thread of fate is tied to a boy's little finger in a school playground. As the guest scrolls, the camera rises into the sky, and the thread travels down through four event cards: Haldi & Mehendi, Sangeet & Cocktails, the Wedding, and the Reception. It passes through small illustrated icons from the couple's story, ends at an RSVP overlooking the Sangam in Prayagraj, and finally joins the couple's two little fingers.

**Audience:** about 90% of guests open the link on a phone, mostly from WhatsApp. Many are older relatives on mid-range Android phones. Parents and relatives will forward the link, so there are no personalised links.

**Aesthetic:** hand-painted anime background art. Luminous skies, soft bloom, crisp linework, an Indian setting and Indian characters. The images carry the look; the code must not fight them. No generic "wedding template" styling, no stock flourishes, no confetti.

**Non-negotiables:**
1. Mobile-first. Design at 390×844 and test there first. Desktop is secondary.
2. The red thread is always drawn in code (SVG), never baked into images.
3. The story is continuous. There is **no "skip to details" button**: everything is intertwined by design.
4. All copy in Section 6 is final. Use it verbatim. Do not add, rewrite or "improve" text. Never use em dashes anywhere.
5. Nothing from `sources/` is ever copied into the build or deployed. It contains private photos.

---

## 2. Folder layout (as it exists now)

```
wedding card/
├── BRIEF.md          ← this file
├── assets/           ← the ONLY input files for the site
└── sources/          ← private reference photos. Never read into the build, never deploy.
```

Create the project inside `wedding card/` (e.g. `wedding card/site/`). Add `sources/` to `.gitignore` and to any deploy ignore list.

---

## 3. Tech stack

- **Vite**, vanilla JavaScript or TypeScript. No React or framework: this is one page.
- **GSAP + ScrollTrigger** for all scroll-linked animation.
- **Lenis** for smooth scrolling, synced to ScrollTrigger. Must feel native on touch; do not scroll-jack.
- **sharp** (Node) for the asset pipeline. Python with `rembg` only as a fallback (see 4.2).
- Plain CSS with custom properties. No Tailwind needed.
- Hosting: **Vercel** (free Hobby plan) with custom domain `neilwedsvishruti.in`.
- RSVP: **Google Sheets via Google Apps Script** web app (see Section 9).

Animate only `transform` and `opacity` wherever possible. Target 60fps on a mid-range Android phone.

---

## 4. Asset pipeline

### 4.1 Input files in `assets/`

| File | What it is |
|---|---|
| `s1_master.png` | School playground at golden hour, two teenagers from behind, standing apart |
| `s1_plate.png` | Same scene, no people |
| `s1_hands.png` | Close-up: two teenage hands, his little finger extended, hers reaching toward it, not touching |
| `s2_sky.png` | The sky above the school, warm at the bottom, deep blue at the top |
| `s2_clouds.png` | Four separate clouds on white |
| `s3_master.png` | Haldi: couple in yellow on school steps with lemon tea, yellow blossoms/leaves falling |
| `s3_plate.png` | Same, no people |
| `s3_icons.png` | Five Haldi icons on white (see 4.3) |
| `s4_master.png` | Sangeet: couple on a rooftop under the Milky Way, blue ballgown, fairy lights |
| `s4_plate.png` | Same, no people |
| `s4_icons.png` | Five Sangeet icons on white |
| `s5_master.png` | Wedding: couple in bridal wear on temple steps, marigolds, diyas, morning |
| `s5_plate.png` | Same, no people |
| `s5_icons.png` | Five Wedding icons on white |
| `s6_master.png` | Reception: couple before the school lit with fairy lights, twilight |
| `s6_plate.png` | Same, no people |
| `s6_icons.png` | Four Reception icons on white |
| `s7_master.png` | Couple in wedding wear on a ghat terrace overlooking the Sangam, golden hour |
| `s7_plate.png` | Same, no couple |
| `s7_boats.png` | Five boats on white. Optional; use only if it adds something |
| `s8_hands.png` | Close-up: two adult hands (sherwani cuff; mehendi and bangles), pinkies almost touching, blurred Sangam behind |
| `t1_haldi_sprites.png` | Falling yellow petals/leaves on white |
| `t2_marigolds.png` | Marigold flowers and petals on white |
| `music.mp3` | Background music (instrumental, personalised) |

All images are portrait 2:3 (about 1024×1536). Never modify the originals; write all outputs to `site/public/img/`.

### 4.2 Character cutouts (master minus plate)

Each master and its plate are the same image except for the people. Build the cutout mask from the difference:

1. Compute per-pixel colour difference between master and plate.
2. Threshold, then clean up: morphological close, fill holes, keep the largest connected components, and feather the edge by 1 to 2px.
3. Apply the mask to the master to get a transparent PNG/WebP of just the people.

**Outputs:**
- `s1`: split the mask into two components by x-position → `s1_boy` (left) and `s1_girl` (right).
- `s3` to `s7`: one cutout each for the couple → `s3_couple`, `s4_couple`, and so on.

**Caveat:** AI edits sometimes shift the background slightly, so the difference can pick up noise. If a mask is noisy, fall back to `rembg` on the master, cropped to the people's bounding box. **Visually inspect every cutout** (render it on a magenta background and screenshot it) before using it.

### 4.3 Icon and sprite sheets

Split each sheet into individual items: detect connected components of non-white pixels, crop each with padding, and convert near-white to transparent with a soft edge. Name them in reading order (left to right, top to bottom) and verify each by eye.

| Sheet | Icons, in reading order |
|---|---|
| `s3_icons` | board game hex tiles, science model with coils and rosette, sports bottle with dumbbell, Labrador (Elon), butterfly tattoo on forearm |
| `s4_icons` | red wine and cheese board, blue ballgown on hanger, map of Sri Lanka, guitar with ticket, mushrooms on moss |
| `s5_icons` | Shiv temple (pink lotus and black shivling roof), Sai Baba seated on stone, hands serving bhog, monastery gate, havan kund |
| `s6_icons` | Pilani clock tower, Bangalore skyline with rain tree, apartment balcony, Pondicherry yellow wall with bougainvillea |

If the actual order differs from this table, name the files by what they show, not by position.

**Special case: the tattoo icon.** It's a long horizontal forearm. Crop it to a **soft-edged circle** centred on the butterfly, like a cameo.

**Sprites:** split `t1_haldi_sprites` and `t2_marigolds` into individual petals and flowers the same way.

**Clouds:** split `s2_clouds` into four clouds.

### 4.4 Export

- WebP, quality around 78. Produce two widths for full-bleed images: 750px and 1080px wide, served via `srcset`.
- Icons: 400px max dimension. Sprites: 160px.
- Keep a manifest (`img/manifest.json`) listing every output file.
- Budget: aim for full-bleed images at 120 to 220KB each.

### 4.5 Music

Keep `music.mp3`. If it's over 4MB, re-encode it to 128kbps. Load it only after the guest taps to open (Section 7.1).

---

## 5. Visual system

### 5.1 The red thread

- Colour: vermilion `#C8102E`, with a soft glow (an SVG filter or a duplicated, blurred stroke in `rgba(255, 70, 70, 0.45)`).
- Width: 2.5px on phone, 3px on desktop, with round caps and joins.
- It has a slight organic wobble, never a ruler-straight line. Use smooth cubic Béziers and a subtle idle sway (±2px, slow) when not scrolling.
- It is drawn progressively with scroll (stroke-dashoffset tied to scroll progress). The drawn tip is where the story is.
- **It must read as one continuous thread** from Screen 1 to Screen 8. Implementation is your choice: one tall document-length SVG, or a fixed overlay whose path is recomputed per section. Whichever you choose, there must be no visible breaks, jumps or restarts between sections.
- Layering: the thread passes **behind** text cards and **in front of** background images. Around the icons, it weaves: passing behind some and in front of others.

### 5.2 Text cards (frosted glass)

Every text beat sits on a frosted card. This is how text stays readable on bright images like the white marble temple.

- Max width: `min(88vw, 420px)`. Border radius 20px. Padding 24px 22px. Centred horizontally.
- `backdrop-filter: blur(14px) saturate(1.15)`, with a semi-opaque fallback background when `backdrop-filter` is unsupported.
- **Light variant** (day scenes: S1, S3, S5, S7): `rgba(255, 250, 240, 0.55)`, dark text `#2B1D0E`.
- **Dark variant** (night scenes: S4, S6): `rgba(12, 16, 40, 0.45)`, ivory text `#FFF8EC`.
- A 1px border in `rgba(212, 175, 55, 0.55)` (soft gold) on both variants.
- When a card is on screen, the image behind it dims by 20 to 30%.
- **Exception, Screen 2 (sky):** no card. White text with a soft text-shadow directly on the sky.
- **Exception, Screen 4:** the starry sky is busy, so also add a soft dark gradient at the top of the image behind the card.

Cards enter with a gentle fade and a 12px upward drift, and leave the same way.

### 5.3 Typography

Load from Google Fonts with `display=swap`, subsetting where possible:

- **Names** ("Neil & Vishruti"): *Pinyon Script*. It echoes the printed card.
- **Titles** ("Haldi & Mehendi" etc.): *Cormorant Garamond*, 600 weight.
- **Labels** ("Theme ·", "To wear ·"): *DM Sans*, 500 weight, 12px, uppercase, 0.14em letter-spacing.
- **Body and details:** *DM Sans*, 400 weight.
- **The Sanskrit invocation** (॥ ॐ श्री गणेशाय नमः ॥): *Noto Serif Devanagari*.

**Sizes on phone:**
- Names: 44px
- Titles: 34px
- Story beats: 20px Cormorant Garamond italic
- Theme lines: 17px
- Details: 17px, with a line-height of 1.5

Scale up modestly on desktop using `clamp()`.

### 5.4 Palette accents (per card)

Use these for the thin divider, button colours and the label text:

| Card | Accent |
|---|---|
| Haldi | turmeric `#D9A21B` |
| Sangeet | starlight blue `#8FA8FF` on dark |
| Wedding | sindoor `#B3261E` and marigold `#E8891C` |
| Reception | emerald `#1F7A5C` and gold `#D4AF37` |
| RSVP and closing | vermilion `#C8102E` (the thread's own colour) |

### 5.5 Buttons

- Pill shape, minimum 48px tall, and a full-width option inside cards.
- "Get directions": outlined in the card's accent, with a small map-pin icon.
- "Count me in": solid vermilion, white text.
- Every button must have a clear pressed state.

---

## 6. Scroll timeline and exact copy

Heights are in viewport heights (vh) of scroll distance, as a starting point. Tune the pacing by feel on a real phone. Each screen is a pinned section unless stated otherwise.

**Copy rules:** everything in quotation blocks is final text. Line breaks as shown.

### Screen 0 · Tap to open (fixed overlay, not scrollable)

Background: `s1_plate`, blurred (20px) and slightly dimmed. Scrolling is locked until the guest taps.

```
॥ ॐ श्री गणेशाय नमः ॥

Neil & Vishruti

[ Tap to open ]

Best with sound on
```

On tap:
1. Start the music (fade in over 2s).
2. Fade the overlay out over 0.8s, revealing Screen 1.
3. Unlock scrolling.
4. Show the scroll hint.

### Screen 1 · The school (≈ 320vh)

Layers: `s1_plate` (background) and `s1_boy` and `s1_girl` cutouts.

- The kids start further apart than in the master (offset outward by about 12% of width each) and **move toward each other** as the guest scrolls. They stop close together, still not touching. The background drifts slowly for parallax.

- **Beat 1**, light card:
  > They say an invisible red thread connects two people who are meant to meet.

- **Beat 2**, light card:
  > It may stretch. It may tangle. It never breaks.

- **Transition:** crossfade and zoom (from about 1.0 to 1.15 scale) from the playground into `s1_hands`.

- **The tie.** The thread appears from her fingertips and draws a small loop around **his little finger**, then tightens. Its free end trails upward, off the top of the screen. Position the loop from the actual pinky coordinates in `s1_hands` (measure them).

- **Beat 3**, light card, over the hands:
  > Ours was tied in a school playground.

- **Scroll hint** ("Scroll", with a small chevron), shown on Screens 1 and 2 only, fading once the guest has scrolled 40vh.

### Screen 2 · The sky (≈ 220vh)

- **Camera tilt up:** the hands fade back to `s1_plate`, which then slides down and out of frame as `s2_sky` slides in from above. Together they read as one tall continuous image. Blend the seam with a gradient.
- **Parallax clouds:** the four clouds from `s2_clouds` drift past faster than the sky.
- **The thread rises** from the bottom of the screen up into the sky, lazily curving.

- **Text,** no card, white with a soft shadow, centred on the sky:
  > Neil & Vishruti
  >
  > invite you to celebrate their wedding
  >
  > 20 & 21 November 2026 · Prayagraj

  followed by, smaller:
  > Follow the thread ↓

- The thread turns and begins to **travel down**, leading into Haldi.

### Transition · into Haldi (≈ 80vh)

The sky warms toward yellow. The Haldi petals and leaves (`t1` sprites) begin falling: 10 to 14 on screen, with varied size, rotation, speed and sway. The thread descends through them.

### Screen 3 · Haldi & Mehendi (≈ 360vh)

**Part A (main illustration):** `s3_plate` plus the `s3_couple` cutout with gentle parallax, and falling sprites continuing.

Light card, accent turmeric:
> **Haldi & Mehendi**
>
> THEME · The School Playground
>
> Turmeric, henna, and all the mischief we never grew out of.
>
> TO WEAR · Pastel yellows and pinks

**Part B (details):** the couple fades out and `s3_plate` dims and softly blurs. The five Haldi icons appear **one by one** along the thread's path, which weaves through them like a progress bar driven by scroll. Each icon pops in (scale from 0.85 to 1, with a fade) just as the thread reaches it. Arrange them in a gentle zigzag down the screen, not a grid.

Then the light details card:
> Friday, 20 November 2026
>
> 1:00 pm onwards
>
> Hotel Rama Continental
> 29, Tashkent Marg, Civil Lines, Prayagraj
>
> [ Get directions ]

Directions link: `https://www.google.com/maps/search/?api=1&query=Hotel+Rama+Continental+29+Tashkent+Marg+Civil+Lines+Prayagraj`

### Transition · into night (≈ 100vh)

The palette cools from warm yellow through dusk to indigo. Stars fade in (CSS or canvas, twinkling subtly). The thread descends into the night.

### Screen 4 · Sangeet & Cocktails (≈ 360vh)

**Part A:** `s4_plate` plus the `s4_couple` cutout. A few extra meteor streaks animate across the sky in code, occasionally, not constantly. The fairy lights twinkle subtly. Add the top gradient behind the card (5.2).

Dark card:
> **Sangeet & Cocktails**
>
> THEME · The Prom We Never Had
>
> Our school never threw a prom. So we're throwing one, for all of us.
>
> TO WEAR · Blues, blacks and shimmer. Gowns, suits and sarees.

**Part B:** the same icon-and-thread mechanic, with the five Sangeet icons.

Dark details card:
> Friday, 20 November 2026
>
> 8:00 pm onwards
>
> Hotel Rama Continental
> 29, Tashkent Marg, Civil Lines, Prayagraj
>
> [ Get directions ]

Same directions link as Haldi.

### Transition · into morning (≈ 100vh)

Night brightens to a clear morning. Marigold sprites (`t2`) begin falling. The thread descends through them.

### Screen 5 · The Wedding (≈ 380vh)

**Part A:** `s5_plate` plus the `s5_couple` cutout. The diyas flicker subtly (a soft glow pulse on the flame positions, measured from the image). Marigolds continue falling.

Light card, accent sindoor and marigold:
> **The Wedding**
>
> THEME · Temple Mornings
>
> Many temples, many prayers, and now, one more ritual. Together.
>
> TO WEAR · Pastels and temple aesthetics

**Part B:** the icon-and-thread mechanic, with the five Wedding icons. **The desi bridge:** as the thread passes the havan kund icon, it briefly wraps a wrist-width loop, like a kalava (mauli), before continuing. Keep it subtle: 1 to 2 seconds of scroll.

Light details card:
> Saturday, 21 November 2026
>
> 12 noon onwards
>
> Welcomhotel by ITC Hotels
> 16, Tashkent Marg, Civil Lines, Prayagraj
>
> [ Get directions ]

Directions link: `https://www.google.com/maps/search/?api=1&query=Welcomhotel+by+ITC+Hotels+16+Tashkent+Marg+Civil+Lines+Prayagraj`

### Transition · into twilight (≈ 100vh)

Morning fades to a deep blue twilight, and the first stars appear.

### Screen 6 · Reception & Dinner (≈ 360vh)

**Part A:** `s6_plate` plus the `s6_couple` cutout. The building's fairy lights shimmer subtly.

Dark card, accent emerald and gold:
> **Reception & Dinner**
>
> THEME · A Mehfil Evening
>
> An evening of ghazals, old friends and older stories, with everyone who raised us.
>
> TO WEAR · Jewel tones: emeralds, sapphires and rubies

**Part B:** the icon-and-thread mechanic, with the four Reception icons.

Dark details card:
> Saturday, 21 November 2026
>
> 7:30 pm onwards
>
> Hotel Rama Continental
> 29, Tashkent Marg, Civil Lines, Prayagraj
>
> [ Get directions ]

Same directions link as Haldi.

### Transition · into Prayagraj (≈ 100vh)

Twilight gives way to golden hour. The thread travels down toward the river.

### Screen 7 · Prayagraj and RSVP (≈ 420vh)

`s7_plate` plus the `s7_couple` cutout. The water gets a subtle shimmer (a gentle animated displacement or light-sparkle overlay on the river area only). Optionally, one or two boats from `s7_boats` drift slowly, if it looks natural.

- **Beat 1**, light card:
  > In Prayagraj, three rivers meet at the Sangam.
- **Beat 2**, light card:
  > The third, Saraswati, flows unseen. A little like a certain red thread.
- **Beat 3**, light card:
  > Where rivers become one, so will two families.

Then the RSVP card, light variant, accent vermilion. This card is **not** pinned-and-scrubbed. Once it's shown, it stays until the guest scrolls past it, so they can type comfortably:

> **Will you be there?**
>
> Leave your details and we'll call you personally.

Form (details in Section 9):
- Your name
- Email
- Phone number (prefilled with `+91 `)
- `[ Count me in ]`

Messages:
- **Success:** Thank you, [Name]! Expect a call from us soon.
- **Missing field:** Please fill in all three so we can reach you.
- **Invalid phone:** That number doesn't look right. Mind checking it?
- **Submission failed:** Something went wrong. Please try again, or call us on the numbers below.

On success, replace the form inside the card with the success message. The guest should never see the form again on that device (store a flag in `localStorage`, wrapped in try/catch).

### Screen 8 · Closing (≈ 280vh)

- **Beat 1**, light card over `s7`:
  > We hope to see you there.

- **The zoom:** the camera pushes slowly into the couple on the terrace (scaling toward their hands, about 1.0 to 1.6), then crossfades into `s8_hands`.

- **The payoff.** The thread, still tied to his little finger since Screen 1, travels to her little finger, loops around it, and the two loops draw together into a small knot. It's the single most important animation on the site: make it slow, precise and beautiful. Measure the pinky positions in `s8_hands`. **The kid hands in `s1_hands` and the adult hands in `s8_hands` share the same framing: make the thread's loop on his pinky sit in the same screen position in both,** so the ending visibly rhymes with the beginning.

- **Beat 2**, after the knot, light card:
  > With love,
  > **The Sarkar & Srivastava families**
  >
  > With best compliments from little Rumi & Samriddhi
  >
  > For any queries
  > Atul Srivastava · +91 94152 70027
  > Natasha Sarkar · +91 87448 50939
  >
  > Neil & Vishruti · 21.11.2026
  >
  > [ ↺ Watch again ]

- Phone numbers are tap-to-call: `tel:+919415270027` and `tel:+918744850939`.
- "Watch again" smooth-scrolls to the top of Screen 1 over about 2s (do not replay the tap gate).

---

## 7. Persistent UI and behaviour

### 7.1 Music

- Starts only on the tap in Screen 0. Browsers block autoplay with sound, and the WhatsApp in-app browser is the strictest, so never try to autoplay.
- Loops. Fades in over 2s.
- **Sound toggle:** fixed top-right, 44×44px tap target, reading "Sound on" or "Sound off" (icon plus visually hidden label). A small frosted pill that stays unobtrusive.
- Pauses when the tab is hidden (`visibilitychange`), and resumes when it returns if the guest hadn't muted it.

### 7.2 Scroll hint

"Scroll" with a gently bobbing chevron, on Screens 1 and 2 only.

### 7.3 Reduced motion

When `prefers-reduced-motion: reduce` is set, replace parallax, zooms and falling sprites with simple crossfades. The thread still draws with scroll, but without sway. All content must remain available.

### 7.4 Desktop

The experience is phone-first. On screens wider than 600px, render the site in a centred column (max width 480px, full height), with the current scene's plate, heavily blurred, filling the rest of the screen behind it. Don't build a separate desktop layout.

### 7.5 Landscape phones

Show a gentle full-screen message, "Please turn your phone upright," with a rotate icon. Do not attempt a landscape layout.

---

## 8. Performance (non-negotiable)

- **Before the tap:** under 600KB total (HTML, CSS, JS, fonts, the blurred plate). The tap screen must appear fast, even on slow 4G.
- **After the tap:** load Screen 1 immediately, then preload each next screen's assets while the current one is showing. Never load everything up front.
- Use `srcset` for all full-bleed images.
- Keep the DOM light: remove or hide finished sections' sprites and animations when they're off screen.
- `backdrop-filter` can be expensive on low-end Android. If frame rate drops, reduce blur radius or fall back to the semi-opaque background on low-end devices.
- **Test with Chrome DevTools CPU throttling at 4× and "Fast 4G" network throttling.** The scroll must stay smooth.
- Use `100svh`/`100dvh` units correctly for mobile browser toolbars, and respect safe areas (`env(safe-area-inset-*)`).
- **Test in:** Chrome on Android, Safari on iOS, and the WhatsApp in-app browser (open the deployed link from a WhatsApp chat).

---

## 9. RSVP: Google Sheets via Apps Script

**Fields collected:** name, email, phone. Nothing else. **Do not add a guest count, plus-ones or an event selector.** The couple will call each guest personally, deliberately.

### 9.1 Apps Script

Write `apps-script/Code.gs` containing a `doPost(e)` that:
1. Parses the JSON body.
2. Rejects the submission if the honeypot field is filled.
3. Validates that name, email and phone are all non-empty.
4. Appends a row: `timestamp (IST) | name | email | phone`.
5. Returns `{ "ok": true }` as JSON.

Also write `apps-script/SETUP.md`: plain-English steps for Neil, who has never used Apps Script. It should cover creating the Sheet, adding headers, opening Extensions → Apps Script, pasting the code, deploying as a web app ("Execute as: Me", "Who has access: Anyone"), copying the web app URL, and sharing the Sheet with family as viewers or editors.

### 9.2 Front end

- POST the JSON with `Content-Type: text/plain;charset=utf-8`, which avoids a CORS preflight that Apps Script can't answer. Follow redirects.
- Keep the web app URL in a single config constant. Neil will paste it in.
- **Validation:**
  - Name: at least 2 characters.
  - Email: a basic format check.
  - Phone: accept `+91` followed by 10 digits (spaces allowed). Also accept other country codes, as `+` followed by 8 to 15 digits.
- Add a hidden honeypot field to catch spam bots.
- Disable the button while submitting, and show a small spinner.
- Use `inputmode="tel"` for phone, `type="email"` and `autocomplete` attributes, and make every field at least 16px so iOS doesn't zoom in on focus.
- **Before the URL is configured,** submissions should log to the console and show the success message, so the flow can be tested locally.

---

## 10. Meta, sharing and privacy

- `<title>`: Neil & Vishruti · 20 & 21 November 2026
- **Open Graph and Twitter tags,** for the WhatsApp link preview. This matters: it's the first thing every guest sees.
  - `og:title`: Neil & Vishruti
  - `og:description`: 20 & 21 November 2026 · Prayagraj. Follow the thread.
  - `og:image`: a 1200×630 crop of `s7_master` centred on the couple and the Sangam. Use an absolute URL on `https://neilwedsvishruti.in`, under 300KB.
- A favicon: a small red thread loop, drawn as SVG.
- `<meta name="robots" content="noindex, nofollow">` and a matching `robots.txt`. The site should be reachable by link, not by Google search.
- No analytics or third-party trackers.

---

## 11. Build process for Claude Code

Work in stages. **After each stage, run the Playwright checks (Section 12) and show Neil the screenshots before moving on.**

1. **Pipeline.** Build the asset pipeline (Section 4). Show Neil a contact sheet of every cutout, icon and sprite on a magenta background, so defects are obvious.
2. **Skeleton.** Create the Vite project, fonts, the tap gate, music and sound toggle, and empty pinned sections with the correct scroll lengths.
3. **Screens 1 and 2**, including the thread tie and the tilt into the sky. Get these feeling right before building the rest: they set the quality bar.
4. **Screens 3 to 6.** Build one card, get it right, then reuse the pattern for the other three.
5. **Screens 7 and 8,** with the RSVP (and the Apps Script files) and the closing knot.
6. **Polish.** Transitions, the reduced-motion path, desktop column, landscape message, meta tags.
7. **Performance pass,** with throttling (Section 8).
8. **Deploy.** Deploy to Vercel **only after Neil approves**, and walk him through attaching `neilwedsvishruti.in` (adding the domain in Vercel, then entering the DNS records at his registrar).

---

## 12. Playwright checks

Use Playwright at a 390×844 viewport (and also 360×800, which is common on Android).

- Scroll through the whole site in steps and screenshot every beat. Check:
  - Text is readable over every image.
  - Nothing overflows horizontally.
  - The thread is visible and continuous across section boundaries.
  - The pinky loops in S1 and S8 sit on the pinkies.
- Test the RSVP form: empty submission, invalid phone, and a valid submission.
- Record a scripted, smooth full scroll-through as a video. Neil will use it as the Instagram/WhatsApp status version of the invite, so make that recording beautiful: an even pace, and pauses on each card long enough to read.

---

## 13. Things NOT to do

- Don't add copy, captions under icons, emojis, confetti, or "countdown to the wedding" widgets.
- Don't add a "skip to details" button or a navigation menu.
- Don't bake the thread or any text into images.
- Don't autoplay audio.
- Don't collect anything beyond name, email and phone.
- Don't read, copy or deploy anything from `sources/`.
- Don't use em dashes anywhere in the site's text.

# TASA EFX — auth.js Setup Guide

## What this file does
One script added to every page handles:
- Sign-in button in the nav
- Access code validation
- Full/preview data switching on Platinum & rLCA pages
- Airtable logging of sign-ins (name, email, industry, code, page, timestamp)
- Floating feedback button (comment, feature request, name, email, page)

---

## Step 1 — Folder structure

Create this structure in your website folder:

```
your-website/
  auth.js                       ← this file
  index.html
  silver.html
  platinum.html
  rlca.html
  data/
    free/
      platinum-preview.xlsx     ← limited data (always visible)
      rlca-preview.xlsx         ← limited data (always visible)
    premium/
      platinum-full.xlsx        ← full data (access code required)
      rlca-full.xlsx            ← full data (access code required)
```

Silver always loads the same CSV — no change needed there.

---

## Step 2 — Add auth.js to every page

Add this line before `</body>` on all four pages:

```html
<script src="auth.js"></script>
```

---

## Step 3 — Update platinum.html to switch data files

Find the line near the top of the `<script>` block in platinum.html
that defines `XLSX_FILE`. It currently looks like:

```javascript
const XLSX_FILE = 'platinum.xlsx';   // or similar
```

Replace it with:

```javascript
const XLSX_FILE = window.TASA_AUTH?.isUnlocked
  ? 'data/premium/platinum-full.xlsx'
  : 'data/free/platinum-preview.xlsx';
```

Then add this at the bottom of the script so the page reloads
its data when someone signs in mid-session:

```javascript
window.addEventListener('tasaAuthChanged', () => {
  // Re-run boot — reloads whichever file is now correct
  boot();   // rename your existing (async()=>{...})() to boot()
});
```

---

## Step 4 — Same change for rlca.html

Find `XLSX_FILE` in rlca.html and replace with:

```javascript
const XLSX_FILE = window.TASA_AUTH?.isUnlocked
  ? 'data/premium/rlca-full.xlsx'
  : 'data/free/rlca-preview.xlsx';
```

And add the same event listener at the bottom.

---

## Step 5 — Add your access codes

Open auth.js and find the `accessCodes` section near the top:

```javascript
accessCodes: {
  'CONF-PLAT-2025':  { expires: '2025-12-31' },
  'CONF-PLAT-2026':  { expires: '2026-12-31' },
  'TASA-DEMO-01':    { expires: '2099-01-01' },
},
```

Add or edit codes here. Format: `'CODE': { expires: 'YYYY-MM-DD' }`.
Codes are case-insensitive — users can type in any case.

---

## Step 6 — Set up Airtable (two tables, one base)

1. Go to airtable.com and create a new base called **TASA EFX**

2. Create a table called **Sign-ins** with these columns:
   - Name (Single line text)
   - Email (Email)
   - Industry (Single line text)
   - Code (Single line text)
   - Page (Single line text)
   - Timestamp (Single line text)
   - Status (Single line text) — will be "Valid", "Expired", or "Invalid"

3. Create a table called **Feedback** with these columns:
   - Name (Single line text)
   - Email (Email)
   - Page (Single line text)
   - Comment (Long text)
   - Feature Request (Long text)
   - Timestamp (Single line text)

4. Get your API key:
   Go to airtable.com/account → Developer Hub → Personal access tokens
   Create a token with scopes: data.records:write

5. Get your Base ID:
   Open your base → Help → API documentation
   Your base ID starts with "app" (e.g. appXXXXXXXXXXXXXX)

6. Paste both into auth.js:

```javascript
signInAirtable: {
  baseId:  'appXXXXXXXXXXXXXX',
  table:   'Sign-ins',
  apiKey:  'patXXXXXXXXXXXXXX'
},
feedbackAirtable: {
  baseId:  'appXXXXXXXXXXXXXX',   // same base ID
  table:   'Feedback',
  apiKey:  'patXXXXXXXXXXXXXX'    // same API key
},
```

---

## Step 7 — Test locally

Test with the code `TASA-DEMO-01` (expires year 2099 — safe for testing).

Checklist:
- [ ] Sign-in button appears in nav on all pages
- [ ] Entering TASA-DEMO-01 shows the success state and user pill
- [ ] Platinum and rLCA switch to premium data files after sign-in
- [ ] Preview banner shows on Platinum/rLCA when not signed in
- [ ] Access banner shows when signed in
- [ ] Feedback button appears bottom-right on all pages
- [ ] Feedback form pre-fills name/email when signed in
- [ ] Sign out clears the session and reverts to preview data
- [ ] Airtable receives both sign-in and feedback rows (once keys are added)

---

## Later — swapping to AWS Lambda

When you're ready, open auth.js and replace the `validateCode()` function:

```javascript
// CURRENT (local):
function validateCode(code) {
  const upper = (code || '').trim().toUpperCase();
  const match = TASA_CONFIG.accessCodes[upper];
  if (!match) return { valid: false, expired: false };
  const today = new Date().toISOString().slice(0, 10);
  if (match.expires < today) return { valid: false, expired: true };
  return { valid: true, expired: false };
}

// REPLACE WITH (AWS Lambda):
async function validateCode(code) {
  const res = await fetch('https://YOUR-LAMBDA-URL.amazonaws.com/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  return res.json();  // expects { valid: true/false, expired: true/false }
}
```

Also change `submitSignin()` to use `await validateCode(code)` instead of
the direct call (add `async` to the function and `await` to the call).
Nothing else in the frontend changes.

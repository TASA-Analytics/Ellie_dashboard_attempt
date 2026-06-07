/* ============================================================
   TASA EFX — auth.js  (Netlify version) - updated without secrets
  
   Handles: sign-in modal, session management, feedback button,
            logging via Netlify Function (no API keys here).

   HOW TO USE:
   1. Add <script src="auth.js"></script> before </body> on
      every page (index, silver, platinum, rlca).
   2. Add netlify/functions/log.js to your repo (provided).
   3. Add AIRTABLE_TOKEN and AIRTABLE_BASE_ID to Netlify
      environment variables — never in this file.
   4. In platinum.html and rlca.html use:
        const XLSX_FILE = window.TASA_AUTH?.isUnlocked
          ? 'data/premium/platinum-full.xlsx'
          : 'data/free/platinum-preview.xlsx';
   5. Listen for auth state change to reload data:
        window.addEventListener('tasaAuthChanged', boot);

   SWAPPING TO AWS LATER:
   Replace validateCode() with a fetch() to your Lambda URL.
   Nothing else changes.
   ============================================================ */


/* ── CONFIG ─────────────────────────────────────────────────── */
// No API keys here — all secrets live in Netlify environment
// variables and are only used inside netlify/functions/log.js

const TASA_CONFIG = {

  // Access codes — format: 'CODE': { expires: 'YYYY-MM-DD' }
  // Codes are case-insensitive. Add more before each conference.
  accessCodes: {
    'CONF-PLAT-2025': { expires: '2025-12-31' },
    'CONF-PLAT-2026': { expires: '2026-12-31' },
    'TASA-DEMO-01':   { expires: '2099-01-01' },
  },

  // Netlify function endpoint — this never changes
  logEndpoint: '/.netlify/functions/log'

};


/* ── SESSION ─────────────────────────────────────────────────── */
// sessionStorage persists across page navigation but clears
// when the browser tab is closed.

function getSession() {
  try {
    const raw = sessionStorage.getItem('tasa_session');
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function setSession(data) {
  try { sessionStorage.setItem('tasa_session', JSON.stringify(data)); }
  catch(e) {}
}

function clearSession() {
  sessionStorage.removeItem('tasa_session');
}

// Exposed globally so platinum.html / rlca.html can check
// window.TASA_AUTH.isUnlocked before deciding which file to fetch
window.TASA_AUTH = {
  isUnlocked: false,
  user: null
};

function refreshAuthState() {
  const session = getSession();
  if (session && session.isUnlocked) {
    window.TASA_AUTH.isUnlocked = true;
    window.TASA_AUTH.user = session.user;
  } else {
    window.TASA_AUTH.isUnlocked = false;
    window.TASA_AUTH.user = null;
  }
}


/* ── CODE VALIDATION ─────────────────────────────────────────── */
// Runs entirely in the browser against the accessCodes list above.
// TO SWAP TO AWS: replace this function body with a fetch() to
// your Lambda URL and add async/await to submitSignin().

function validateCode(code) {
  const upper = (code || '').trim().toUpperCase();
  const match = TASA_CONFIG.accessCodes[upper];
  if (!match) return { valid: false, expired: false };
  const today = new Date().toISOString().slice(0, 10);
  if (match.expires < today) return { valid: false, expired: true };
  return { valid: true, expired: false };
}


/* ── LOGGING VIA NETLIFY FUNCTION ────────────────────────────── */
// Posts to /.netlify/functions/log which holds the Airtable token
// server-side. No secret is ever exposed to the browser.

async function logEvent(table, fields) {
  try {
    await fetch(TASA_CONFIG.logEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, fields })
    });
  } catch(e) {
    console.warn('Log failed (non-critical):', e.message);
  }
}

function currentPage() {
  const p = window.location.pathname.split('/').pop() || 'index.html';
  return p.replace('.html', '').replace('index', 'home') || 'home';
}


/* ── STYLES ──────────────────────────────────────────────────── */

const TASA_STYLES = `
  #tasa-signin-btn {
    background: #FFBB00;
    color: #050d1a;
    border: none;
    border-radius: 6px;
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  #tasa-signin-btn:hover { opacity: 0.88; }

  #tasa-user-pill {
    display: none;
    align-items: center;
    gap: 8px;
    background: rgba(0,69,171,0.2);
    border: 1px solid rgba(0,69,171,0.4);
    border-radius: 20px;
    padding: 4px 14px 4px 8px;
    cursor: default;
  }
  #tasa-user-pill.visible { display: flex; }
  .tasa-user-dot {
    width: 24px; height: 24px; border-radius: 50%;
    background: #0045AB;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff;
    flex-shrink: 0;
  }
  .tasa-user-name { font-size: 12px; color: #A7CCE7; }
  #tasa-signout-link {
    font-size: 11px; color: rgba(244,245,245,0.35);
    cursor: pointer; margin-left: 6px;
    background: none; border: none; font-family: inherit;
    padding: 0; transition: color 0.15s;
  }
  #tasa-signout-link:hover { color: rgba(244,245,245,0.7); }

  #tasa-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(2,6,16,0.88);
    z-index: 9000;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none;
    transition: opacity 0.2s;
  }
  #tasa-modal-overlay.open { opacity: 1; pointer-events: all; }
  #tasa-modal {
    background: #0a1628;
    border: 1px solid rgba(0,69,171,0.35);
    border-radius: 16px;
    padding: 32px 28px;
    width: 100%; max-width: 380px;
    transform: translateY(16px);
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
    position: relative;
  }
  #tasa-modal-overlay.open #tasa-modal { transform: translateY(0); }
  .tasa-modal-close {
    position: absolute; top: 14px; right: 16px;
    background: none; border: none; color: rgba(244,245,245,0.35);
    font-size: 20px; cursor: pointer; line-height: 1;
    font-family: inherit; transition: color 0.15s;
  }
  .tasa-modal-close:hover { color: rgba(244,245,245,0.8); }
  .tasa-modal-icon { font-size: 28px; margin-bottom: 14px; display: block; }
  .tasa-modal-title {
    font-size: 18px; font-weight: 700;
    color: #F4F5F5; margin-bottom: 6px;
  }
  .tasa-modal-sub {
    font-size: 13px; color: rgba(244,245,245,0.45);
    margin-bottom: 22px; line-height: 1.55;
  }
  .tasa-modal-label {
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: rgba(244,245,245,0.4);
    display: block; margin-bottom: 5px;
  }
  .tasa-modal-label span { color: #FFBB00; font-size: 10px; margin-left: 2px; }
  .tasa-modal-input {
    width: 100%;
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid rgba(0,69,171,0.35);
    background: #050d1a;
    color: #F4F5F5;
    font-size: 13px;
    font-family: inherit;
    margin-bottom: 14px;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .tasa-modal-input:focus { outline: none; border-color: rgba(0,69,171,0.7); }
  .tasa-modal-input::placeholder { color: rgba(244,245,245,0.2); }
  .tasa-code-input {
    font-family: monospace;
    letter-spacing: 0.12em;
    font-size: 15px;
    text-transform: uppercase;
  }
  .tasa-modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .tasa-submit-btn {
    width: 100%;
    background: #0045AB;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 11px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    margin-top: 4px;
    transition: opacity 0.15s;
  }
  .tasa-submit-btn:hover { opacity: 0.88; }
  .tasa-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .tasa-modal-note {
    font-size: 11px; color: rgba(244,245,245,0.3);
    text-align: center; margin-top: 12px; line-height: 1.5;
  }
  .tasa-error-msg {
    font-size: 12px; color: #F09595;
    background: rgba(240,149,149,0.08);
    border: 1px solid rgba(240,149,149,0.2);
    border-radius: 6px; padding: 8px 12px;
    margin-bottom: 12px; display: none;
  }
  .tasa-success-msg {
    font-size: 12px; color: #A7F3D0;
    background: rgba(167,243,208,0.08);
    border: 1px solid rgba(167,243,208,0.2);
    border-radius: 6px; padding: 8px 12px;
    margin-bottom: 12px; display: none;
  }

  #tasa-access-banner {
    display: none;
    background: rgba(167,243,208,0.06);
    border-bottom: 1px solid rgba(167,243,208,0.15);
    padding: 8px 32px;
    font-size: 12px; color: #A7F3D0;
    align-items: center; gap: 8px;
  }
  #tasa-access-banner.visible { display: flex; }

  #tasa-preview-banner {
    display: none;
    background: rgba(255,187,0,0.06);
    border-bottom: 1px solid rgba(255,187,0,0.15);
    padding: 8px 32px;
    font-size: 12px; color: rgba(255,187,0,0.8);
    align-items: center; justify-content: space-between; gap: 8px;
  }
  #tasa-preview-banner.visible { display: flex; }
  #tasa-preview-banner button {
    background: #FFBB00; color: #050d1a;
    border: none; border-radius: 5px;
    padding: 4px 12px; font-size: 11px;
    font-weight: 700; cursor: pointer;
    font-family: inherit; white-space: nowrap;
  }

  #tasa-feedback-btn {
    position: fixed; bottom: 28px; right: 28px;
    background: #0045AB; color: #F4F5F5;
    border: none; border-radius: 50px;
    padding: 10px 20px; font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit; z-index: 8000;
    display: flex; align-items: center; gap: 7px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    transition: background 0.15s, transform 0.15s;
  }
  #tasa-feedback-btn:hover { background: #0055d4; transform: translateY(-2px); }

  #tasa-feedback-overlay {
    position: fixed; inset: 0;
    background: rgba(2,6,16,0.88);
    z-index: 9000;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none;
    transition: opacity 0.2s;
  }
  #tasa-feedback-overlay.open { opacity: 1; pointer-events: all; }
  #tasa-feedback-modal {
    background: #0a1628;
    border: 1px solid rgba(0,69,171,0.35);
    border-radius: 16px; padding: 32px 28px;
    width: 100%; max-width: 400px;
    transform: translateY(16px);
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
    position: relative;
  }
  #tasa-feedback-overlay.open #tasa-feedback-modal { transform: translateY(0); }
  #tasa-feedback-modal textarea {
    width: 100%;
    background: #050d1a;
    border: 1px solid rgba(0,69,171,0.35);
    border-radius: 8px; color: #F4F5F5;
    font-family: inherit; font-size: 13px;
    padding: 10px 12px; resize: vertical;
    min-height: 90px; margin-bottom: 14px;
    box-sizing: border-box; transition: border-color 0.2s;
  }
  #tasa-feedback-modal textarea:focus { outline: none; border-color: rgba(0,69,171,0.7); }
  #tasa-feedback-modal textarea::placeholder { color: rgba(244,245,245,0.2); }
  .tasa-page-tag {
    display: inline-block; padding: 2px 9px; border-radius: 4px;
    font-size: 11px; font-weight: 600;
    background: rgba(0,69,171,0.2); color: #A7CCE7;
    border: 1px solid rgba(0,69,171,0.3); margin-bottom: 16px;
  }
`;

function injectStyles() {
  const el = document.createElement('style');
  el.textContent = TASA_STYLES;
  document.head.appendChild(el);
}


/* ── NAV ─────────────────────────────────────────────────────── */

function injectNav() {
  const nav = document.querySelector('nav');
  if (!nav) return;

  const signinBtn = document.createElement('button');
  signinBtn.id = 'tasa-signin-btn';
  signinBtn.textContent = 'Sign in';
  signinBtn.onclick = openSigninModal;
  nav.appendChild(signinBtn);

  const pill = document.createElement('div');
  pill.id = 'tasa-user-pill';
  pill.innerHTML = `
    <div class="tasa-user-dot" id="tasa-user-initials">?</div>
    <span class="tasa-user-name" id="tasa-user-label">Signed in</span>
    <button id="tasa-signout-link" onclick="tasaSignOut()">Sign out</button>
  `;
  nav.appendChild(pill);
}


/* ── BANNERS ─────────────────────────────────────────────────── */

function injectBanners() {
  const nav = document.querySelector('nav');
  if (!nav) return;

  const accessBanner = document.createElement('div');
  accessBanner.id = 'tasa-access-banner';
  accessBanner.innerHTML = `<span>✓</span><span id="tasa-banner-text">Full access active</span>`;
  nav.after(accessBanner);

  const page = currentPage();
  if (page === 'platinum' || page === 'rlca') {
    const previewBanner = document.createElement('div');
    previewBanner.id = 'tasa-preview-banner';
    previewBanner.innerHTML = `
      <span>⬡ Preview mode — showing sample data. Sign in with an access code to unlock the full dataset.</span>
      <button onclick="openSigninModal()">Sign in</button>
    `;
    accessBanner.after(previewBanner);
  }
}


/* ── SIGN-IN MODAL ───────────────────────────────────────────── */

function injectSigninModal() {
  const overlay = document.createElement('div');
  overlay.id = 'tasa-modal-overlay';
  overlay.innerHTML = `
    <div id="tasa-modal">
      <button class="tasa-modal-close" onclick="closeSigninModal()" aria-label="Close">×</button>
      <span class="tasa-modal-icon">🔑</span>
      <p class="tasa-modal-title">Sign in to TASA EFX</p>
      <p class="tasa-modal-sub">
        Silver data is always free and visible. Enter an access code
        to unlock the full Platinum and rLCA datasets.
      </p>
      <div id="tasa-signin-error" class="tasa-error-msg"></div>
      <label class="tasa-modal-label">Access code <span>required</span></label>
      <input
        class="tasa-modal-input tasa-code-input"
        id="tasa-code-input"
        type="text"
        placeholder="e.g. CONF-PLAT-2025"
        autocomplete="off"
        oninput="this.value=this.value.toUpperCase()"
      />
      <div class="tasa-modal-row">
        <div>
          <label class="tasa-modal-label">Name</label>
          <input class="tasa-modal-input" id="tasa-name-input" type="text" placeholder="Jane Smith" />
        </div>
        <div>
          <label class="tasa-modal-label">Industry</label>
          <input class="tasa-modal-input" id="tasa-industry-input" type="text" placeholder="e.g. Energy" />
        </div>
      </div>
      <label class="tasa-modal-label">Email</label>
      <input class="tasa-modal-input" id="tasa-email-input" type="email" placeholder="jane@company.com" />
      <button class="tasa-submit-btn" id="tasa-signin-submit" onclick="submitSignin()">
        Unlock access
      </button>
      <p class="tasa-modal-note">Silver data remains visible to all visitors without signing in.</p>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSigninModal(); });
  document.body.appendChild(overlay);
}

function openSigninModal() {
  document.getElementById('tasa-modal-overlay').classList.add('open');
  document.getElementById('tasa-signin-error').style.display = 'none';
  setTimeout(() => document.getElementById('tasa-code-input').focus(), 100);
}

function closeSigninModal() {
  document.getElementById('tasa-modal-overlay').classList.remove('open');
}

async function submitSignin() {
  const code     = (document.getElementById('tasa-code-input').value     || '').trim();
  const name     = (document.getElementById('tasa-name-input').value     || '').trim();
  const industry = (document.getElementById('tasa-industry-input').value || '').trim();
  const email    = (document.getElementById('tasa-email-input').value    || '').trim();
  const errEl    = document.getElementById('tasa-signin-error');
  const btn      = document.getElementById('tasa-signin-submit');

  errEl.style.display = 'none';

  if (!code) {
    errEl.textContent = 'Please enter your access code.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Checking…';

  const result = validateCode(code);

  // Log attempt to Airtable via Netlify function — no token in this file
  logEvent('Sign-ins', {
    'Name':      name      || '(not provided)',
    'Email':     email     || '(not provided)',
    'Industry':  industry  || '(not provided)',
    'Code':      code,
    'Page':      currentPage(),
    'Timestamp': new Date().toISOString(),
    'Status':    result.valid ? 'Valid' : result.expired ? 'Expired' : 'Invalid'
  });

  if (result.valid) {
    setSession({ isUnlocked: true, user: { name, email, industry, code } });
    refreshAuthState();
    closeSigninModal();
    updateNavUI();
    updateBanners();
    window.dispatchEvent(new Event('tasaAuthChanged'));
  } else {
    btn.disabled = false;
    btn.textContent = 'Unlock access';
    errEl.textContent = result.expired
      ? 'This access code has expired. Please contact TASA EFX for a new code.'
      : 'Code not recognised. Check for typos or contact your account manager.';
    errEl.style.display = 'block';
  }
}

function tasaSignOut() {
  clearSession();
  refreshAuthState();
  updateNavUI();
  updateBanners();
  window.dispatchEvent(new Event('tasaAuthChanged'));
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeSigninModal(); closeFeedbackModal(); }
});


/* ── NAV UI ──────────────────────────────────────────────────── */

function updateNavUI() {
  const signinBtn = document.getElementById('tasa-signin-btn');
  const userPill  = document.getElementById('tasa-user-pill');
  const initials  = document.getElementById('tasa-user-initials');
  const label     = document.getElementById('tasa-user-label');

  if (window.TASA_AUTH.isUnlocked) {
    signinBtn.style.display = 'none';
    userPill.classList.add('visible');
    const name = window.TASA_AUTH.user?.name || '';
    initials.textContent = name
      ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
      : '✓';
    label.textContent = name || 'Access active';
  } else {
    signinBtn.style.display = '';
    userPill.classList.remove('visible');
  }
}


/* ── BANNERS UI ──────────────────────────────────────────────── */

function updateBanners() {
  const accessBanner  = document.getElementById('tasa-access-banner');
  const previewBanner = document.getElementById('tasa-preview-banner');
  const bannerText    = document.getElementById('tasa-banner-text');

  if (window.TASA_AUTH.isUnlocked) {
    if (accessBanner) {
      const name = window.TASA_AUTH.user?.name ? ` · ${window.TASA_AUTH.user.name}` : '';
      bannerText.textContent = `Full Platinum & rLCA access active${name}`;
      accessBanner.classList.add('visible');
    }
    if (previewBanner) previewBanner.classList.remove('visible');
  } else {
    if (accessBanner)  accessBanner.classList.remove('visible');
    if (previewBanner) previewBanner.classList.add('visible');
  }
}


/* ── FEEDBACK ────────────────────────────────────────────────── */

function injectFeedbackButton() {
  const btn = document.createElement('button');
  btn.id = 'tasa-feedback-btn';
  btn.innerHTML = '&#128172; Feedback';
  btn.onclick = openFeedbackModal;
  document.body.appendChild(btn);
}

function injectFeedbackModal() {
  const overlay = document.createElement('div');
  overlay.id = 'tasa-feedback-overlay';
  overlay.innerHTML = `
    <div id="tasa-feedback-modal">
      <button class="tasa-modal-close" onclick="closeFeedbackModal()" aria-label="Close">×</button>
      <p class="tasa-modal-title">Share feedback</p>
      <p class="tasa-modal-sub">Help us improve TASA EFX — all feedback is reviewed by the team.</p>
      <div class="tasa-page-tag" id="tasa-fb-page-tag"></div>
      <div id="tasa-feedback-success" class="tasa-success-msg">Thanks — your feedback has been sent!</div>
      <div id="tasa-feedback-error" class="tasa-error-msg"></div>
      <div class="tasa-modal-row">
        <div>
          <label class="tasa-modal-label">Name</label>
          <input class="tasa-modal-input" id="tasa-fb-name" type="text" placeholder="Jane Smith" />
        </div>
        <div>
          <label class="tasa-modal-label">Email</label>
          <input class="tasa-modal-input" id="tasa-fb-email" type="email" placeholder="jane@company.com" />
        </div>
      </div>
      <label class="tasa-modal-label">Comment or question</label>
      <textarea id="tasa-fb-comment" placeholder="What's on your mind?"></textarea>
      <label class="tasa-modal-label">Feature request</label>
      <textarea id="tasa-fb-feature" placeholder="Is there something you'd like us to add or improve?" style="min-height:70px;"></textarea>
      <button class="tasa-submit-btn" id="tasa-fb-submit" onclick="submitFeedback()">Send feedback</button>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeFeedbackModal(); });
  document.body.appendChild(overlay);
}

function openFeedbackModal() {
  const user = window.TASA_AUTH.user;
  if (user?.name)  document.getElementById('tasa-fb-name').value  = user.name;
  if (user?.email) document.getElementById('tasa-fb-email').value = user.email;
  document.getElementById('tasa-fb-page-tag').textContent = 'Page: ' + currentPage();
  document.getElementById('tasa-feedback-success').style.display = 'none';
  document.getElementById('tasa-feedback-error').style.display   = 'none';
  document.getElementById('tasa-feedback-overlay').classList.add('open');
}

function closeFeedbackModal() {
  document.getElementById('tasa-feedback-overlay').classList.remove('open');
}

async function submitFeedback() {
  const name    = (document.getElementById('tasa-fb-name').value    || '').trim();
  const email   = (document.getElementById('tasa-fb-email').value   || '').trim();
  const comment = (document.getElementById('tasa-fb-comment').value || '').trim();
  const feature = (document.getElementById('tasa-fb-feature').value || '').trim();
  const errEl   = document.getElementById('tasa-feedback-error');
  const sucEl   = document.getElementById('tasa-feedback-success');
  const btn     = document.getElementById('tasa-fb-submit');

  errEl.style.display = 'none';

  if (!comment && !feature) {
    errEl.textContent = 'Please add a comment or feature request before sending.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  await logEvent('Feedback', {
    'Name':            name    || '(not provided)',
    'Email':           email   || '(not provided)',
    'Page':            currentPage(),
    'Comment':         comment || '',
    'Feature Request': feature || '',
    'Timestamp':       new Date().toISOString()
  });

  btn.disabled = false;
  btn.textContent = 'Send feedback';
  sucEl.style.display = 'block';
  document.getElementById('tasa-fb-comment').value = '';
  document.getElementById('tasa-fb-feature').value = '';
  setTimeout(closeFeedbackModal, 2500);
}


/* ── BOOT ────────────────────────────────────────────────────── */

(function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

function setup() {
  injectStyles();
  refreshAuthState();
  injectNav();
  injectBanners();
  injectSigninModal();
  injectFeedbackButton();
  injectFeedbackModal();
  updateNavUI();
  updateBanners();
}

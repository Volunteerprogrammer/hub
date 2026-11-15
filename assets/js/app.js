/**
 * Woodend Community Emergency HUB — site logic.
 *
 * - Hash-based SPA routing (#intro, #what, ...) driven by PAGES in content.js
 * - Polls api/status.php every few seconds so the status banner stays live
 *   in every open tab/window without the visitor doing anything.
 * - A hidden admin panel is revealed by typing a secret word anywhere on
 *   the page (see EASTER_EGG_CODE below) — it posts a new status to the
 *   server, which every open page then picks up on its next poll.
 */
(function () {
  'use strict';

  var STATUS_ENDPOINT = 'api/status.php';
  var LOCATION_ENDPOINT = 'api/location.php';
  var VERIFY_ENDPOINT = 'api/verify.php';
  var STATUS_POLL_MS = 5000;

  // Type this anywhere on the page (not in a text field) to open the
  // admin panel. Change it here if you want a different secret word.
  var EASTER_EGG_CODE = 'hubadmin';

  // Kept in sync with default_location() in api/location.php, so the
  // admin panel's "Reset to default" button matches what the server
  // falls back to if location.json is ever missing.
  var DEFAULT_VENUE = 'Woodend Neighbourhood House';
  var DEFAULT_ADDRESS = '47 Forest Street, Woodend';

  // Kept in sync with EVENT_KEYS in api/status.php.
  var EVENT_KEYS = ['bushfire', 'storm', 'heatwave'];
  var EVENT_LABELS = { bushfire: 'BUSHFIRE', storm: 'STORM', heatwave: 'HEATWAVE' };

  var ADVICE_TITLE_OPEN = 'GET ADVICE NOW';
  var ADVICE_TITLE_CLOSED = 'Where to get Advice';

  /* --------------------------- Routing --------------------------- */

  var mainEl = document.getElementById('main');
  var menuLinks = Array.prototype.slice.call(document.querySelectorAll('.menu-link'));

  function isHubOpen() {
    return !!(currentStatusData && currentStatusData.status === 'NOW OPEN');
  }

  function pageIdFromHash() {
    var id = (window.location.hash || '').replace(/^#/, '');
    if (id && PAGES[id]) return id;
    // No (valid) #hash was given, so this is the "landing page" case —
    // which page that lands on depends on whether the Hub is open. This
    // is only evaluated once, at boot, before the first render (see
    // boot() at the bottom of this file) — a status change while
    // someone is already browsing never forces a navigation away from
    // whatever page they're reading.
    return isHubOpen() ? 'where' : DEFAULT_PAGE;
  }

  function pageTitleFor(id, page) {
    if (id === 'advice') {
      return isHubOpen() ? ADVICE_TITLE_OPEN : ADVICE_TITLE_CLOSED;
    }
    return page.title;
  }

  function renderPage(id) {
    var page = PAGES[id] || PAGES[DEFAULT_PAGE];
    var title = pageTitleFor(id, page);

    document.title = 'Woodend Community Emergency HUB — ' + title;
    mainEl.innerHTML = '<h1>' + title + '</h1>' + page.html;

    // Jump straight to the top on every page change, regardless of how
    // far down the previous page was scrolled. `instant` overrides the
    // site-wide smooth-scroll CSS so this is a snap, not an animation.
    // Deferred a frame so it's the last word after this frame's layout
    // (overflow-anchor: none on .site-main handles the rest — see CSS).
    requestAnimationFrame(function () {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
    mainEl.focus();

    if (id === 'where') {
      // The map/venue/address elements were just rebuilt from scratch and
      // are empty, so force applyLocation() to populate them even if the
      // location data itself hasn't changed since last time.
      lastRenderedLocationKey = null;
      applyLocation(currentLocationData); // show cached data immediately, if any
      fetchLocation(); // then refresh from the server
      updateRelocationNotice();
    }

    if (id === 'advice') {
      updateAdviceVisibility();
    }

    menuLinks.forEach(function (link) {
      var isActive = link.getAttribute('data-page') === id;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    // Collapse the mobile menu after a selection.
    menuListEl.classList.remove('open');
    menuToggleEl.setAttribute('aria-expanded', 'false');
  }

  function initRouter() {
    menuLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        var id = link.getAttribute('data-page');
        if (window.location.hash === '#' + id) {
          renderPage(id);
        } else {
          window.location.hash = id;
        }
      });
    });

    window.addEventListener('hashchange', function () {
      renderPage(pageIdFromHash());
    });

    renderPage(pageIdFromHash());
  }

  /* ----------------------------- Menu ------------------------------ */

  var menuToggleEl = document.querySelector('.menu-toggle');
  var menuListEl = document.getElementById('menu-list');

  function initMenuToggle() {
    menuToggleEl.addEventListener('click', function () {
      var isOpen = menuListEl.classList.toggle('open');
      menuToggleEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  /* --------------------------- Status ------------------------------ */

  var statusBannerEl = document.getElementById('status-banner');
  var statusTextEl = document.getElementById('status-text');
  var statusIconEl = document.getElementById('status-icon');
  var menuAdviceLinkEl = document.getElementById('menu-advice-link');

  var transitionOverlayEl = document.getElementById('status-transition-overlay');
  var transitionIconEl = document.getElementById('status-transition-icon');
  var transitionMessageEl = document.getElementById('status-transition-message');
  var transitionCloseBtn = document.getElementById('status-transition-close');

  var currentStatusData = null;

  function activeEventLabels(event) {
    event = event || {};
    return EVENT_KEYS.filter(function (k) { return event[k]; }).map(function (k) { return EVENT_LABELS[k]; });
  }

  function applyStatus(data) {
    currentStatusData = data;

    var status = data && data.status;

    if (status === 'NOW OPEN') {
      document.body.setAttribute('data-status', 'open');
      statusIconEl.textContent = '✅'; // check mark
      var labels = activeEventLabels(data.event);
      statusTextEl.textContent = labels.length ? 'NOW OPEN — ' + labels.join(' + ') : 'The HUB is currently OPEN';
    } else if (status === 'CLOSED') {
      document.body.setAttribute('data-status', 'closed');
      statusIconEl.textContent = '⛔'; // no entry
      statusTextEl.textContent = 'The HUB is currently CLOSED';
    } else {
      document.body.setAttribute('data-status', 'unknown');
      statusIconEl.textContent = '❓';
      statusTextEl.textContent = 'Hub status unavailable';
    }

    if (menuAdviceLinkEl) {
      menuAdviceLinkEl.textContent = isHubOpen() ? ADVICE_TITLE_OPEN : ADVICE_TITLE_CLOSED;
    }

    updateDemoToggleLabel(); // TEMPORARY — see block near the bottom of this file

    // These are no-ops if their page isn't currently rendered.
    updateRelocationNotice();
    updateAdviceVisibility();
  }

  // Shows every advice block while the Hub is closed (general
  // reference) or while open with no event ticked (safety fallback —
  // better to show everything than to accidentally hide all advice
  // during a real emergency because of an admin oversight). While open
  // with event(s) set, only the matching block(s) show.
  function updateAdviceVisibility() {
    var blocks = document.querySelectorAll('.advice-block');
    if (!blocks.length) return; // not currently on the "Get Advice" page

    var event = (currentStatusData && currentStatusData.event) || {};
    var activeKeys = EVENT_KEYS.filter(function (k) { return event[k]; });
    var showAll = !isHubOpen() || activeKeys.length === 0;

    blocks.forEach(function (block) {
      var key = block.getAttribute('data-event');
      block.hidden = !(showAll || event[key]);
    });
  }

  // Tracks the last status this tab has actually seen (as opposed to
  // currentStatusData, which can momentarily hold a value from a
  // call that lost the out-of-order race — see applyStatusIfNewer).
  // Starts null so the very first check on page load just seeds this
  // rather than popping up a "transition" the moment the page opens.
  var lastSeenStatusKey = null;

  // Prevents the popup reappearing for the *same* transition (e.g. a
  // second poll tick landing before it's been dismissed). Reset to
  // false on close, so a later, genuinely new transition can still pop
  // it again.
  var transitionPopupShown = false;

  function closeStatusTransitionPopup() {
    transitionOverlayEl.classList.add('hidden');
    transitionPopupShown = false;
  }

  // Wired once, rather than inside showStatusTransitionPopup(), so
  // repeated open/close cycles never stack duplicate listeners.
  transitionCloseBtn.addEventListener('click', closeStatusTransitionPopup);

  function showStatusTransitionPopup(data) {
    if (transitionPopupShown) return;
    transitionPopupShown = true;

    // The page's content has already switched modes reactively by this
    // point (applyStatus() already ran) — this is just announcing that,
    // not asking for any action to make it happen.
    var labels = activeEventLabels(data.event);
    var line1, line2;

    if (data.status === 'NOW OPEN') {
      transitionIconEl.textContent = '✅';
      line1 = 'The HUB is now OPEN' + (labels.length ? ' — ' + labels.join(' + ') : '') + '.';
      line2 = 'This page has switched into “NOW OPEN” mode.';
    } else {
      transitionIconEl.textContent = '⛔';
      line1 = 'The HUB is now CLOSED.';
      line2 = 'This page has switched into “CLOSED” mode.';
    }

    // Safe to use innerHTML here — line1/line2 are built only from our
    // own fixed literal strings (never from user/admin-entered text).
    transitionMessageEl.innerHTML = line1 + '<br>' + line2;

    transitionOverlayEl.classList.remove('hidden');
  }

  // Called after every poll with whichever status is currently in
  // effect (see the fetchStatus()/initStatusPolling() call sites) —
  // pops the refresh prompt only when that differs from what this tab
  // last saw, i.e. an actual open<->closed transition, not just a
  // repeat poll or an event-flag-only change while staying open.
  function checkStatusTransition(data) {
    var newKey = data && data.status;
    if (!newKey) return;

    if (lastSeenStatusKey !== null && newKey !== lastSeenStatusKey) {
      showStatusTransitionPopup(data);
    }
    lastSeenStatusKey = newKey;
  }

  // Requests can resolve out of order (e.g. a background poll that was
  // already in flight when an admin save goes out can land *after* the
  // save's own response). Tagging each request with an ever-increasing
  // sequence number and only ever applying the highest one seen means a
  // late, stale response can never clobber a newer one.
  var statusRequestSeq = 0;
  var lastAppliedStatusSeq = -1;

  function applyStatusIfNewer(seq, data) {
    if (seq < lastAppliedStatusSeq) return;
    lastAppliedStatusSeq = seq;
    applyStatus(data);
  }

  function fetchStatus() {
    var seq = ++statusRequestSeq;
    fetch(STATUS_ENDPOINT, { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (data) {
        applyStatusIfNewer(seq, data);
        // Checked against currentStatusData (whichever response actually
        // won the ordering race above) rather than this call's own
        // `data`, so a stale/losing response here can't be mistaken for
        // a transition.
        checkStatusTransition(currentStatusData);
      })
      .catch(function () {
        // Leave the last-known status on screen rather than alarming the
        // visitor over a single missed request.
      });
  }

  // Returns a promise that resolves once the very first status check has
  // either landed or failed. boot() (bottom of file) waits on this
  // before doing the first render, so the open/closed landing-page
  // decision in pageIdFromHash() has real data to work with — without
  // this, a cold load would always render as "closed mode" first and
  // potentially flash/jump afterward.
  function initStatusPolling() {
    var seq = ++statusRequestSeq;
    var firstCheck = fetch(STATUS_ENDPOINT, { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (data) {
        applyStatusIfNewer(seq, data);
        checkStatusTransition(currentStatusData); // just seeds lastSeenStatusKey at boot — never pops here
      })
      .catch(function () {
        // No response in time for the first render — fall back to the
        // default (closed-mode) landing page rather than blocking.
      });

    setInterval(fetchStatus, STATUS_POLL_MS);
    return firstCheck;
  }

  /* --------------------------- Location ----------------------------- */

  var currentLocationData = null;
  var lastRenderedLocationKey = null;

  // Needs both the current location and the current status, so it's
  // called from applyStatus() too — not just from here. Placed above
  // the element-existence check below (and the location-unchanged
  // early-return further down) so it always re-evaluates even when
  // this particular call ends up a no-op for the rest of the function.
  function updateRelocationNotice() {
    var noticeEl = document.getElementById('hub-relocation-notice');
    if (!noticeEl) return; // not currently on the "Where is it?" page

    var venue = (currentLocationData && currentLocationData.venue) || '';
    var address = (currentLocationData && currentLocationData.address) || '';
    var isRelocated = !!currentLocationData && (venue !== DEFAULT_VENUE || address !== DEFAULT_ADDRESS);

    noticeEl.hidden = !(isHubOpen() && isRelocated);
  }

  function applyLocation(data) {
    if (!data) return;
    currentLocationData = data;
    updateRelocationNotice();

    var venueEl = document.getElementById('hub-venue');
    var addressEl = document.getElementById('hub-address');
    var mapFrameEl = document.getElementById('hub-map-frame');
    var directionsEl = document.getElementById('hub-directions-link');

    // These only exist while the "Where is it?" page is showing.
    if (!venueEl || !addressEl || !mapFrameEl || !directionsEl) return;

    var venue = data.venue || '';
    var address = data.address || '';
    var key = venue + '|' + address;

    // Re-setting the iframe's src on every poll (even to the same URL)
    // makes the browser reload the embedded map, which looks like the
    // page is refreshing. Only touch the DOM when the location actually
    // changed since the last time it was rendered.
    if (key === lastRenderedLocationKey) return;
    lastRenderedLocationKey = key;

    var query = encodeURIComponent([venue, address].filter(Boolean).join(', '));

    venueEl.textContent = venue;
    addressEl.textContent = address;
    mapFrameEl.title = 'Map showing ' + venue + ', ' + address;
    // t=m forces the plain road map layer (otherwise this embed trick can
    // default to whatever layer — including satellite — the visitor's
    // browser last used on Google Maps).
    mapFrameEl.src = 'https://maps.google.com/maps?q=' + query + '&z=14&t=m&output=embed';
    directionsEl.href = 'https://www.google.com/maps/dir/?api=1&destination=' + query;
  }

  // Same out-of-order protection as fetchStatus() above — see that
  // comment for why this matters (it's what let a reset-and-save appear
  // to silently revert).
  var locationRequestSeq = 0;
  var lastAppliedLocationSeq = -1;

  function applyLocationIfNewer(seq, data) {
    if (seq < lastAppliedLocationSeq) return;
    lastAppliedLocationSeq = seq;
    applyLocation(data);
  }

  function fetchLocation() {
    var seq = ++locationRequestSeq;
    fetch(LOCATION_ENDPOINT, { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (data) { applyLocationIfNewer(seq, data); })
      .catch(function () {
        // Leave whatever is already on screen rather than blanking it out
        // over a single missed request.
      });
  }

  function initLocationPolling() {
    fetchLocation();
    setInterval(fetchLocation, STATUS_POLL_MS);
  }

  /* ------------------------- Admin / easter egg --------------------- */

  var adminOverlayEl = document.getElementById('admin-overlay');
  var adminPasswordEl = document.getElementById('admin-password');
  var adminUnlockBtn = document.getElementById('admin-unlock');
  var adminUnlockMessageEl = document.getElementById('admin-unlock-message');
  var adminControlsEl = document.getElementById('admin-controls');
  var adminMessageEl = document.getElementById('admin-message');
  var adminVenueEl = document.getElementById('admin-venue');
  var adminAddressEl = document.getElementById('admin-address');
  var adminEventEls = {
    bushfire: document.getElementById('admin-event-bushfire'),
    storm: document.getElementById('admin-event-storm'),
    heatwave: document.getElementById('admin-event-heatwave'),
  };
  var keyBuffer = '';

  function openAdminPanel() {
    adminOverlayEl.classList.remove('hidden');
    adminMessageEl.textContent = '';
    adminMessageEl.className = 'admin-message';
    adminUnlockMessageEl.textContent = '';
    adminUnlockMessageEl.className = 'admin-message';
    adminPasswordEl.value = '';
    adminControlsEl.disabled = true; // re-locked every time the panel is opened
    adminVenueEl.value = (currentLocationData && currentLocationData.venue) || '';
    adminAddressEl.value = (currentLocationData && currentLocationData.address) || '';

    var event = (currentStatusData && currentStatusData.event) || {};
    EVENT_KEYS.forEach(function (k) { adminEventEls[k].checked = !!event[k]; });

    // Defer the focus (and clear again just after) so the keystroke that
    // triggered this doesn't land in the password field once it gains focus.
    setTimeout(function () {
      adminPasswordEl.value = '';
      adminPasswordEl.focus();
    }, 0);
  }

  function unlockAdminPanel() {
    var password = adminPasswordEl.value;

    if (!password) {
      adminUnlockMessageEl.textContent = 'Enter the password first.';
      adminUnlockMessageEl.className = 'admin-message error';
      return;
    }

    adminUnlockMessageEl.textContent = 'Checking…';
    adminUnlockMessageEl.className = 'admin-message';
    adminUnlockBtn.disabled = true;

    fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.body && result.body.error ? result.body.error : 'Incorrect password.');
        }
        adminControlsEl.disabled = false;
        adminUnlockMessageEl.textContent = 'Unlocked.';
        adminUnlockMessageEl.className = 'admin-message success';
      })
      .catch(function (err) {
        adminUnlockMessageEl.textContent = err.message || 'Something went wrong.';
        adminUnlockMessageEl.className = 'admin-message error';
      })
      .finally(function () {
        adminUnlockBtn.disabled = false;
      });
  }

  function closeAdminPanel() {
    adminOverlayEl.classList.add('hidden');
  }

  function submitStatus(newStatus) {
    var password = adminPasswordEl.value;
    var event = {};
    EVENT_KEYS.forEach(function (k) { event[k] = adminEventEls[k].checked; });

    adminMessageEl.textContent = 'Updating…';
    adminMessageEl.className = 'admin-message';

    // Reserve the sequence number now (when the save is sent), not when
    // its response arrives — that's what lets it outrank any poll GET
    // that was already in flight.
    var seq = ++statusRequestSeq;

    fetch(STATUS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password, status: newStatus, event: event }),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.body && result.body.error ? result.body.error : 'Update failed.');
        }
        applyStatusIfNewer(seq, result.body);
        // Seed the baseline directly rather than going through
        // checkStatusTransition() — the admin who just made this change
        // doesn't need (or want) their own tab popping up a refresh
        // prompt and closing the panel they're actively using. Other
        // open tabs/visitors still get it on their next poll.
        lastSeenStatusKey = result.body.status;
        adminMessageEl.textContent = 'Status updated — now "' + result.body.status + '".';
        adminMessageEl.className = 'admin-message success';
      })
      .catch(function (err) {
        adminMessageEl.textContent = err.message || 'Something went wrong.';
        adminMessageEl.className = 'admin-message error';
      });
  }

  function submitLocation() {
    var password = adminPasswordEl.value;
    var venue = adminVenueEl.value.trim();
    var address = adminAddressEl.value.trim();

    if (!venue || !address) {
      adminMessageEl.textContent = 'Venue and address are both required.';
      adminMessageEl.className = 'admin-message error';
      return;
    }

    adminMessageEl.textContent = 'Saving…';
    adminMessageEl.className = 'admin-message';

    // See the matching comment in submitStatus() — reserving the
    // sequence number here lets this save outrank any poll GET that was
    // already in flight when it was sent.
    var seq = ++locationRequestSeq;

    fetch(LOCATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password, venue: venue, address: address }),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.body && result.body.error ? result.body.error : 'Update failed.');
        }
        applyLocationIfNewer(seq, result.body);
        adminMessageEl.textContent = 'Location updated.';
        adminMessageEl.className = 'admin-message success';
      })
      .catch(function (err) {
        adminMessageEl.textContent = err.message || 'Something went wrong.';
        adminMessageEl.className = 'admin-message error';
      });
  }

  function initAdminPanel() {
    document.getElementById('admin-close').addEventListener('click', closeAdminPanel);
    adminUnlockBtn.addEventListener('click', unlockAdminPanel);
    adminPasswordEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        unlockAdminPanel();
      }
    });
    document.getElementById('admin-set-open').addEventListener('click', function () { submitStatus('NOW OPEN'); });
    document.getElementById('admin-set-closed').addEventListener('click', function () { submitStatus('CLOSED'); });
    document.getElementById('admin-save-location').addEventListener('click', submitLocation);
    document.getElementById('admin-reset-location').addEventListener('click', function () {
      adminVenueEl.value = DEFAULT_VENUE;
      adminAddressEl.value = DEFAULT_ADDRESS;
      adminMessageEl.textContent = 'Default address filled in — click "Save location" to apply it.';
      adminMessageEl.className = 'admin-message';
    });

    // Close on a genuine click on the backdrop — but only if the click
    // actually started there too. Without this, selecting text by
    // dragging from inside a field and releasing past its edge can end
    // up with a 'click' whose target is the backdrop, closing the panel
    // mid-selection.
    var mouseDownOnBackdrop = false;
    adminOverlayEl.addEventListener('mousedown', function (event) {
      mouseDownOnBackdrop = event.target === adminOverlayEl;
    });
    adminOverlayEl.addEventListener('click', function (event) {
      if (mouseDownOnBackdrop && event.target === adminOverlayEl) closeAdminPanel();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !adminOverlayEl.classList.contains('hidden')) {
        closeAdminPanel();
      }
    });
  }

  function initEasterEgg() {
    document.addEventListener('keydown', function (event) {
      // Ignore key combinations and typing anywhere inside the admin panel.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (adminOverlayEl.contains(event.target)) return;

      var key = event.key;
      if (key.length !== 1) return; // ignore Shift, Enter, arrows, etc.

      keyBuffer = (keyBuffer + key).toLowerCase().slice(-EASTER_EGG_CODE.length);
      if (keyBuffer === EASTER_EGG_CODE) {
        keyBuffer = '';
        openAdminPanel();
      }
    });
  }

  /* ------------------------------ Footer ----------------------------- */

  function initFooterYear() {
    document.getElementById('footer-year').textContent = String(new Date().getFullYear());
  }

  /* ================================================================
   * TEMPORARY DEMO CONTROL
   *
   * Lets the status be flipped between CLOSED and NOW OPEN (bushfire)
   * from a visible button, with no password prompt, so the site can be
   * shown to stakeholders without anyone needing to go near the real
   * admin panel.
   *
   * It works by calling the same status.php endpoint the admin panel
   * uses, with the real admin password hardcoded below — so nothing
   * server-side has been weakened, but that password IS now sitting in
   * this page's source for as long as this block exists.
   *
   * ⚠️ DELETE THIS BLOCK (and #demo-toggle-btn in index.html, and
   * .demo-toggle-btn in style.css) once the demo is done. If this page
   * was ever reachable on a non-local/public URL while this was in
   * place, change the admin password afterwards too (see
   * api/config.php for how).
   * ================================================================ */

  var DEMO_PASSWORD = 'WoodendHub2026';
  var demoToggleBtn = document.getElementById('demo-toggle-btn');

  function updateDemoToggleLabel() {
    if (!demoToggleBtn) return;
    demoToggleBtn.textContent = isHubOpen() ? 'DEMO: Set CLOSED' : 'DEMO: Set OPEN (Bushfire)';
  }

  function demoToggleStatus() {
    var goingOpen = !isHubOpen();
    var newStatus = goingOpen ? 'NOW OPEN' : 'CLOSED';
    var event = { bushfire: goingOpen, storm: false, heatwave: false };
    var seq = ++statusRequestSeq;

    demoToggleBtn.disabled = true;

    fetch(STATUS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: DEMO_PASSWORD, status: newStatus, event: event }),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.body && result.body.error ? result.body.error : 'Demo toggle failed.');
        }
        applyStatusIfNewer(seq, result.body);
        // Same reasoning as submitStatus() — seed silently so flipping
        // this repeatedly mid-demo doesn't pop the refresh-prompt modal
        // on the presenter's own browser.
        lastSeenStatusKey = result.body.status;
      })
      .catch(function (err) {
        window.alert(err.message || 'Demo toggle failed.');
      })
      .finally(function () {
        demoToggleBtn.disabled = false;
      });
  }

  function initDemoToggle() {
    if (!demoToggleBtn) return;
    updateDemoToggleLabel();
    demoToggleBtn.addEventListener('click', demoToggleStatus);
  }

  /* ================================================================
   * END TEMPORARY DEMO CONTROL
   * ================================================================ */

  /* ------------------------------- Init ------------------------------ */

  function boot() {
    initMenuToggle();
    initLocationPolling();
    initAdminPanel();
    initEasterEgg();
    initFooterYear();
    initDemoToggle(); // TEMPORARY — see block above; remove this line too when deleting it

    // initRouter() does the first render, which is the one place the
    // open/closed landing-page decision happens — so it waits for the
    // first status check (initStatusPolling() kicks off polling either
    // way, win or lose).
    initStatusPolling().then(initRouter);
  }

  boot();
})();

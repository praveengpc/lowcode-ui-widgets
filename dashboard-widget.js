/**
 * dashboard-widget.js
 *
 * Web Component conversion of the original mount()/unmount() task-list POC
 * script. Built the same way as frontendtips-menu.js / simple-spa-menu.js:
 * a real custom element with its own Shadow DOM, registered once via
 * customElements.define(). No getElementById lookups, no hardcoded
 * container id anywhere in this file.
 *
 * Tag name: kept as "dashboard-widget" — the same tag already used by the
 * OutSystems screen — rather than introducing a new one, since that screen
 * is not republished when this script changes.
 *
 * Why this matters for OutSystems: the original script needed a container
 * id (mount("someId", ...)) and a JS function reference (options.onComplete)
 * handed to it at mount time. Neither survives OutSystems' runtime DOM
 * generation cleanly — ids and JS references aren't things Service Studio
 * can wire up. A custom element fixes both:
 *   - No id needed: connectedCallback() fires the moment <dashboard-widget>
 *     appears anywhere in the DOM, regardless of what id OutSystems
 *     generated around it.
 *   - No function reference needed: instead of an onComplete callback,
 *     completing a task fires a normal CustomEvent ("os-task-complete")
 *     that bubbles and crosses the Shadow DOM boundary (composed: true),
 *     so OutSystems can just addEventListener() from an Extra Script /
 *     OnReady handler and call a client action from there.
 *
 * Usage in OutSystems:
 *   1. Upload this file as a resource and add it to the module's (or
 *      Theme's) Extra Scripts, so customElements.define() runs once when
 *      the app loads.
 *   2. On any screen, drop an HTML widget and put this inside it:
 *        <dashboard-widget heading="Operations dashboard"></dashboard-widget>
 *      The "heading" attribute is optional (defaults to "Operations
 *      dashboard").
 *   3. To react to task completion, attach a listener once, e.g. in an
 *      Extra Script or a small inline <script>:
 *
 *        document.addEventListener('os-task-complete', function (e) {
 *          // e.detail.id, e.detail.title
 *          // call your OutSystems client action here
 *        });
 *
 *      (The event bubbles up to document, so one listener covers every
 *      <dashboard-widget> instance on the page.)
 *
 * IMPORTANT: keep the tag name "dashboard-widget" the same across future
 * versions of this file — the screen referencing it isn't republished when
 * this script changes. Also note: if another script on the same page
 * already registers "dashboard-widget" for a different component (e.g. an
 * earlier chart-based version), only the one that loads first will win —
 * make sure this file is the one actually referenced in Extra Scripts.
 */
(function () {
  'use strict';

  var initialTasks = [
    { id: 1, title: 'Review warehouse layout', owner: 'Alex', status: 'Open' },
    { id: 2, title: 'Approve maintenance request', owner: 'Sam', status: 'Open' },
    { id: 3, title: 'Confirm delivery schedule', owner: 'Jordan', status: 'Completed' }
  ];

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  class DashboardWidget extends HTMLElement {
    constructor() {
      super();
      // Shadow DOM: styles and ids here can't leak out, and the host
      // page's CSS can't accidentally break this component either.
      this.attachShadow({ mode: 'open' });
      this._tasks = initialTasks.map(function (t) { return Object.assign({}, t); });
      this._query = '';
      this._filter = 'All';
      this._message = '';
      this._built = false;
    }

    static get observedAttributes() {
      return ['heading'];
    }

    // Runs automatically the moment <dashboard-widget> is inserted into
    // the page — this is the only "hook" this component needs.
    connectedCallback() {
      if (!this._built) {
        this.buildShell();
        this._built = true;
      }
      this.update();
    }

    attributeChangedCallback(name) {
      if (name === 'heading' && this._built) {
        var h2 = this.shadowRoot.querySelector('h2');
        if (h2) h2.textContent = this.getAttribute('heading') || 'Operations dashboard';
      }
    }

    // Builds the static shell once. Only the dynamic sub-elements
    // (.ospoc-stats, the <ul>, and the message div) are rebuilt on every
    // update() call — the search input and select stay untouched, so
    // typing in the search box never loses focus.
    buildShell() {
      var self = this;
      var heading = this.getAttribute('heading') || 'Operations dashboard';

      this.shadowRoot.innerHTML =
        '<style>' + DashboardWidget.styles() + '</style>' +
        '<section class="ospoc">' +
        '<div class="ospoc-label">OUTSYSTEMS UI POC &middot; VERSION 1</div>' +
        '<h2>' + escapeHtml(heading) + '</h2>' +
        '<p>A custom UI loaded from a JavaScript file.</p>' +
        '<div class="ospoc-stats"></div>' +
        '<div class="ospoc-controls">' +
        '<label>Search tasks<input type="search" placeholder="Search by task or owner"></label>' +
        '<label>Status<select>' +
        '<option>All</option><option>Open</option><option>Completed</option>' +
        '</select></label>' +
        '</div>' +
        '<ul class="ospoc-list" aria-label="Tasks"></ul>' +
        '<div class="ospoc-message" role="status" aria-live="polite"></div>' +
        '</section>';

      var root = this.shadowRoot;

      // Listeners live on the shadow root itself (event delegation), so
      // they survive the targeted child updates done in update().
      root.addEventListener('input', function (e) {
        if (e.target.matches('input')) {
          self._query = e.target.value;
          self.update();
        }
      });

      root.addEventListener('change', function (e) {
        if (e.target.matches('select')) {
          self._filter = e.target.value;
          self.update();
        }
      });

      root.addEventListener('click', function (e) {
        var button = e.target.closest('button[data-id]');
        if (!button || button.disabled) return;

        var task = self._tasks.find(function (t) { return t.id === Number(button.dataset.id); });
        if (!task) return;

        task.status = 'Completed';
        self._message = task.title + ' completed.';
        self.update();

        // No function reference to pass in from the host page — OutSystems
        // (or any host) just listens for this event instead.
        self.dispatchEvent(new CustomEvent('os-task-complete', {
          detail: { id: task.id, title: task.title },
          bubbles: true,
          composed: true
        }));
      });
    }

    update() {
      var root = this.shadowRoot;
      var tasks = this._tasks;

      var stats = root.querySelector('.ospoc-stats');
      stats.replaceChildren();
      [
        ['Total', tasks.length],
        ['Open', tasks.filter(function (t) { return t.status === 'Open'; }).length],
        ['Completed', tasks.filter(function (t) { return t.status === 'Completed'; }).length]
      ].forEach(function (pair) {
        var card = document.createElement('div');
        card.className = 'ospoc-stat';
        var value = document.createElement('strong');
        value.textContent = pair[1];
        card.append(value, document.createTextNode(pair[0]));
        stats.append(card);
      });

      var list = root.querySelector('ul');
      list.replaceChildren();
      var query = this._query.toLowerCase();
      var filter = this._filter;
      var visible = tasks.filter(function (t) {
        return (filter === 'All' || t.status === filter) &&
          (t.title + ' ' + t.owner).toLowerCase().includes(query);
      });

      visible.forEach(function (t) {
        var row = document.createElement('li');
        var info = document.createElement('div');
        var owner = document.createElement('small');
        var button = document.createElement('button');

        info.textContent = t.title;
        owner.textContent = t.owner + ' \u00b7 ' + t.status;
        info.append(owner);

        button.type = 'button';
        button.textContent = t.status === 'Completed' ? 'Completed' : 'Mark complete';
        button.disabled = t.status === 'Completed';
        button.dataset.id = String(t.id);

        row.append(info, button);
        list.append(row);
      });

      if (!visible.length) {
        var empty = document.createElement('li');
        empty.textContent = 'No matching tasks.';
        list.append(empty);
      }

      root.querySelector('.ospoc-message').textContent = this._message;
    }

    // Matches the shipped OutSystems screen: no big outer card around the
    // whole widget — the eyebrow/title/subtitle sit directly on the host
    // page's background, and only the stat tiles, the inputs, and the
    // task list each get their own white, bordered surface. Colors are
    // exposed as custom properties so a host page can retheme without
    // touching this file, e.g.:
    //   <dashboard-widget style="--accent:#2a78d6"></dashboard-widget>
    static styles() {
      return (
        ':host {' +
        '  display: block;' +
        '  color-scheme: light;' +
        '  --surface-1: #ffffff;' +
        '  --text-primary: #11151c;' +
        '  --text-secondary: #5b6472;' +
        '  --text-muted: #7a8290;' +
        '  --border: #e2e5ea;' +
        '  --divider: #eef0f3;' +
        '  --eyebrow: #0f7d70;' +
        '  --accent: #0f7d70;' +
        '  --accent-contrast: #ffffff;' +
        '  --completed-bg: #eaf6f2;' +
        '  --completed-text: #4b5b58;' +
        '  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;' +
        '}' +
        '@media (prefers-color-scheme: dark) {' +
        '  :host {' +
        '    color-scheme: dark;' +
        '    --surface-1: #1c1f24;' +
        '    --text-primary: #f2f3f5;' +
        '    --text-secondary: #b7bec8;' +
        '    --text-muted: #8b93a0;' +
        '    --border: #33383f;' +
        '    --divider: #2b2f35;' +
        '    --eyebrow: #35b39f;' +
        '    --accent: #35b39f;' +
        '    --accent-contrast: #06110f;' +
        '    --completed-bg: #223330;' +
        '    --completed-text: #b7bec8;' +
        '  }' +
        '}' +
        '* { box-sizing: border-box; }' +
        '.ospoc { color: var(--text-primary); padding: 24px; }' +
        '.ospoc-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--eyebrow); margin-bottom: 8px; }' +
        '.ospoc h2 { margin: 0 0 6px; font-size: 26px; font-weight: 700; }' +
        '.ospoc > p { margin: 0 0 24px; color: var(--text-secondary); font-size: 14px; }' +
        '.ospoc-stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }' +
        '.ospoc-stat { display: flex; flex-direction: column; gap: 2px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 18px 22px; flex: 1 1 160px; }' +
        '.ospoc-stat strong { font-size: 28px; font-weight: 700; color: var(--text-primary); line-height: 1.15; }' +
        '.ospoc-stat { font-size: 14px; color: var(--text-secondary); }' +
        '.ospoc-controls { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }' +
        '.ospoc-controls label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary); flex: 1 1 220px; }' +
        '.ospoc-controls input, .ospoc-controls select { font: inherit; font-size: 14px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-1); color: var(--text-primary); }' +
        '.ospoc-controls input::placeholder { color: var(--text-muted); }' +
        '.ospoc-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-1); overflow: hidden; }' +
        '.ospoc-list li { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 22px; border-bottom: 1px solid var(--divider); }' +
        '.ospoc-list li:last-child { border-bottom: none; }' +
        '.ospoc-list li > div { display: flex; flex-direction: column; gap: 2px; font-size: 15px; font-weight: 600; }' +
        '.ospoc-list li small { color: var(--text-muted); font-size: 13px; font-weight: 400; }' +
        'button { font: inherit; font-size: 14px; font-weight: 600; padding: 10px 18px; border-radius: 8px; border: none; background: var(--accent); color: var(--accent-contrast); cursor: pointer; white-space: nowrap; }' +
        'button:not(:disabled):hover { filter: brightness(1.08); }' +
        'button:disabled { cursor: default; background: var(--completed-bg); color: var(--completed-text); }' +
        '.ospoc-message { min-height: 18px; margin-top: 14px; font-size: 13px; color: var(--text-secondary); }'
      );
    }
  }

  if (!customElements.get('dashboard-widget')) {
    customElements.define('dashboard-widget', DashboardWidget);
  }
})();

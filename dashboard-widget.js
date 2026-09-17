
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
        '<ul aria-label="Tasks"></ul>' +
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

    static styles() {
      return (
        ':host {' +
        '  display: block;' +
        '  color-scheme: light;' +
        '  --surface-1: #fcfcfb;' +
        '  --surface-2: #f3f3ef;' +
        '  --text-primary: #0b0b0b;' +
        '  --text-secondary: #52514e;' +
        '  --text-muted: #898781;' +
        '  --border: rgba(11, 11, 11, 0.12);' +
        '  --accent: #2a78d6;' +
        '  --accent-contrast: #ffffff;' +
        '  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;' +
        '}' +
        '@media (prefers-color-scheme: dark) {' +
        '  :host {' +
        '    color-scheme: dark;' +
        '    --surface-1: #1a1a19;' +
        '    --surface-2: #232322;' +
        '    --text-primary: #ffffff;' +
        '    --text-secondary: #c3c2b7;' +
        '    --text-muted: #898781;' +
        '    --border: rgba(255, 255, 255, 0.14);' +
        '    --accent: #3987e5;' +
        '    --accent-contrast: #ffffff;' +
        '  }' +
        '}' +
        '* { box-sizing: border-box; }' +
        '.ospoc { background: var(--surface-1); color: var(--text-primary); padding: 24px; border: 1px solid var(--border); border-radius: 10px; }' +
        '.ospoc-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 8px; }' +
        '.ospoc h2 { margin: 0 0 4px; font-size: 20px; }' +
        '.ospoc > p { margin: 0 0 16px; color: var(--text-secondary); font-size: 13px; }' +
        '.ospoc-stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }' +
        '.ospoc-stat { display: flex; flex-direction: column; gap: 2px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px; font-size: 12px; color: var(--text-secondary); min-width: 90px; }' +
        '.ospoc-stat strong { font-size: 20px; color: var(--text-primary); }' +
        '.ospoc-controls { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }' +
        '.ospoc-controls label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary); flex: 1 1 200px; }' +
        '.ospoc-controls input, .ospoc-controls select { font: inherit; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-primary); }' +
        'ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }' +
        'li { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }' +
        'li > div { display: flex; flex-direction: column; gap: 2px; font-size: 14px; }' +
        'li small { color: var(--text-muted); font-size: 12px; }' +
        'button { font: inherit; font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-contrast); cursor: pointer; white-space: nowrap; }' +
        'button:disabled { opacity: 0.55; cursor: default; background: var(--surface-1); color: var(--text-muted); border-color: var(--border); }' +
        'button:not(:disabled):hover { filter: brightness(1.08); }' +
        '.ospoc-message { min-height: 18px; margin-top: 12px; font-size: 12px; color: var(--text-secondary); }'
      );
    }
  }

  if (!customElements.get('dashboard-widget')) {
    customElements.define('dashboard-widget', DashboardWidget);
  }
})();

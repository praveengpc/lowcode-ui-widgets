/**
 * dashboard-widget.js
 *
 * Production version of the pasted "OutSystemsPOC.mount()" script, rebuilt
 * in the same shape as frontendtips-menu.js / simple-spa-menu.js: a real
 * custom element with its own Shadow DOM, registered once via
 * customElements.define(). No document.getElementById() lookup on a
 * container id anywhere in this file.
 *
 * NOTE ON THE TAG NAME: this registers as <dashboard-widget>, the same
 * tag used by the project's other dashboard-widget.js example (the
 * revenue/users charts component), per instruction to always reuse that
 * tag name for this element rather than pick a new one per version. Both
 * scripts call customElements.define(), guarded with
 * `if (!customElements.get('dashboard-widget'))` — so if BOTH files are
 * ever loaded on the same OutSystems screen (e.g. one in module Extra
 * Scripts and one in a Theme), only whichever one's script tag executes
 * first will actually register, and the other's define() call will be
 * silently skipped. Make sure only one "dashboard-widget" file is active
 * per app/theme at a time, or the wrong component will render.
 *
 * Why this matters for OutSystems: the original script exposed
 * window.OutSystemsPOC.mount(containerId, options) and hunted for a fixed
 * container id. OutSystems generates its own DOM ids at runtime (they
 * change per render / per screen instance), so that lookup can silently
 * fail to find its target, and the mount/unmount lifecycle had to be
 * managed by hand. A custom element removes both problems: the browser
 * calls connectedCallback() the moment <dashboard-widget> appears anywhere
 * in the DOM, and disconnectedCallback() cleans up automatically when it's
 * removed — no id, no manual mount()/unmount() bookkeeping.
 *
 * What changed vs. the original, and why:
 *   1. Shadow DOM instead of a plain <section> appended to a host element,
 *      so this component's ids/classes/CSS can never collide with the
 *      OutSystems screen's own markup, and multiple instances on one
 *      screen don't clash.
 *   2. The shell (label, heading, description, search box, filter select)
 *      is built once in connectedCallback(); only the stats/list/message
 *      are rebuilt on state changes. This is what the original code
 *      already did (render() only touched .ospoc-stats/ul/.ospoc-message)
 *      — kept here so the search input never loses focus while typing.
 *   3. The options.onComplete(id, title) callback is replaced with a
 *      bubbling, shadow-crossing CustomEvent('task-completed'). This
 *      decouples the component from OutSystems entirely — it works the
 *      same whether or not anything is listening — and matches how
 *      OutSystems JS nodes normally wire up to a widget: by listening on
 *      the element itself, not by passing it a callback at construction
 *      time.
 *   4. Added ARIA labeling on the search box, filter select and per-row
 *      buttons, an aria-live message region (kept from the original),
 *      and focus-visible styling for keyboard users.
 *   5. Added a small public API (getTasks / setTasks / markComplete) so
 *      an OutSystems JS node can drive the component programmatically,
 *      in addition to listening for its events.
 *   6. customElements.define() is guarded against double-registration,
 *      matching every other file in this project.
 *
 * Usage in OutSystems:
 *   1. Upload this file as a resource and add it to the module's (or
 *      Theme's) Extra Scripts, so customElements.define() runs once when
 *      the app loads.
 *   2. On any screen, drop an HTML widget and put this inside it:
 *        <dashboard-widget heading="Operations dashboard"></dashboard-widget>
 *      The `heading` attribute is optional and reactive.
 *   3. To react to a completed task, add a JS node (e.g. on screen ready)
 *      that does:
 *        document.querySelector('dashboard-widget')
 *          .addEventListener('task-completed', function (e) {
 *            // e.detail.id, e.detail.title
 *            // call an OutSystems client/server action here
 *          });
 *      If your handler determines the OutSystems-side action failed, call
 *      e.preventDefault() inside it — the component will show an inline
 *      error message when that happens.
 *   4. IMPORTANT: keep the tag name "dashboard-widget" unchanged in future
 *      versions of this file — the OutSystems screen that references it
 *      is not republished when the script changes.
 */
(function () {
  'use strict';

  var DEFAULT_HEADING = 'Operations dashboard';
  var STATUSES = ['All', 'Open', 'Completed'];

  var defaultTasks = [
    { id: 1, title: 'Review warehouse layout', owner: 'Alex', status: 'Open' },
    { id: 2, title: 'Approve maintenance request', owner: 'Sam', status: 'Open' },
    { id: 3, title: 'Confirm delivery schedule', owner: 'Jordan', status: 'Completed' }
  ];

  class OpsTaskTracker extends HTMLElement {
    constructor() {
      super();
      // Shadow DOM: this component's markup, styles and internal ids can
      // never clash with the host page's, or with anything OutSystems
      // generates around it — and multiple instances stay independent.
      this.attachShadow({ mode: 'open' });

      this._tasks = defaultTasks.map(function (t) { return Object.assign({}, t); });
      this._query = '';
      this._filter = 'All';
      this._message = '';
      this._built = false;

      // Bind once so add/removeEventListener reference the same function.
      this._onInput = this._onInput.bind(this);
      this._onChange = this._onChange.bind(this);
      this._onClick = this._onClick.bind(this);
    }

    static get observedAttributes() {
      return ['heading'];
    }

    // Runs the moment <dashboard-widget> is inserted into the page.
    connectedCallback() {
      if (!this._built) {
        this.buildShell();
        this._built = true;
      }
      this.renderList();
    }

    // Runs automatically if the element is ever removed — no manual
    // unmount() call needed, unlike the original mount/unmount API.
    disconnectedCallback() {
      this.shadowRoot.removeEventListener('input', this._onInput);
      this.shadowRoot.removeEventListener('change', this._onChange);
      this.shadowRoot.removeEventListener('click', this._onClick);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === 'heading' && this._built) {
        var h = this.shadowRoot.querySelector('.ospoc-heading');
        if (h) h.textContent = newValue || DEFAULT_HEADING;
      }
    }

    // ---- Public API, for an OutSystems JS node holding a reference to
    // this element (e.g. via document.querySelector('dashboard-widget')). ----

    getTasks() {
      return this._tasks.map(function (t) { return Object.assign({}, t); });
    }

    setTasks(tasks) {
      if (!Array.isArray(tasks)) return;
      this._tasks = tasks.map(function (t) { return Object.assign({}, t); });
      this._message = '';
      if (this._built) this.renderList();
    }

    markComplete(id) {
      var task = this._tasks.find(function (t) { return t.id === id; });
      if (!task || task.status === 'Completed') return;
      task.status = 'Completed';
      this._message = task.title + ' completed.';
      this.renderList();
      this._notifyComplete(task);
    }

    // ---- Shell: built once. Re-rendering only the parts below it keeps
    // the search input and select focused/usable while the user types. ----
    buildShell() {
      var heading = this.getAttribute('heading') || DEFAULT_HEADING;

      this.shadowRoot.innerHTML =
        '<style>' + OpsTaskTracker.styles() + '</style>' +
        '<section class="ospoc">' +
        '<div class="ospoc-label">OUTSYSTEMS UI POC &middot; VERSION 1</div>' +
        '<h2 class="ospoc-heading"></h2>' +
        '<p class="ospoc-description">A custom UI loaded from a JavaScript file.</p>' +
        '<div class="ospoc-stats" role="list"></div>' +
        '<div class="ospoc-controls">' +
        '<label>Search tasks<input type="search" placeholder="Search by task or owner" aria-label="Search tasks"></label>' +
        '<label>Status<select aria-label="Filter by status">' +
        STATUSES.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
        '</select></label>' +
        '</div>' +
        '<ul class="ospoc-list" aria-label="Tasks"></ul>' +
        '<div class="ospoc-message" role="status" aria-live="polite"></div>' +
        '</section>';

      this.shadowRoot.querySelector('.ospoc-heading').textContent = heading;

      this.shadowRoot.addEventListener('input', this._onInput);
      this.shadowRoot.addEventListener('change', this._onChange);
      this.shadowRoot.addEventListener('click', this._onClick);
    }

    // ---- Stats/list/message rendering. Runs on every state change. Never
    // touches the input/select elements themselves. ----
    renderList() {
      var root = this.shadowRoot;

      var stats = root.querySelector('.ospoc-stats');
      stats.replaceChildren();
      [
        ['Total', this._tasks.length],
        ['Open', this._tasks.filter(function (t) { return t.status === 'Open'; }).length],
        ['Completed', this._tasks.filter(function (t) { return t.status === 'Completed'; }).length]
      ].forEach(function (pair) {
        var card = document.createElement('div');
        card.className = 'ospoc-stat';
        card.setAttribute('role', 'listitem');
        var value = document.createElement('strong');
        value.textContent = pair[1];
        card.append(value, document.createTextNode(pair[0]));
        stats.append(card);
      });

      var list = root.querySelector('.ospoc-list');
      list.replaceChildren();
      var query = this._query.toLowerCase();
      var visible = this._tasks.filter(function (t) {
        return (this._filter === 'All' || t.status === this._filter) &&
          (t.title + ' ' + t.owner).toLowerCase().indexOf(query) !== -1;
      }, this);

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
        button.setAttribute(
          'aria-label',
          (t.status === 'Completed' ? 'Completed: ' : 'Mark complete: ') + t.title
        );

        row.append(info, button);
        list.append(row);
      });

      if (!visible.length) {
        var empty = document.createElement('li');
        empty.className = 'ospoc-empty';
        empty.textContent = 'No matching tasks.';
        list.append(empty);
      }

      root.querySelector('.ospoc-message').textContent = this._message;
    }

    _onInput(e) {
      if (e.target.matches('input')) {
        this._query = e.target.value;
        this.renderList();
      }
    }

    _onChange(e) {
      if (e.target.matches('select')) {
        this._filter = e.target.value;
        this.renderList();
      }
    }

    _onClick(e) {
      var button = e.target.closest('button[data-id]');
      if (!button || button.disabled) return;
      var id = Number(button.dataset.id);
      var task = this._tasks.find(function (t) { return t.id === id; });
      if (!task) return;
      task.status = 'Completed';
      this._message = task.title + ' completed.';
      this.renderList();
      this._notifyComplete(task);
    }

    // Fires a bubbling, shadow-crossing CustomEvent so the OutSystems
    // screen can react without this component knowing anything about
    // OutSystems. Cancelable: a listener can call e.preventDefault() to
    // signal that the server-side action failed, which shows an inline
    // error message here (replacing the old options.onComplete().catch()).
    _notifyComplete(task) {
      var proceeded = this.dispatchEvent(new CustomEvent('task-completed', {
        detail: { id: task.id, title: task.title },
        bubbles: true,
        composed: true,
        cancelable: true
      }));
      if (!proceeded) {
        this._message = 'UI updated, but the OutSystems action failed.';
        this.renderList();
      }
    }

    static styles() {
      return (
        ':host {' +
        '  display: block;' +
        '  color-scheme: light;' +
        '  --page-plane: #f9f9f7;' +
        '  --surface-1: #fcfcfb;' +
        '  --text-primary: #0b0b0b;' +
        '  --text-secondary: #52514e;' +
        '  --text-muted: #898781;' +
        '  --border: rgba(11, 11, 11, 0.12);' +
        '  --accent: #2a78d6;' +
        '  --accent-contrast: #ffffff;' +
        '  --danger: #b3261e;' +
        '  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;' +
        '}' +
        '@media (prefers-color-scheme: dark) {' +
        '  :host {' +
        '    color-scheme: dark;' +
        '    --page-plane: #0d0d0d;' +
        '    --surface-1: #1a1a19;' +
        '    --text-primary: #ffffff;' +
        '    --text-secondary: #c3c2b7;' +
        '    --text-muted: #898781;' +
        '    --border: rgba(255, 255, 255, 0.12);' +
        '    --accent: #3987e5;' +
        '    --danger: #e5847d;' +
        '  }' +
        '}' +
        '* { box-sizing: border-box; }' +
        '.ospoc { background: var(--page-plane); color: var(--text-primary); padding: 24px; border-radius: 10px; max-width: 640px; }' +
        '.ospoc-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 8px; }' +
        '.ospoc-heading { margin: 0 0 4px; font-size: 20px; font-weight: 700; }' +
        '.ospoc-description { margin: 0 0 20px; font-size: 13px; color: var(--text-secondary); }' +
        '.ospoc-stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }' +
        '.ospoc-stat { flex: 1 1 100px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--text-secondary); }' +
        '.ospoc-stat strong { font-size: 20px; color: var(--text-primary); }' +
        '.ospoc-controls { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }' +
        '.ospoc-controls label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary); flex: 1 1 180px; }' +
        '.ospoc-controls input, .ospoc-controls select { font: inherit; font-size: 14px; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-1); color: var(--text-primary); }' +
        '.ospoc-controls input:focus-visible, .ospoc-controls select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }' +
        '.ospoc-list { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 8px; }' +
        '.ospoc-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }' +
        '.ospoc-list li.ospoc-empty { justify-content: center; color: var(--text-muted); font-size: 13px; }' +
        '.ospoc-list small { display: block; color: var(--text-muted); font-size: 12px; margin-top: 2px; }' +
        '.ospoc-list button { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-contrast); cursor: pointer; white-space: nowrap; }' +
        '.ospoc-list button:disabled { background: transparent; color: var(--text-muted); border-color: var(--border); cursor: default; }' +
        '.ospoc-list button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }' +
        '.ospoc-list button:not(:disabled):hover { filter: brightness(1.08); }' +
        '.ospoc-message { min-height: 18px; font-size: 12px; color: var(--text-secondary); }' +
        '.ospoc-message:not(:empty)::before { content: "\u2713 "; color: var(--accent); }'
      );
    }
  }

  if (!customElements.get('dashboard-widget')) {
    customElements.define('dashboard-widget', OpsTaskTracker);
  }
})();

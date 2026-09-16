/**
 * dashboard-widget.js
 *
 * Same shape as frontendtips-menu.js / simple-spa-menu.js: a single JS file
 * that registers one custom element, <dashboard-widget>, with its own
 * Shadow DOM. Load this file (e.g. via OutSystems Extra Scripts, or a CDN
 * URL pointed at this file in your GitHub repo), then drop
 * <dashboard-widget></dashboard-widget> into an HTML widget wherever the
 * dashboard should appear. No page wrapper, no id lookups on the host page.
 *
 * The tag name 'dashboard-widget' is part of the contract with whatever
 * OutSystems screen already has it typed into an HTML widget — keep this
 * name the same across future versions of this file, since the screen
 * that uses it isn't republished when this script changes.
 */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var WIDTH = 480;
  var HEIGHT = 260;
  var PAD_LEFT = 52;
  var PAD_TOP = 28;
  var PAD_BOTTOM = 32;

  // ---- Sample dataset, shared by both charts and the table ----
  var dashboardData = [
    { month: 'Jan', revenue: 12000, users: 320 },
    { month: 'Feb', revenue: 15000, users: 410 },
    { month: 'Mar', revenue: 13500, users: 380 },
    { month: 'Apr', revenue: 18200, users: 460 },
    { month: 'May', revenue: 20100, users: 510 },
    { month: 'Jun', revenue: 22400, users: 590 }
  ];

  function formatCurrency(v) { return '$' + v.toLocaleString('en-US'); }
  function formatNumber(v) { return v.toLocaleString('en-US'); }

  function niceScale(maxValue, tickCount) {
    tickCount = tickCount || 4;
    if (maxValue <= 0) return { niceMax: 1, ticks: [0, 1] };

    var rawStep = maxValue / tickCount;
    var magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    var normalized = rawStep / magnitude;

    var niceStep;
    if (normalized <= 1) niceStep = 1 * magnitude;
    else if (normalized <= 2) niceStep = 2 * magnitude;
    else if (normalized <= 5) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;

    var niceMax = Math.ceil(maxValue / niceStep) * niceStep;
    var ticks = [];
    for (var t = 0; t <= niceMax; t += niceStep) ticks.push(Math.round(t));

    return { niceMax: niceMax, ticks: ticks };
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    for (var key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) {
        e.setAttribute(key, attrs[key]);
      }
    }
    return e;
  }

  // Top corners rounded, bottom square — bars grow from a single baseline.
  function topRoundedRectPath(x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius, width / 2, height));
    var yBottom = y + height;
    return (
      'M' + x + ',' + (y + r) +
      ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      ' L' + (x + width - r) + ',' + y +
      ' Q' + (x + width) + ',' + y + ' ' + (x + width) + ',' + (y + r) +
      ' L' + (x + width) + ',' + yBottom +
      ' L' + x + ',' + yBottom +
      ' Z'
    );
  }

  function renderTooltip(tooltip, xPercent, yPercent, value, month, color) {
    tooltip.innerHTML = '';
    var valueEl = document.createElement('div');
    valueEl.className = 'tooltip-value';
    valueEl.textContent = value;
    var labelEl = document.createElement('div');
    labelEl.className = 'tooltip-label';
    var swatch = document.createElement('span');
    swatch.className = 'tooltip-swatch';
    swatch.style.backgroundColor = color;
    labelEl.appendChild(swatch);
    labelEl.appendChild(document.createTextNode(month));
    tooltip.appendChild(valueEl);
    tooltip.appendChild(labelEl);
    tooltip.style.left = xPercent + '%';
    tooltip.style.top = yPercent + '%';
    tooltip.hidden = false;
  }

  // ---- Each render* function only ever touches the container element
  // it's handed — no document.getElementById, no global ids — so they
  // work the same whether that container lives in the light DOM or, as
  // here, inside a component's Shadow DOM. ----

  function renderBarChart(container, opts) {
    var data = opts.data, valueKey = opts.valueKey, color = opts.color, formatValue = opts.formatValue;
    var PAD_RIGHT = 16;
    var plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    var plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    var values = data.map(function (d) { return d[valueKey]; });
    var maxValue = Math.max.apply(null, values);
    var scale = niceScale(maxValue, 4);
    var niceMax = scale.niceMax, ticks = scale.ticks;

    var slotWidth = plotW / data.length;
    var barWidth = Math.min(24, slotWidth * 0.5);
    var maxIndex = values.indexOf(maxValue);

    function yFor(value) { return PAD_TOP + plotH - (value / niceMax) * plotH; }

    container.innerHTML =
      '<h3 class="chart-title">' + opts.title + '</h3>' +
      '<div class="chart-wrap">' +
      '<svg viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" class="chart-svg" role="img" aria-label="' + opts.title + '"></svg>' +
      '<div class="chart-tooltip" hidden></div>' +
      '</div>';

    var svg = container.querySelector('svg');
    var tooltip = container.querySelector('.chart-tooltip');

    ticks.forEach(function (tick) {
      var y = yFor(tick);
      svg.appendChild(svgEl('line', { x1: PAD_LEFT, x2: WIDTH - PAD_RIGHT, y1: y, y2: y, class: 'gridline' }));
      var text = svgEl('text', { x: PAD_LEFT - 8, y: y, class: 'tick-label', 'text-anchor': 'end', 'dominant-baseline': 'middle' });
      text.textContent = tick.toLocaleString('en-US');
      svg.appendChild(text);
    });

    svg.appendChild(svgEl('line', {
      x1: PAD_LEFT, x2: WIDTH - PAD_RIGHT,
      y1: PAD_TOP + plotH, y2: PAD_TOP + plotH, class: 'baseline'
    }));

    data.forEach(function (d, i) {
      var value = d[valueKey];
      var barHeight = (value / niceMax) * plotH;
      var xCenter = PAD_LEFT + slotWidth * (i + 0.5);
      var x = xCenter - barWidth / 2;
      var y = PAD_TOP + plotH - barHeight;

      var path = svgEl('path', {
        d: topRoundedRectPath(x, y, barWidth, barHeight, 4),
        fill: color,
        opacity: '0.92',
        tabindex: '0',
        role: 'img',
        'aria-label': d.month + ': ' + formatValue(value),
        class: 'hit-target'
      });
      path.style.transition = 'filter 0.15s, opacity 0.15s';

      function show() {
        path.style.filter = 'brightness(1.1)';
        path.setAttribute('opacity', '1');
        renderTooltip(tooltip, (xCenter / WIDTH) * 100, (y / HEIGHT) * 100, formatValue(value), d.month, color);
      }
      function hide() {
        path.style.filter = 'none';
        path.setAttribute('opacity', '0.92');
        tooltip.hidden = true;
      }

      path.addEventListener('mouseenter', show);
      path.addEventListener('mouseleave', hide);
      path.addEventListener('focus', show);
      path.addEventListener('blur', hide);

      svg.appendChild(path);

      if (i === maxIndex) {
        var label = svgEl('text', { x: xCenter, y: y - 8, 'text-anchor': 'middle', class: 'data-label' });
        label.textContent = formatValue(value);
        svg.appendChild(label);
      }

      var monthLabel = svgEl('text', { x: xCenter, y: HEIGHT - 10, 'text-anchor': 'middle', class: 'axis-label' });
      monthLabel.textContent = d.month;
      svg.appendChild(monthLabel);
    });
  }

  function renderLineChart(container, opts) {
    var data = opts.data, valueKey = opts.valueKey, color = opts.color, formatValue = opts.formatValue;
    var PAD_RIGHT = 40;
    var plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    var plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    var values = data.map(function (d) { return d[valueKey]; });
    var maxValue = Math.max.apply(null, values);
    var scale = niceScale(maxValue, 4);
    var niceMax = scale.niceMax, ticks = scale.ticks;

    var slotWidth = plotW / data.length;
    function xFor(i) { return PAD_LEFT + slotWidth * (i + 0.5); }
    function yFor(value) { return PAD_TOP + plotH - (value / niceMax) * plotH; }

    var points = data.map(function (d, i) { return { x: xFor(i), y: yFor(d[valueKey]) }; });
    var linePath = points.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p.x + ',' + p.y; }).join(' ');
    var lastIndex = data.length - 1;

    container.innerHTML =
      '<h3 class="chart-title">' + opts.title + '</h3>' +
      '<div class="chart-wrap">' +
      '<svg viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" class="chart-svg" role="img" aria-label="' + opts.title + '"></svg>' +
      '<div class="chart-tooltip" hidden></div>' +
      '</div>';

    var svg = container.querySelector('svg');
    var tooltip = container.querySelector('.chart-tooltip');

    ticks.forEach(function (tick) {
      var y = yFor(tick);
      svg.appendChild(svgEl('line', { x1: PAD_LEFT, x2: WIDTH - PAD_RIGHT, y1: y, y2: y, class: 'gridline' }));
      var text = svgEl('text', { x: PAD_LEFT - 8, y: y, class: 'tick-label', 'text-anchor': 'end', 'dominant-baseline': 'middle' });
      text.textContent = tick.toLocaleString('en-US');
      svg.appendChild(text);
    });

    svg.appendChild(svgEl('line', {
      x1: PAD_LEFT, x2: WIDTH - PAD_RIGHT,
      y1: PAD_TOP + plotH, y2: PAD_TOP + plotH, class: 'baseline'
    }));

    data.forEach(function (d, i) {
      var monthLabel = svgEl('text', { x: xFor(i), y: HEIGHT - 10, 'text-anchor': 'middle', class: 'axis-label' });
      monthLabel.textContent = d.month;
      svg.appendChild(monthLabel);
    });

    svg.appendChild(svgEl('path', {
      d: linePath, fill: 'none', stroke: color, 'stroke-width': '2',
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));

    var crosshair = svgEl('line', {
      x1: 0, x2: 0, y1: PAD_TOP, y2: PAD_TOP + plotH, class: 'crosshair'
    });
    crosshair.style.display = 'none';
    svg.appendChild(crosshair);

    points.forEach(function (p, i) {
      var circle = svgEl('circle', {
        cx: p.x, cy: p.y, r: 4, fill: color,
        stroke: 'var(--surface-1)', 'stroke-width': '2',
        tabindex: '0', role: 'img',
        'aria-label': data[i].month + ': ' + formatValue(data[i][valueKey]),
        class: 'hit-target'
      });
      circle.addEventListener('focus', function () { setHover(i); });
      circle.addEventListener('blur', function () { clearHover(); });
      svg.appendChild(circle);
    });

    var endLabel = svgEl('text', {
      x: points[lastIndex].x + 8, y: points[lastIndex].y - 8,
      class: 'data-label', 'text-anchor': 'start'
    });
    endLabel.textContent = formatValue(data[lastIndex][valueKey]);
    svg.appendChild(endLabel);

    var overlay = svgEl('rect', {
      x: PAD_LEFT, y: PAD_TOP, width: plotW, height: plotH, fill: 'transparent'
    });
    svg.appendChild(overlay);

    function setHover(index) {
      var p = points[index];
      crosshair.setAttribute('x1', p.x);
      crosshair.setAttribute('x2', p.x);
      crosshair.style.display = 'block';
      renderTooltip(tooltip, (p.x / WIDTH) * 100, (p.y / HEIGHT) * 100, formatValue(data[index][valueKey]), data[index].month, color);
    }
    function clearHover() {
      crosshair.style.display = 'none';
      tooltip.hidden = true;
    }

    overlay.addEventListener('mousemove', function (e) {
      var rect = svg.getBoundingClientRect();
      var relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH;
      var nearest = 0, nearestDist = Infinity;
      points.forEach(function (p, i) {
        var dist = Math.abs(p.x - relativeX);
        if (dist < nearestDist) { nearestDist = dist; nearest = i; }
      });
      setHover(nearest);
    });
    overlay.addEventListener('mouseleave', clearHover);
  }

  function renderTable(container, data) {
    container.innerHTML = '<h3 class="chart-title">Chart data</h3>';

    var table = document.createElement('table');
    table.className = 'data-table';

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['Month', 'Revenue', 'Active users'].forEach(function (text, i) {
      var th = document.createElement('th');
      if (i > 0) th.className = 'numeric';
      th.textContent = text;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    data.forEach(function (row) {
      var tr = document.createElement('tr');

      var monthTd = document.createElement('td');
      monthTd.textContent = row.month;
      tr.appendChild(monthTd);

      var revenueTd = document.createElement('td');
      revenueTd.className = 'numeric';
      revenueTd.textContent = formatCurrency(row.revenue);
      tr.appendChild(revenueTd);

      var usersTd = document.createElement('td');
      usersTd.className = 'numeric';
      usersTd.textContent = formatNumber(row.users);
      tr.appendChild(usersTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);
  }

  // ---- The custom element itself: same shape as frontendtips-menu.js ----
  class DashboardWidget extends HTMLElement {
    constructor() {
      super();
      // Shadow DOM: this component's styles and internal ids can never
      // clash with the host page's — or with anything OutSystems (or any
      // other framework) generates around it.
      this.attachShadow({ mode: 'open' });
    }

    // Runs the moment <dashboard-widget> is inserted into the page.
    connectedCallback() {
      this.render();
    }

    render() {
      // No page-level title/header here — the host screen already has its
      // own heading. This just renders the two charts and the table below.
      this.shadowRoot.innerHTML =
        '<style>' + DashboardWidget.styles() + '</style>' +
        '<div class="dashboard">' +
        '<div class="charts-row">' +
        '<div class="chart-card" id="revenue-chart"></div>' +
        '<div class="chart-card" id="users-chart"></div>' +
        '</div>' +
        '<div class="chart-card" id="data-table"></div>' +
        '</div>';

      // Ids here are scoped to this shadow root, so they're safe even if
      // the host page has its own "revenue-chart" id, or if there are
      // multiple <dashboard-widget> instances on the same page.
      renderBarChart(this.shadowRoot.getElementById('revenue-chart'), {
        title: 'Monthly revenue',
        data: dashboardData,
        valueKey: 'revenue',
        color: 'var(--series-1)',
        formatValue: formatCurrency
      });

      renderLineChart(this.shadowRoot.getElementById('users-chart'), {
        title: 'Monthly active users',
        data: dashboardData,
        valueKey: 'users',
        color: 'var(--series-2)',
        formatValue: formatNumber
      });

      renderTable(this.shadowRoot.getElementById('data-table'), dashboardData);
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
        '  --gridline: #e1e0d9;' +
        '  --baseline: #c3c2b7;' +
        '  --border: rgba(11, 11, 11, 0.1);' +
        '  --series-1: #2a78d6;' +
        '  --series-2: #eb6834;' +
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
        '    --gridline: #2c2c2a;' +
        '    --baseline: #383835;' +
        '    --border: rgba(255, 255, 255, 0.1);' +
        '    --series-1: #3987e5;' +
        '    --series-2: #d95926;' +
        '  }' +
        '}' +
        '* { box-sizing: border-box; }' +
        '.dashboard { background: var(--page-plane); color: var(--text-primary); padding: 32px; }' +
        '.charts-row { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }' +
        '.chart-card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 20px; flex: 1 1 380px; }' +
        '.chart-title { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--text-primary); }' +
        '.chart-wrap { position: relative; }' +
        '.chart-svg { width: 100%; height: auto; overflow: visible; display: block; }' +
        '.gridline { stroke: var(--gridline); stroke-width: 1; }' +
        '.baseline { stroke: var(--baseline); stroke-width: 1; }' +
        '.crosshair { stroke: var(--baseline); stroke-width: 1; pointer-events: none; }' +
        '.tick-label { fill: var(--text-muted); font-size: 10px; }' +
        '.axis-label { fill: var(--text-muted); font-size: 11px; }' +
        '.data-label { fill: var(--text-primary); font-size: 11px; font-weight: 600; }' +
        '.chart-svg path.hit-target, .chart-svg circle.hit-target { cursor: pointer; outline: none; }' +
        '.chart-svg path.hit-target:focus-visible, .chart-svg circle.hit-target:focus-visible { stroke: var(--text-primary); stroke-width: 2; }' +
        '.chart-tooltip { position: absolute; transform: translate(-50%, -130%); background: var(--surface-1); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); pointer-events: none; white-space: nowrap; }' +
        '.chart-tooltip[hidden] { display: none; }' +
        '.tooltip-value { font-size: 13px; font-weight: 700; color: var(--text-primary); }' +
        '.tooltip-label { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); margin-top: 2px; }' +
        '.tooltip-swatch { width: 8px; height: 2px; border-radius: 1px; display: inline-block; }' +
        '.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }' +
        '.data-table th { text-align: left; color: var(--text-secondary); font-weight: 600; padding: 8px 12px; border-bottom: 1px solid var(--baseline); }' +
        '.data-table td { padding: 8px 12px; border-bottom: 1px solid var(--gridline); color: var(--text-primary); }' +
        '.data-table th.numeric, .data-table td.numeric { text-align: right; font-variant-numeric: tabular-nums; }' +
        '.data-table tbody tr:last-child td { border-bottom: none; }'
      );
    }
  }

  if (!customElements.get('dashboard-widget')) {
    customElements.define('dashboard-widget', DashboardWidget);
  }
})();

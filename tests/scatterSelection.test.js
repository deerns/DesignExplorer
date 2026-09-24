const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const d3 = require('../d3/d3.v3.min.js');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const matrix = fs.readFileSync(path.join(__dirname, '../scatter_matrix_source_files/scatter-matrix.js'), 'utf8');
const parcoords = fs.readFileSync(path.join(__dirname, '../pc_source_files/d3/d3.parcoords.js'), 'utf8');

function sourceFunction(source, name, indent = 6) {
  const spaces = ' '.repeat(indent);
  const match = source.match(new RegExp(`^${spaces}function ${name}\\([^]*?^${spaces}\\}`, 'm'));
  assert.ok(match, `Production function ${name} exists`);
  return match[0];
}

function sourceMethod(name) {
  const match = parcoords.match(new RegExp(`^    pc\\.${name.replaceAll('.', '\\.')} = function[^]*?^    \\};`, 'm'));
  assert.ok(match, `Production method ${name} exists`);
  return match[0];
}

function harness(rows) {
  const data = rows.map((row, scid) => ({ ...row, scid }));
  const dimensions = {};
  for (const name of Object.keys(rows[0] || {})) {
    dimensions[name] = { type: 'number', yscale: d3.scale.linear().domain([0, 100]).range([500, 0]) };
  }
  const state = { data, dimensions, brushed: false, highlighted: [] };
  const events = d3.dispatch('brush', 'brushstart', 'brushend');
  let imageRows, tableRows, parallelRows;
  const circles = data.map(row => ({ row, visibility: 'visible' }));
  const selection = {
    classed() { return this; },
    attr(name, value) {
      circles.forEach(circle => { circle[name] = typeof value === 'function' ? value(circle.row) : value; });
      return this;
    },
  };
  const graph = {
    data: () => data,
    dimensions: () => dimensions,
    brushed: () => state.brushed,
    highlighted: () => [],
    highlight: () => [],
    on(name, callback) { events.on(name, callback); return graph; },
    renderBrushed() { graph.renderBrushed.queue(); return graph; },
  };
  // Only SVG drawing is stubbed. Selection, brush events and queue visibility
  // use the actual parcoords implementation, including real D3 brush objects.
  const nodes = Object.fromEntries(Object.keys(dimensions).map(name => [name, { __data__: name }]));
  function svgSelection(items) {
    return {
      each(callback) { items.forEach(node => callback.call(node, node.__data__)); return this; },
      append() { return this; }, attr() { return this; }, style() { return this; },
      selectAll() { return this; }, remove() { return this; },
      transition() { return this; }, duration() { return this; }, call() { return this; },
      classed() { return this; }, on() { return this; },
    };
  }
  const chartD3 = {
    ...d3,
    selectAll: () => selection,
    select: node => svgSelection(typeof node === 'string' ? [] : [node]),
  };
  Object.defineProperty(chartD3, 'event', { get: () => d3.event });
  const context = vm.createContext({
    graph, cleanedData: data, window: {},
    d3: chartD3,
    __: state, pc: graph, events, selectionRowSet: null,
    brush: { mode: '1D-axes', predicate: 'AND', modes: {}, currentMode() { return this.modes[this.mode]; } },
    g: { append: () => svgSelection(Object.keys(dimensions).map(name => nodes[name])), selectAll: () => svgSelection(Object.keys(dimensions).map(name => nodes[name])) },
    brushedQueue(rows) { parallelRows = state.brushed === false ? data : rows; },
    activeScatterSelectionData: [], activeScatterSelectionMeta: null,
    scatterSelectionApplied: false, scatterSelectionPreviousGraphBrushExtents: null,
    isApplyingScatterSelectionBrush: false, scatterChart: { __data: data, clearSelection() {} },
    updateScatterSelectionActionButtons() {},
    updateImageGrid(rows) { imageRows = rows; }, drawTable(rows) { tableRows = rows; },
    drawScatterHighlightMarkers() {}, updatePinnedScatterDot() {}, updateSlidersTickValues() {},
    shouldShowScatterPlots: () => true, refreshScatterChartLayout() {},
    validDimensionKeys: (_, keys) => keys, getCurrentSliderNameList: () => Object.keys(dimensions),
    alert(message) { throw new Error(message); },
  });
  const names = ['cloneBrushExtents', 'ensureScatterDataIds', 'getCurrentGraphDisplayData',
    'getCurrentScatterBaseData', 'getActiveScatterSelectionData', 'hasUsableScatterSelection',
    'setScatterSelectionState', 'clearScatterSelectionState', 'buildScatterSelectionSliderBrushExtents',
    'intersectScatterBrushExtents', 'syncGraphSelectionViews', 'applyScatterSelectionToSliderSelection',
    'resetScatterSelectionAction', 'getCircleID', 'updateScatterChart', 'setupEvents'];
  const brushMode = parcoords.slice(parcoords.indexOf('// brush mode: 1D-Axes'), parcoords.indexOf('    pc.interactive ='));
  vm.runInContext(['filterSelectionRows', 'isBrushed', 'brushUpdated'].map(name => sourceFunction(parcoords, name, 4)).join('\n') + '\n' + sourceMethod('selectionRows') + '\n' + sourceMethod('renderBrushed.queue') + '\n' + brushMode, context);
  context.brush.currentMode().install();
  vm.runInContext(names.map(name => sourceFunction(html, name)).join('\n'), context);
  context.setupEvents();
  return {
    context, graph, data, dimensions,
    select(x, y, extent, drawnRows = data) {
      const brushContext = vm.createContext({
        brush: { extent: () => extent }, data,
        svg: { selectAll: () => selection },
        window: {
          getCurrentScatterBrushSourceData: context.getCurrentScatterBaseData,
          handleScatterMatrixSelection: context.setScatterSelectionState,
        },
      });
      const handler = sourceFunction(matrix, 'brush', 4).replace('function brush(', 'function (');
      vm.runInContext('(' + handler + ')', brushContext)({ x, y, __data_to_draw: drawnRows });
      return context.getActiveScatterSelectionData();
    },
    zoom() { context.applyScatterSelectionToSliderSelection(); },
    assertViews(expected) {
      const ids = rows => Array.from(rows, row => row.scid);
      assert.deepEqual(ids(context.getCurrentGraphDisplayData()), expected);
      assert.deepEqual(ids(imageRows), expected, 'image grid matches selection');
      assert.deepEqual(ids(tableRows), expected, 'table matches selection');
      if (parallelRows) assert.deepEqual(ids(parallelRows), expected, 'parallel coordinates match selection');
      assert.deepEqual(circles.filter(circle => circle.visibility === 'visible').map(circle => circle.row.scid), expected, 'only selected scatter points are visible');
    },
  };
}

test('successive zooms on different axes retain every earlier constraint', () => {
  const h = harness([
    { x: 2, y: 2, z: 2 },
    { x: 4, y: 4, z: 7 },
    { x: 6, y: 6, z: 6 },
    { x: 9, y: 2, z: 2 }, // Would return if the x filter is discarded.
    { x: 3, y: 9, z: 2 }, // Would return if the y filter is widened.
    { x: 2, y: 2, z: 9 },
  ]);
  h.select('x', 'y', [[0, 0], [7, 7]]);
  h.zoom();
  h.assertViews([0, 1, 2, 5]);
  h.select('y', 'z', [[0, 0], [10, 8]]);
  h.zoom();
  h.assertViews([0, 1, 2]);
  h.select('x', 'z', [[0, 0], [5, 5]]);
  h.zoom();
  h.assertViews([0]);
  assert.equal(h.context.scatterSelectionApplied, true);
  h.context.resetScatterSelectionAction();
  h.assertViews([0, 1, 2, 3, 4, 5]);
  assert.equal(h.context.scatterSelectionApplied, false);
});

test('a diagonal scatter selection intersects the horizontal and vertical ranges', () => {
  for (const extent of [[[2.5, 0], [7.5, 10]], [[0, 2.5], [10, 7.5]]]) {
    const h = harness([1, 3, 5, 7, 9].map(x => ({ x })));
    h.select('x', 'x', extent);
    h.zoom();
    h.assertViews([1, 2, 3]);
  }
});

test('selecting 12 of 90 rows stays at 12 when a scatter axis has no visible slider', () => {
  const h = harness(Array.from({ length: 90 }, (_, i) => ({ x: i % 6 + 1, output: i })));
  delete h.dimensions.output;
  assert.equal(h.select('x', 'output', [[0, 0], [7, 11.5]]).length, 12);
  h.zoom();
  h.assertViews(Array.from({ length: 12 }, (_, i) => i));
  assert.equal(h.select('x', 'output', [[0, 0], [100, 100]]).length, 12);
  h.select('x', 'output', [[0, 0], [7, 2.5]]);
  h.zoom();
  h.assertViews([0, 1, 2]);
  assert.equal(h.select('x', 'output', [[0, 0], [100, 100]]).length, 3);
  h.context.resetScatterSelectionAction();
  h.assertViews(Array.from({ length: 90 }, (_, i) => i));
});

test('hidden scatter axes retain exact rows across brush changes and axis reconstruction', () => {
  const h = harness(Array.from({ length: 90 }, (_, i) => ({ input: i % 6 + 1, a: i, b: i })));
  delete h.dimensions.a;
  delete h.dimensions.b;
  h.select('a', 'b', [[0, 0], [11.5, 11.5]]);
  h.zoom();
  const twelve = Array.from({ length: 12 }, (_, i) => i);
  h.assertViews(twelve);
  assert.deepEqual(Object.keys(h.graph.brushExtents()), [], 'no approximate filter on unrelated sliders');
  h.graph.brushExtents({ input: [1, 2] });
  h.assertViews([0, 1, 6, 7]);
  h.graph.brushExtents({ input: [0, 100] });
  h.assertViews(twelve);
  h.graph.brushReset();
  h.context.brush.currentMode().uninstall();
  h.context.brush.currentMode().install();
  h.graph.brushExtents({});
  h.context.syncGraphSelectionViews();
  h.assertViews(twelve);
  assert.equal(h.select('a', 'b', [[0, 0], [100, 100]]).length, 12);
});

test('zoom retains only selected rows from a filtered cell even with identical coordinates', () => {
  const h = harness(Array.from({ length: 90 }, () => ({ x: 5, y: 5 })));
  h.select('x', 'y', [[0, 0], [10, 10]], h.data.slice(0, 12));
  h.zoom();
  h.assertViews(Array.from({ length: 12 }, (_, i) => i));
  assert.equal(h.select('x', 'y', [[0, 0], [100, 100]]).length, 12);
});

test('an exact selection survives empty slider matches and an explicit empty row filter', () => {
  const h = harness([{ x: 1 }, { x: 5 }, { x: 9 }]);
  h.select('x', 'x', [[0, 0], [6, 6]]);
  h.zoom();
  h.graph.brushExtents({ x: [7, 10] });
  h.assertViews([]);
  h.graph.brushExtents({ x: [0, 10] });
  h.assertViews([0, 1]);
  h.graph.selectionRows([]);
  h.graph.brushReset();
  h.context.syncGraphSelectionViews();
  h.assertViews([]);
  h.context.resetScatterSelectionAction();
  h.assertViews([0, 1, 2]);
});

test('replacing the graph dataset or resetting clears the exact row restriction', () => {
  const context = vm.createContext({ d3: { ...d3 } });
  vm.runInContext(parcoords, context);
  const first = [{ x: 1 }, { x: 2 }];
  const graph = context.d3.parcoords({ data: first });
  graph.renderBrushed = () => graph;
  graph.selectionRows(first.slice(0, 1));
  assert.equal(graph.brushed().length, 1);
  const replacement = [{ x: 3 }];
  graph.data(replacement);
  assert.equal(graph.selectionRows(), null);
  assert.equal(graph.brushed(), false);
  graph.selectionRows(replacement);
  graph.reset();
  assert.equal(graph.selectionRows(), null);
});

test('zoom preserves a pre-existing slider filter on a different dimension', () => {
  const h = harness([{ x: 2, y: 2, z: 2 }, { x: 2, y: 2, z: 9 }, { x: 8, y: 8, z: 2 }]);
  h.graph.brushExtents({ z: [0, 5] });
  h.select('x', 'y', [[0, 0], [5, 5]]);
  h.zoom();
  h.assertViews([0]);
  assert.deepEqual(h.graph.brushExtents().z, [0, 5]);
});

test('a numeric constant with an ordinal slider scale uses pixel brush bounds', () => {
  const h = harness([{ x: 7, y: 1 }, { x: 7, y: 9 }]);
  const scale = d3.scale.ordinal().domain([7]).rangePoints([500, 0]);
  h.dimensions.x.yscale = scale;
  const extents = h.context.buildScatterSelectionSliderBrushExtents([h.data[0]], { x: 'x', y: 'y', extent: [[6, 0], [8, 5]] });
  assert.ok(extents.x[0] < scale(7) && extents.x[1] > scale(7));
});

test('no matches stay empty in the scatterplot, images and table until Reset', () => {
  const h = harness([{ x: 1 }, { x: 9 }]);
  h.graph.brushExtents({ x: [4, 6] });
  h.context.syncGraphSelectionViews();
  h.assertViews([]);
  h.context.resetScatterSelectionAction();
  h.assertViews([0, 1]);
});

test('an empty graph dataset does not fall back to the original dataset', () => {
  const h = harness([{ x: 1 }]);
  h.graph.data = () => [];
  h.context.syncGraphSelectionViews();
  h.assertViews([]);
});

test('scatter brushing only counts points in both the current filter and the drawn cell', () => {
  const rows = [{ scid: 0, x: 2 }, { scid: 1, x: 3 }, { scid: 2, x: 4 }];
  let selected;
  const context = vm.createContext({
    brush: { extent: () => [[0, 0], [5, 5]] },
    data: rows,
    svg: { selectAll: () => ({ classed() {} }) },
    window: { getCurrentScatterBrushSourceData: () => rows.slice(1), handleScatterMatrixSelection(rows) { selected = rows; } },
  });
  // The production handler uses the outer D3 brush, which replaces its
  // hoisted declaration. Keep that binding when evaluating it in isolation.
  const handler = sourceFunction(matrix, 'brush', 4).replace('function brush(', 'function (');
  const brush = vm.runInContext('(' + handler + ')', context);
  const cell = { x: 'x', y: 'x', __data_to_draw: rows.slice(0, 2) };
  brush(cell);
  assert.deepEqual(Array.from(selected, row => row.scid), [1]);
  context.window.getCurrentScatterBrushSourceData = () => [];
  brush(cell);
  assert.equal(selected.length, 0, 'empty filtered data never falls back to all drawn points');
});

test('recreating the scatter matrix with an empty selection keeps it empty', () => {
  let message;
  const node = {
    append() { return this; }, attr() { return this; }, style() { return this; },
    selectAll() { return this; }, remove() { return this; },
    html(value) { message = value; return this; },
  };
  const context = vm.createContext({
    d3: { select: () => node },
    graph: { data: () => [{ x: 1 }] }, cleanedData: [{ x: 1 }],
  });
  vm.runInContext(matrix, context);
  const chart = new context.ScatterMatrix('', [], '#radarChart');
  chart.render();
  assert.equal(chart.__data.length, 0);
  assert.match(message, /No scatter data available/);
});

test('all inline application scripts and scatter matrix parse successfully', () => {
  let count = 0;
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!match[1].trim()) continue;
    new vm.Script(match[1]);
    count++;
  }
  assert.ok(count > 0);
  new vm.Script(matrix);
  new vm.Script(parcoords);
});

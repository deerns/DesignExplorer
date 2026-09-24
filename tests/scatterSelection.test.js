const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const d3 = require('../d3/d3.v3.min.js');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const matrix = fs.readFileSync(path.join(__dirname, '../scatter_matrix_source_files/scatter-matrix.js'), 'utf8');

function sourceFunction(source, name, indent = 6) {
  const spaces = ' '.repeat(indent);
  const match = source.match(new RegExp(`^${spaces}function ${name}\\([^]*?^${spaces}\\}`, 'm'));
  assert.ok(match, `Production function ${name} exists`);
  return match[0];
}

function harness(rows) {
  const data = rows.map((row, scid) => ({ ...row, scid }));
  const dimensions = {};
  const brushes = {};
  for (const name of Object.keys(rows[0] || {})) {
    dimensions[name] = { type: 'number', yscale: d3.scale.linear().domain([0, 100]).range([500, 0]) };
    brushes[name] = d3.svg.brush().y(dimensions[name].yscale);
  }
  let brushed = false;
  let imageRows, tableRows;
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
    brushed: () => brushed,
    highlighted: () => [],
    brushReset() {
      Object.values(brushes).forEach(brush => brush.clear());
      brushed = false;
      return graph;
    },
    brushExtents(extents) {
      if (extents === undefined) {
        return Object.fromEntries(Object.entries(brushes).filter(([, brush]) => !brush.empty()).map(([name, brush]) => [name, brush.extent()]));
      }
      for (const [name, extent] of Object.entries(extents)) brushes[name].extent(extent);
      brushed = data.filter(row => Object.entries(brushes).every(([name, brush]) => {
        if (brush.empty()) return true;
        const bounds = brush.extent();
        const scale = dimensions[name].yscale;
        const value = typeof scale.rangePoints === 'function' ? scale(row[name]) : row[name];
        return bounds[0] <= value && value <= bounds[1];
      }));
      return graph;
    },
  };
  const context = vm.createContext({
    graph, cleanedData: data, window: {},
    d3: { ...d3, selectAll: () => selection },
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
    'resetScatterSelectionAction', 'getCircleID', 'updateScatterChart'];
  vm.runInContext(names.map(name => sourceFunction(html, name)).join('\n'), context);
  return {
    context, graph, data, dimensions,
    select(x, y, extent) {
      const selected = context.getCurrentGraphDisplayData().filter(row =>
        extent[0][0] <= row[x] && row[x] <= extent[1][0] &&
        extent[0][1] <= row[y] && row[y] <= extent[1][1]);
      context.setScatterSelectionState(selected, { x, y, extent });
      return selected;
    },
    zoom() { context.applyScatterSelectionToSliderSelection(); },
    assertViews(expected) {
      const ids = rows => Array.from(rows, row => row.scid);
      assert.deepEqual(ids(context.getCurrentGraphDisplayData()), expected);
      assert.deepEqual(ids(imageRows), expected, 'image grid matches selection');
      assert.deepEqual(ids(tableRows), expected, 'table matches selection');
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
});

// http://bl.ocks.org/3687826
d3.divgrid = function(config) {
  var columns = [];
  var headerFormatter = function (d) {
    return d;
  };
  var cellFormatter = function (value) {
    return value;
  };

  var dg = function(selection) {
    if (columns.length == 0) columns = d3.keys(selection.data()[0][0]);

    // header
    selection.selectAll(".header")
        .data([true])
      .enter().append("div")
        .attr("class", "header")
        .attr("role", "row")

    var header = selection.select(".header")
      .selectAll(".cell")
      .data(columns);

    header.enter().append("div")
      .attr("class", function(d,i) { return "col-" + i; })
      .attr("role", "columnheader")
      .classed("cell", true)

    selection.selectAll(".header .cell")
      .text(function(d) { return headerFormatter(d); });

    header.exit().remove();

    // rows
    var rows = selection.selectAll(".row")
        .data(function(d) { return d; })

    rows.enter().append("div")
        .attr("class", "row")
        .attr("role", "row")

    rows.exit().remove();

    var cells = selection.selectAll(".row").selectAll(".cell")
        .data(function(row) {
          return columns.map(function(column) {
            return cellFormatter(row[column], column);
          });
        })

    // cells
    cells.enter().append("div")
      .attr("class", function(d,i) { return "col-" + i; })
      .attr("role", "cell")
      .classed("cell", true)

    cells.exit().remove();

    selection.selectAll(".row .cell")
      .text(function(d) { return d; });

    return dg;
  };

  dg.columns = function(_) {
    if (!arguments.length) return columns;
    columns = _;
    return this;
  };

  dg.headerFormatter = function(_) {
    if (!arguments.length) return headerFormatter;
    headerFormatter = _;
    return this;
  };

  dg.cellFormatter = function(formatter) {
    cellFormatter = formatter;
    return this;
  };

  return dg;
};

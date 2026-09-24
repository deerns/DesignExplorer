# DesignExplorer

Design Explore is a web application to make exploring multi-dimensional design space enjoying and meaningful!

## Design Explorer is built on top of these plugins and web technologies:
### [Bootstrap template with side bar](http://getbootstrap.com/)
### [D3 Parallel coordinates](https://syntagmatic.github.io/parallel-coordinates/)
### [D3js](http://d3js.org/)
### [Ion.Range Slider](http://ionden.com/a/plugins/ion.rangeSlider/en.html)
### [jQuery Star Rating Plugin](http://www.fyneworks.com/jquery/star-rating/)
### [Pace](http://github.hubspot.com/pace/docs/welcome/)
### [Radar Chart](https://github.com/alangrafu/radar-chart-d3)
### [Spectacles](https://github.com/tt-acm/Spectacles.WebViewer) - 3D viewer
### [Scatter-matrix Chart](https://github.com/benjiec/scatter-matrix)

## Image loading

Study thumbnails load near the visible area. Thumbnails and 2D viewers share a
queue with at most twenty-four downloads overall and sixteen per server, with no
artificial delay between starts. Viewers have priority; within each priority,
new images start before retries. Duplicate URLs share downloads and cached results.
When scrolling fills the queue, visible images take over slots from downloads
that are no longer on screen. Interrupted images resume when visible again;
scrolling does not count as a failed attempt or consume their retry budget.

Failed images retry independently after about three seconds, with increasing
delays and at most five retries. Other images continue loading during that wait.
Supabase Storage URLs use fetch so HTTP 429 responses, or HTTP 503 responses with
`Retry-After`, can pause the server's queue when necessary. Retries respect
`Retry-After` when exposed to the browser. HTTP 4xx errors other than 408/429 stop
immediately. Click a failed image to try again. URLs and signed query parameters
are preserved. Other image hosts (or a proxy blocking CORS) use native image
loading with independent, bounded retries; HTTP status and response headers are
unavailable on that route. Switching studies cancels outstanding work.

The loader is in `js/studyImageLoader.js`. Run its regression tests with Node.js:

```sh
node --test tests/studyImageLoader.test.js
```

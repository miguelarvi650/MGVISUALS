/* Collage de fotos de fondo de la portada: cada foto aparece UNA sola vez
   y las filas se ajustan solas al tamaño de la pantalla. */
(function () {
  var el = document.getElementById("mosaico");
  if (!el) return;
  var P = [["m03", .667], ["m01", 1.5], ["m09", .667], ["m11", .667], ["m04", 1.5], ["m02", .669], ["m13", .667], ["m06", 1.498], ["m05", .667],
    ["m15", .667], ["m16", 1.5], ["m07", .667], ["m10", .667], ["m12", .667], ["m08", .667], ["m14", .665], ["m17", .667]];
  var tot = P.reduce(function (s, p) { return s + p[1]; }, 0), GAP = 3;
  var imgs = P.map(function (p) {
    var i = new Image();
    i.src = "/img/" + p[0] + ".jpg"; i.alt = ""; i.decoding = "async";
    i.style.flexGrow = p[1];
    return i;
  });
  var last = "";
  function layout() {
    var box = el.parentNode, V = box.clientWidth, H = box.clientHeight;
    if (!V || !H) return;
    // nº de filas con el que las fotos se deforman lo mínimo (escala más cercana a 1)
    var best = 1, bestErr = 1e9;
    for (var R = 1; R <= 8; R++) {
      var h = (H - GAP * (R - 1)) / R, sc = (R * V) / (tot * h), err = Math.abs(Math.log(sc));
      if (err < bestErr) { bestErr = err; best = R; }
    }
    // reparto equilibrado de las fotos en filas consecutivas
    var rows = [[]], acc = 0, k = 1;
    P.forEach(function (p, n) {
      if (acc + p[1] / 2 > k * tot / best && rows.length < best) { rows.push([]); k++; }
      rows[rows.length - 1].push(n); acc += p[1];
    });
    var sig = best + ":" + rows.map(function (r) { return r.length; }).join(",");
    if (sig === last) return;
    last = sig;
    el.textContent = "";
    rows.forEach(function (r) {
      var d = document.createElement("div");
      d.className = "mr";
      r.forEach(function (n) { d.appendChild(imgs[n]); });
      el.appendChild(d);
    });
  }
  layout();
  if (window.ResizeObserver) new ResizeObserver(layout).observe(el.parentNode);
  else window.addEventListener("resize", layout);
})();

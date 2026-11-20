/* Collage de fotos de fondo de la portada */
(function () {
  var el = document.getElementById("mosaico");
  if (!el) return;
  var P = [["m03", .667], ["m01", 1.5], ["m09", .667], ["m11", .667], ["m04", 1.5], ["m02", .669], ["m13", .667], ["m06", 1.498], ["m05", .667],
    ["m15", .667], ["m16", 1.5], ["m07", .667], ["m10", .667], ["m12", .667], ["m08", .667], ["m14", .665], ["m17", .667]];
  [0, 6, 11].forEach(function (k) {
    P.slice(k).concat(P.slice(0, k)).forEach(function (p) {
      var i = new Image();
      i.src = "/img/" + p[0] + ".jpg"; i.alt = ""; i.decoding = "async";
      i.style.flex = Math.round(p[1] * 100) + " 1 " + Math.round(p[1] * 170) + "px";
      el.appendChild(i);
    });
  });
})();

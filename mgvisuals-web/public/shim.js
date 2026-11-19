/* Conecta la interfaz con el servidor (/api). Mantiene el mismo contrato que usa la página. */
(function () {
  var API = "/api", admin = false, cache = {}, subs = [];
  function J(url, opt) {
    opt = opt || {};
    opt.credentials = "same-origin";
    if (opt.body && !opt.headers) opt.headers = { "Content-Type": "application/json" };
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || "Error " + r.status); e.status = r.status; throw e; }
        return d;
      });
    });
  }
  function rid() { return Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(8)), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function load() {
    return J(API + "/public").then(function (d) {
      cache.campeonatos = d.campeonatos || []; cache.fotos = d.fotos || [];
      cache.ajustes = [Object.assign({}, d.ajustes || {}, { id: "web" })];
    }).catch(function () {}).then(function () {
      return admin ? J(API + "/admin").then(function (d) { cache.reservas = d.reservas || []; }).catch(function () {}) : null;
    }).then(function () { subs.forEach(function (f) { f(); }); });
  }
  window.mgvReload = load;
  var MAP = {
    "campeonatos:set": ["camp:set"], "campeonatos:delete": ["camp:delete"],
    "fotos:set": ["foto:set"], "fotos:delete": ["foto:delete"],
    "ajustes:set": ["ajustes:set"],
    "reservas:update": ["reserva:update"], "reservas:delete": ["reserva:delete"]
  };
  function write(name, op, id, data) {
    var m = MAP[name + ":" + op];
    if (!m) return Promise.reject(new Error("Operación no permitida"));
    return J(API + "/admin", { method: "POST", body: JSON.stringify({ action: m[0], id: id, data: data }) })
      .then(function (r) { return load().then(function () { return r; }); });
  }
  function collection(name) {
    var ord = null;
    return {
      orderBy: function (f, d) { ord = [f, d || "asc"]; return this; },
      onSnapshot: function (cb) {
        function fire() {
          var arr = (cache[name] || []).slice();
          if (ord) arr.sort(function (a, b) { var x = a[ord[0]] || 0, y = b[ord[0]] || 0; return ord[1] === "desc" ? y - x : x - y; });
          cb({ docs: arr.map(function (o) { var c = Object.assign({}, o); delete c.id; return { id: o.id, exists: true, data: function () { return c; } }; }) });
        }
        subs.push(fire); fire();
        return function () { subs = subs.filter(function (f) { return f !== fire; }); };
      },
      doc: function (id) {
        id = id || rid();
        return {
          id: id,
          set: function (d) { return write(name, "set", id, d); },
          update: function (d) { return write(name, "update", id, d); },
          delete: function () { return write(name, "delete", id); }
        };
      }
    };
  }
  function shrink(file) {
    if (!/^image\//.test(file.type)) return Promise.reject(new Error("Solo imágenes"));
    if (file.type === "image/jpeg" && file.size < 3.5e6) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bm) {
      var sc = Math.min(1, 3200 / Math.max(bm.width, bm.height)), c = document.createElement("canvas");
      c.width = Math.round(bm.width * sc); c.height = Math.round(bm.height * sc);
      c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
      var qs = [0.9, 0.8, 0.7, 0.6], i = 0;
      function next() {
        if (i >= qs.length) return Promise.reject(new Error("La foto es demasiado grande"));
        return new Promise(function (r) { c.toBlob(r, "image/jpeg", qs[i++]); }).then(function (b) { return b && b.size < 4.2e6 ? b : next(); });
      }
      return next();
    });
  }
  var assets = {
    upload: function (file) {
      return shrink(file).then(function (b) {
        return fetch(API + "/foto?name=" + encodeURIComponent(file.name), { method: "PUT", credentials: "same-origin", headers: { "Content-Type": b.type || "image/jpeg" }, body: b });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Error al subir"); return { id: d.id, url: d.url }; });
      });
    },
    "delete": function (id) { return J(API + "/admin", { method: "POST", body: JSON.stringify({ action: "blob:delete", url: id }) }); }
  };
  var downloads = {
    save: function (o) {
      var b = o.data instanceof Blob ? o.data : new Blob([o.data]), a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = o.filename; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return Promise.resolve();
    }
  };
  var ready = J(API + "/login").then(function (s) { admin = !!s.admin; }).catch(function () {}).then(load);
  setInterval(load, 15000);
  window.claude = {
    use: function (name) {
      return ready.then(function () {
        var all = {
          user: { canEdit: function () { return Promise.resolve(admin); }, isOwner: function () { return Promise.resolve(admin); } },
          db: { collection: collection },
          assets: admin ? assets : null,
          downloads: downloads
        };
        return all[name] || null;
      });
    }
  };
})();

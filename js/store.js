/* ============================================================
   STORE — загрузка, черновик, публикация контента
   ============================================================ */
(function () {
  'use strict';

  var LS_DRAFT = 'pronin_draft_v1';
  var LS_TOKEN = 'pronin_gh_token';

  var Store = {
    data: null,        // текущий контент (черновик или с сервера)
    server: null,      // как лежит на сервере
    dirty: false,      // есть несохранённые правки
    tg: window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null,

    /* ---------- загрузка ---------- */
    load: function () {
      var url = CONFIG.CONTENT_URL + '?v=' + Date.now();
      return fetch(url, { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (json) {
          Store.server = json;
          var draft = Store.readDraft();
          if (draft && draft.version >= (json.version || 0)) {
            Store.data = draft;
            Store.dirty = true;
          } else {
            Store.data = JSON.parse(JSON.stringify(json));
            Store.dirty = false;
          }
          return Store.data;
        });
    },

    readDraft: function () {
      try {
        var s = localStorage.getItem(LS_DRAFT);
        return s ? JSON.parse(s) : null;
      } catch (e) { return null; }
    },

    /* ---------- сохранение черновика ---------- */
    save: function () {
      Store.data.updatedAt = new Date().toISOString();
      Store.dirty = true;
      try {
        localStorage.setItem(LS_DRAFT, JSON.stringify(Store.data));
      } catch (e) {
        console.warn('Не удалось сохранить черновик', e);
      }
    },

    dropDraft: function () {
      try { localStorage.removeItem(LS_DRAFT); } catch (e) {}
      Store.data = JSON.parse(JSON.stringify(Store.server));
      Store.dirty = false;
    },

    /* ---------- экспорт ---------- */
    toJSON: function () {
      var copy = JSON.parse(JSON.stringify(Store.data));
      copy.version = (copy.version || 0) + 1;
      return JSON.stringify(copy, null, 2);
    },

    download: function () {
      var blob = new Blob([Store.toJSON()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'content.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    },

    /* ---------- токен GitHub ---------- */
    getToken: function () {
      return new Promise(function (resolve) {
        var cs = Store.tg && Store.tg.CloudStorage;
        if (cs && cs.getItem) {
          cs.getItem(LS_TOKEN, function (err, val) {
            if (!err && val) return resolve(val);
            resolve(localStorage.getItem(LS_TOKEN) || '');
          });
        } else {
          resolve(localStorage.getItem(LS_TOKEN) || '');
        }
      });
    },

    setToken: function (t) {
      try { localStorage.setItem(LS_TOKEN, t); } catch (e) {}
      var cs = Store.tg && Store.tg.CloudStorage;
      if (cs && cs.setItem) { try { cs.setItem(LS_TOKEN, t, function () {}); } catch (e) {} }
    },

    clearToken: function () {
      try { localStorage.removeItem(LS_TOKEN); } catch (e) {}
      var cs = Store.tg && Store.tg.CloudStorage;
      if (cs && cs.removeItem) { try { cs.removeItem(LS_TOKEN, function () {}); } catch (e) {} }
    },

    ghReady: function () {
      var g = CONFIG.GITHUB;
      return !!(g && g.owner && g.repo);
    },

    /* ---------- публикация на GitHub ---------- */
    publish: function () {
      var g = CONFIG.GITHUB;
      if (!Store.ghReady()) {
        return Promise.reject(new Error('В js/config.js не заполнены owner и repo'));
      }
      var api = 'https://api.github.com/repos/' + g.owner + '/' + g.repo + '/contents/' + g.path;

      return Store.getToken().then(function (token) {
        if (!token) throw new Error('Нет токена GitHub');
        var head = {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        };

        // 1) узнаём текущий sha файла
        return fetch(api + '?ref=' + encodeURIComponent(g.branch) + '&t=' + Date.now(),
                     { headers: head, cache: 'no-store' })
          .then(function (r) {
            if (r.status === 401) throw new Error('Токен не подошёл. Проверь, что он не истёк.');
            if (r.status === 404) return null;              // файла ещё нет — создадим
            if (!r.ok) throw new Error('GitHub ответил ' + r.status);
            return r.json();
          })
          .then(function (info) {
            var body = {
              message: 'Обновление курса из приложения — ' + new Date().toLocaleString('ru-RU'),
              content: Store.b64(Store.toJSON()),
              branch: g.branch
            };
            if (info && info.sha) body.sha = info.sha;

            return fetch(api, { method: 'PUT', headers: head, body: JSON.stringify(body) });
          })
          .then(function (r) {
            return r.json().then(function (j) {
              if (!r.ok) {
                throw new Error(j.message || ('GitHub ответил ' + r.status));
              }
              // публикация удалась — черновик становится основой
              Store.data.version = (Store.data.version || 0) + 1;
              Store.server = JSON.parse(JSON.stringify(Store.data));
              Store.dirty = false;
              try { localStorage.removeItem(LS_DRAFT); } catch (e) {}
              return j;
            });
          });
      });
    },

    /* base64 с поддержкой кириллицы */
    b64: function (str) {
      var bytes = new TextEncoder().encode(str);
      var bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    },

    /* ---------- утилиты ---------- */
    uid: function (p) {
      return (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
  };

  window.Store = Store;
})();

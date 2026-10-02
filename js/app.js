/* ============================================================
   APP — вкладки, отрисовка курса, видео и материалов
   ============================================================ */
(function () {
  'use strict';

  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  var App = { tab: 'course', admin: false };
  window.App = App;

  /* ---------- мелкие помощники ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  App.esc = esc;

  function haptic(kind) {
    try {
      if (!tg || !tg.HapticFeedback) return;
      if (kind === 'ok') tg.HapticFeedback.notificationOccurred('success');
      else if (kind === 'err') tg.HapticFeedback.notificationOccurred('error');
      else tg.HapticFeedback.impactOccurred('light');
    } catch (e) {}
  }
  App.haptic = haptic;

  var toastTimer;
  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
    haptic(kind === 'err' ? 'err' : 'ok');
  }
  App.toast = toast;

  function openLink(url) {
    if (!url) return;
    if (tg && tg.openLink) tg.openLink(url, { try_instant_view: false });
    else window.open(url, '_blank', 'noopener');
  }
  App.openLink = openLink;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); res(); } catch (e) { rej(e); }
      document.body.removeChild(ta);
    });
  }
  App.copyText = copyText;

  /* YouTube: вытащить id из любой ссылки */
  function ytId(url) {
    if (!url) return '';
    var m = String(url).match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
    );
    return m ? m[1] : (/^[\w-]{11}$/.test(url.trim()) ? url.trim() : '');
  }
  App.ytId = ytId;

  /* таймкод «1:02:03» / «12:40» → секунды */
  function tcSec(t) {
    return String(t || '').split(':').reduce(function (acc, p) { return acc * 60 + (+p || 0); }, 0);
  }

  /* таймкоды текстом — как для описания на YouTube */
  function codesText(list) {
    return (list || []).map(function (c) { return c.t + ' ' + c.title; }).join('\n');
  }
  App.codesText = codesText;

  function player(id, start) {
    return '<div class="vthumb"><iframe src="https://www.youtube-nocookie.com/embed/' +
      esc(id) + '?autoplay=1&rel=0&playsinline=1' + (start ? '&start=' + start : '') +
      '" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" ' +
      'allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (e) { return String(url || '').replace(/^https?:\/\//, '').split('/')[0]; }
  }

  /* ================= ВКЛАДКИ ================= */
  function switchTab(name) {
    App.tab = name;
    $$('.tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === name); });
    $$('.page').forEach(function (p) { p.classList.toggle('is-active', p.id === 'page-' + name); });
    window.scrollTo({ top: 0, behavior: 'instant' in document.body.style ? 'instant' : 'auto' });
    haptic();
  }
  App.switchTab = switchTab;

  /* ================= РЕНДЕР: КУРС ================= */
  function renderCourse() {
    var d = Store.data, m = d.meta || {}, root = $('#courseRoot');
    var h = '';

    /* герой с золотым градиентом */
    h += '<div class="hero"><div class="hero-plate">';
    if (m.badge) h += '<div class="hero-kicker">' + esc(m.badge) + '</div>';
    h += '<div class="hero-word">Курс</div>';
    if (m.title) h += '<div class="hero-name">' + esc(m.title) + '</div>';
    h += '</div>';
    if (m.subtitle) h += '<p class="hero-sub">' + esc(m.subtitle) + '</p>';

    if (m.pills && m.pills.length) {
      h += '<div class="meta-row">';
      m.pills.forEach(function (p) {
        h += '<span class="meta-pill">' + esc(p.label) + ': <b>' + esc(p.value) + '</b></span>';
      });
      h += '</div>';
    }
    h += '</div>';

    /* карточка стоимости */
    var c = m.cost;
    if (c && (c.total || (c.items && c.items.length))) {
      h += '<div class="cost"><div class="cost-head">' +
           '<h3>' + esc(c.title || '') + '</h3>' +
           '<span class="cost-total">' + esc(c.total || '') + '</span></div>';
      if (c.items && c.items.length) {
        h += '<div class="cost-grid">';
        c.items.forEach(function (it) {
          h += '<div class="cost-item"><div class="amt">' + esc(it.amount) + '</div>' +
               '<div class="name">' + esc(it.name) + '</div></div>';
        });
        h += '</div>';
      }
      if (c.note) h += '<p class="cost-note">' + esc(c.note) + '</p>';
      h += '</div>';
    }

    /* карта курса */
    var mods = d.modules || [];
    if (mods.length) {
      h += '<div class="map"><div class="map-title">Карта курса</div>';
      mods.forEach(function (mod) {
        var n = (mod.lessons || []).length;
        h += '<button class="map-mod" type="button" data-goto="' + esc(mod.id) + '">' +
             '<div class="map-mod-row"><span class="map-num">' + esc(mod.num || '') + '</span><div>' +
             '<div class="map-mod-title">' + esc(mod.name || mod.title) + '</div>' +
             '<div class="map-mod-lessons">' + n + ' ' + plural(n, 'урок', 'урока', 'уроков') + '</div>' +
             '</div></div></button>';
      });
      h += '</div>';
    }

    /* модули и уроки */
    mods.forEach(function (mod, mi) {
      h += '<section class="module" id="mod-' + esc(mod.id) + '">';
      h += '<div class="module-eyebrow"><span class="num">' + esc(mod.num || '') + '</span>' +
           '<span>Модуль ' + (mi + 1) + ' · ' + esc(mod.name || '') + '</span></div>';
      h += '<h2 class="module-title">' + esc(mod.title || '') + '</h2>';
      if (mod.sub) h += '<p class="module-sub">' + esc(mod.sub) + '</p>';

      if (App.admin) {
        h += '<div class="edit-row" style="padding:10px 0 0">' +
             '<button class="mini gold" data-act="edit-module" data-id="' + esc(mod.id) + '">✎ Модуль</button>' +
             '<button class="mini" data-act="add-lesson" data-id="' + esc(mod.id) + '">＋ Урок</button>' +
             '</div>';
      }

      (mod.lessons || []).forEach(function (les) {
        h += '<article class="lesson" data-lesson="' + esc(les.id) + '">' +
             '<button class="lesson-btn" type="button" data-toggle="' + esc(les.id) + '">' +
             '<div class="lesson-head">' +
             (les.tag ? '<div class="lesson-tag"><span class="dot"></span>' + esc(les.tag) + '</div>' : '') +
             '<div class="lesson-name">' + esc(les.title || '') + '</div>' +
             '</div><span class="chev">▼</span></button>' +
             '<div class="lesson-body">' + (les.html || '') +
             (App.admin
               ? '<div class="edit-row" style="padding:14px 0 0">' +
                 '<button class="mini gold" data-act="edit-lesson" data-id="' + esc(les.id) + '">✎ Изменить</button>' +
                 '<button class="mini" data-act="move-lesson-up" data-id="' + esc(les.id) + '">↑</button>' +
                 '<button class="mini" data-act="move-lesson-down" data-id="' + esc(les.id) + '">↓</button>' +
                 '<button class="mini warn" data-act="del-lesson" data-id="' + esc(les.id) + '">Удалить</button>' +
                 '</div>'
               : '') +
             '</div></article>';
      });
      h += '</section>';
    });

    if (App.admin) {
      h += '<div style="margin:26px 0 0"><button class="add-card" data-act="add-module">＋ Добавить модуль</button></div>';
    }

    if (!mods.length && !App.admin) {
      h += '<div class="empty"><div class="e-ic">📚</div><p>Курс пока пуст.</p></div>';
    }

    root.innerHTML = h;
    wireBubbles(root);
  }

  function plural(n, a, b, c) {
    var x = Math.abs(n) % 100, y = x % 10;
    if (x > 10 && x < 20) return c;
    if (y > 1 && y < 5) return b;
    if (y === 1) return a;
    return c;
  }

  /* кнопки «Копировать» внутри промптов */
  function wireBubbles(root) {
    $$('.bubble .copy', root).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var code = btn.closest('.bubble').querySelector('code');
        if (!code) return;
        copyText(code.innerText).then(function () {
          var old = btn.textContent;
          btn.textContent = 'Скопировано';
          btn.classList.add('copied');
          haptic('ok');
          setTimeout(function () { btn.textContent = old; btn.classList.remove('copied'); }, 1600);
        });
      });
    });
  }

  /* ================= РЕНДЕР: ВИДЕО ================= */
  function renderVideo() {
    var list = Store.data.videos || [], root = $('#videoRoot'), h = '';

    if (!list.length) {
      h += '<div class="empty"><div class="e-ic">🎬</div><p>' +
           (App.admin ? 'Пока пусто. Добавь первое видео ниже.' : 'Видео скоро появятся.') +
           '</p></div>';
    }

    list.forEach(function (v) {
      var id = ytId(v.url);
      var mod = (Store.data.modules || []).filter(function (m) { return m.id === v.module; })[0];
      h += '<div class="vcard" data-video="' + esc(v.id) + '" data-yt="' + esc(id) + '">';
      if (id) {
        h += '<button class="vthumb" type="button" data-play="' + esc(id) + '">' +
             '<img loading="lazy" src="https://i.ytimg.com/vi/' + esc(id) + '/hqdefault.jpg" alt="">' +
             '<span class="vplay"><span>▶</span></span>' +
             (v.duration ? '<span class="vdur">' + esc(v.duration) + '</span>' : '') +
             '</button>';
      } else {
        h += '<button class="vthumb" type="button" data-open="' + esc(v.url || '') + '">' +
             '<span class="vplay"><span>▶</span></span></button>';
      }
      h += '<div class="vmeta">';
      if (mod) h += '<div class="vmod">Модуль ' + esc(mod.num || '') + ' · ' + esc(mod.name || '') + '</div>';
      h += '<div class="vtitle">' + esc(v.title || 'Без названия') + '</div>';
      if (v.desc) h += '<p class="vdesc">' + esc(v.desc) + '</p>';
      if (v.timecodes && v.timecodes.length) {
        h += '<details class="vcodes"><summary>Таймкоды · ' + v.timecodes.length + '</summary><ol>';
        v.timecodes.forEach(function (c) {
          h += '<li><button type="button" data-seek="' + tcSec(c.t) + '">' +
               '<span class="vc-t">' + esc(c.t) + '</span><span class="vc-n">' + esc(c.title) + '</span></button></li>';
        });
        h += '</ol><button class="mini" type="button" data-copy-codes="' + esc(v.id) + '">Скопировать для YouTube</button></details>';
      }
      h += '</div>';
      if (App.admin) {
        h += '<div class="edit-row">' +
             '<button class="mini gold" data-act="edit-video" data-id="' + esc(v.id) + '">✎ Изменить</button>' +
             '<button class="mini" data-act="move-video-up" data-id="' + esc(v.id) + '">↑</button>' +
             '<button class="mini" data-act="move-video-down" data-id="' + esc(v.id) + '">↓</button>' +
             '<button class="mini warn" data-act="del-video" data-id="' + esc(v.id) + '">Удалить</button>' +
             '</div>';
      }
      h += '</div>';
    });

    if (App.admin) h += '<button class="add-card" data-act="add-video">＋ Добавить видео</button>';
    root.innerHTML = h;
  }

  /* ================= РЕНДЕР: МАТЕРИАЛЫ ================= */
  function renderMaterials() {
    var list = Store.data.materials || [], root = $('#materialsRoot'), h = '';

    if (!list.length) {
      h += '<div class="empty"><div class="e-ic">🔗</div><p>' +
           (App.admin ? 'Пока пусто. Добавь первую ссылку ниже.' : 'Материалы скоро появятся.') +
           '</p></div>';
    }

    /* группируем по категориям, порядок категорий — как в списке */
    var order = [], groups = {};
    list.forEach(function (it) {
      var k = (it.category || 'Разное').trim();
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(it);
    });

    order.forEach(function (cat) {
      h += '<div class="mgroup"><div class="mgroup-title">' + esc(cat) + '</div><div class="mlist">';
      groups[cat].forEach(function (it) {
        h += '<div class="mcard" data-open="' + esc(it.url || '') + '">' +
             '<div class="mico">' + esc(it.icon || '🔗') + '</div>' +
             '<div class="minfo">' +
             '<div class="mtitle">' + esc(it.title || 'Без названия') + '</div>' +
             (it.desc ? '<div class="mdesc">' + esc(it.desc) + '</div>' : '') +
             (it.url ? '<div class="mhost">' + esc(hostOf(it.url)) + '</div>' : '') +
             '</div><div class="marrow">›</div></div>';
        if (App.admin) {
          h += '<div class="edit-row" style="padding:0 0 4px">' +
               '<button class="mini gold" data-act="edit-material" data-id="' + esc(it.id) + '">✎ Изменить</button>' +
               '<button class="mini" data-act="move-material-up" data-id="' + esc(it.id) + '">↑</button>' +
               '<button class="mini" data-act="move-material-down" data-id="' + esc(it.id) + '">↓</button>' +
               '<button class="mini warn" data-act="del-material" data-id="' + esc(it.id) + '">Удалить</button>' +
               '</div>';
        }
      });
      h += '</div></div>';
    });

    if (App.admin) h += '<button class="add-card" data-act="add-material">＋ Добавить материал</button>';
    root.innerHTML = h;
  }

  /* ================= ОБЩАЯ ПЕРЕРИСОВКА ================= */
  function renderAll() {
    renderCourse();
    renderVideo();
    renderMaterials();
  }
  App.renderAll = renderAll;
  App.renderCourse = renderCourse;
  App.renderVideo = renderVideo;
  App.renderMaterials = renderMaterials;

  /* ================= СОБЫТИЯ ================= */
  document.addEventListener('click', function (e) {
    /* вкладки */
    var tab = e.target.closest('.tab');
    if (tab) { switchTab(tab.dataset.tab); return; }

    /* прыжок к модулю из карты */
    var goto = e.target.closest('[data-goto]');
    if (goto) {
      var el = document.getElementById('mod-' + goto.dataset.goto);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); haptic(); }
      return;
    }

    /* раскрыть/свернуть урок */
    var tgl = e.target.closest('[data-toggle]');
    if (tgl) {
      var art = tgl.closest('.lesson');
      art.classList.toggle('open');
      haptic();
      return;
    }

    /* запуск youtube */
    var play = e.target.closest('[data-play]');
    if (play) {
      play.outerHTML = player(play.dataset.play);
      haptic();
      return;
    }

    /* таймкод: запустить видео с нужной секунды */
    var seek = e.target.closest('[data-seek]');
    if (seek) {
      var card = seek.closest('.vcard');
      if (!card.dataset.yt) return;
      card.querySelector('.vthumb').outerHTML = player(card.dataset.yt, +seek.dataset.seek);
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      haptic();
      return;
    }

    /* скопировать таймкоды для описания на YouTube */
    var cc = e.target.closest('[data-copy-codes]');
    if (cc) {
      var vv = (Store.data.videos || []).filter(function (x) { return x.id === cc.dataset.copyCodes; })[0];
      copyText(codesText(vv && vv.timecodes))
        .then(function () { toast('Таймкоды скопированы'); })
        .catch(function () { toast('Не получилось скопировать', 'err'); });
      return;
    }

    /* внешняя ссылка */
    var op = e.target.closest('[data-open]');
    if (op && !e.target.closest('.edit-row')) {
      openLink(op.dataset.open);
      haptic();
      return;
    }
  });

  /* секретный вход в редактор: 5 быстрых тапов по «Курс» */
  (function () {
    var taps = 0, timer;
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.tab-course')) return;
      taps++;
      clearTimeout(timer);
      timer = setTimeout(function () { taps = 0; }, 900);
      if (taps >= 5) {
        taps = 0;
        App.admin = true;
        $('#adminBtn').hidden = false;
        renderAll();
        toast('Режим редактирования включён');
      }
    });
  })();

  /* ================= СТАРТ ================= */
  function boot() {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#0f0f11');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0f0f11');
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      } catch (e) {}
    }

    Store.load()
      .then(function () {
        /* кто редактор? */
        var uid = tg && tg.initDataUnsafe && tg.initDataUnsafe.user
          ? tg.initDataUnsafe.user.id : null;
        App.userId = uid;
        var owners = CONFIG.OWNERS || [];
        App.ownersEmpty = owners.length === 0;
        if (App.ownersEmpty) App.admin = true;                 // ещё не настроено — редактор открыт всем
        else if (uid && owners.indexOf(uid) !== -1) App.admin = true;

        $('#adminBtn').hidden = !App.admin;
        renderAll();
        $('#loader').classList.add('hide');
      })
      .catch(function (err) {
        $('#loader').classList.add('hide');
        $('#courseRoot').innerHTML =
          '<div class="empty"><div class="e-ic">⚠️</div><p>Не удалось загрузить курс.<br>' +
          esc(err.message) + '</p></div>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

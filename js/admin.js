/* ============================================================
   ADMIN — панель редактирования: курс, видео, материалы
   ============================================================ */
(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var esc = function (s) { return App.esc(s); };

  var sheet = $('#sheet'), backdrop = $('#sheetBackdrop'),
      body = $('#sheetBody'), titleEl = $('#sheetTitle'),
      backBtn = $('#sheetBack');
  var backStack = [];

  /* ---------- панель ---------- */
  function open(title, html, onBack) {
    titleEl.textContent = title;
    body.innerHTML = html;
    body.scrollTop = 0;
    sheet.hidden = false;
    backdrop.hidden = false;
    backBtn.hidden = !onBack;
    backStack = onBack ? [onBack] : [];
    App.haptic();
  }
  function close() {
    sheet.hidden = true;
    backdrop.hidden = true;
    backStack = [];
  }
  $('#sheetClose').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  backBtn.addEventListener('click', function () {
    var fn = backStack.pop();
    if (fn) fn(); else close();
  });

  /* ---------- поиск сущностей ---------- */
  function findVideo(id) { return (Store.data.videos || []).filter(function (v) { return v.id === id; })[0]; }
  function findMaterial(id) { return (Store.data.materials || []).filter(function (v) { return v.id === id; })[0]; }
  function findModule(id) { return (Store.data.modules || []).filter(function (v) { return v.id === id; })[0]; }
  function findLesson(id) {
    var out = null;
    (Store.data.modules || []).forEach(function (m) {
      (m.lessons || []).forEach(function (l) { if (l.id === id) out = { mod: m, les: l }; });
    });
    return out;
  }

  function move(arr, idx, dir) {
    var j = idx + dir;
    if (j < 0 || j >= arr.length) return false;
    var t = arr[idx]; arr[idx] = arr[j]; arr[j] = t;
    return true;
  }

  function saved(msg) {
    Store.save();
    App.renderAll();
    App.toast(msg || 'Сохранено');
  }

  function field(label, name, value, opts) {
    opts = opts || {};
    var h = '<div class="field"><label>' + esc(label) + '</label>';
    if (opts.type === 'textarea') {
      h += '<textarea class="ta' + (opts.big ? ' big' : '') + '" name="' + name + '" placeholder="' +
           esc(opts.ph || '') + '">' + esc(value || '') + '</textarea>';
    } else if (opts.type === 'select') {
      h += '<select class="sel" name="' + name + '">';
      (opts.options || []).forEach(function (o) {
        h += '<option value="' + esc(o.value) + '"' + (String(o.value) === String(value || '') ? ' selected' : '') +
             '>' + esc(o.label) + '</option>';
      });
      h += '</select>';
    } else {
      h += '<input class="inp" name="' + name + '" value="' + esc(value || '') + '" placeholder="' +
           esc(opts.ph || '') + '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + '>';
    }
    if (opts.hint) h += '<div class="hint">' + opts.hint + '</div>';
    return h + '</div>';
  }

  function val(name) {
    var el = body.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : '';
  }

  /* «1:25 — Первая тема» → { t: '1:25', title: 'Первая тема' }; строки без времени пропускаем */
  function parseCodes(text) {
    return text.split('\n').map(function (line) {
      var m = line.match(/^\s*(\d{1,2}(?::\d{2}){1,2})\s*[-–—|.:)]?\s*(.+)$/);
      return m ? { t: m[1], title: m[2].trim() } : null;
    }).filter(Boolean);
  }

  /* ============================================================
     ФОРМА: ВИДЕО
     ============================================================ */
  function videoForm(v, isNew) {
    var mods = (Store.data.modules || []).map(function (m) {
      return { value: m.id, label: 'Модуль ' + (m.num || '') + ' · ' + (m.name || m.title) };
    });
    mods.unshift({ value: '', label: 'Без привязки к модулю' });

    var h = '<div class="note">Вставь обычную ссылку с YouTube — приложение само вытащит видео и обложку.<br>' +
            '<b>Подойдёт любой вид:</b> youtube.com/watch?v=…, youtu.be/…, /shorts/…</div>';
    h += field('Ссылка на YouTube', 'url', v.url, { ph: 'https://www.youtube.com/watch?v=...' });
    h += field('Название', 'title', v.title, { ph: 'Урок 1. Как собрать пайплайн' });
    h += field('Описание', 'desc', v.desc, { type: 'textarea', ph: 'Пара строк о чём видео' });
    h += field('Модуль курса', 'module', v.module, { type: 'select', options: mods });
    h += field('Длительность', 'duration', v.duration, { ph: '12:40', hint: 'Необязательно — показывается на обложке' });
    h += field('Таймкоды', 'timecodes', App.codesText(v.timecodes), {
      type: 'textarea', big: true, ph: '0:00 Вступление\n1:25 Первая тема\n4:10 Итоги',
      hint: 'Каждый с новой строки: время и название. Для глав на YouTube первый — 0:00, всего от трёх.'
    });
    h += '<div class="btn-row"><button class="btn btn-gold" data-save="video">Сохранить</button></div>';

    open(isNew ? 'Новое видео' : 'Видео', h);

    body.querySelector('[data-save="video"]').addEventListener('click', function () {
      var url = val('url');
      if (!url) return App.toast('Вставь ссылку на видео', 'err');
      if (!App.ytId(url) && !/^https?:\/\//.test(url)) return App.toast('Ссылка не похожа на рабочую', 'err');
      v.url = url;
      v.title = val('title') || 'Без названия';
      v.desc = val('desc');
      v.module = val('module');
      v.duration = val('duration');
      v.timecodes = parseCodes(val('timecodes'));
      if (isNew) {
        Store.data.videos = Store.data.videos || [];
        Store.data.videos.push(v);
      }
      close();
      saved(isNew ? 'Видео добавлено' : 'Видео обновлено');
      App.switchTab('video');
    });
  }

  /* ============================================================
     ФОРМА: МАТЕРИАЛ
     ============================================================ */
  function materialForm(it, isNew) {
    var cats = {};
    (Store.data.materials || []).forEach(function (m) { if (m.category) cats[m.category] = 1; });
    ['Шрифты', 'Инструменты', 'Референсы', 'Документация', 'Иконки', 'Цвета'].forEach(function (c) { cats[c] = 1; });

    var h = '<div class="note">Сюда складывай сайты со шрифтами, сервисы и любые полезные ссылки. ' +
            'Материалы группируются по категории — просто пиши одинаковое название категории.</div>';
    h += field('Ссылка', 'url', it.url, { ph: 'https://fonts.google.com' });
    h += field('Название', 'title', it.title, { ph: 'Google Fonts' });
    h += field('Описание', 'desc', it.desc, { type: 'textarea', ph: 'Чем полезно' });

    h += '<div class="field"><label>Категория</label><div class="chips" id="catChips">';
    Object.keys(cats).forEach(function (c) {
      h += '<button class="chip" type="button" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    });
    h += '</div><input class="inp" name="category" value="' + esc(it.category || '') +
         '" placeholder="Шрифты"><div class="hint">Нажми на подсказку или впиши свою</div></div>';

    h += '<div class="field"><label>Значок</label><div class="chips" id="icoChips">';
    ['🔤', '🧰', '🎨', '📐', '📄', '🖼', '⚡️', '🔗', '🎬', '🧩', '📦', '🌐'].forEach(function (i) {
      h += '<button class="chip" type="button" data-ico="' + i + '" style="font-size:16px">' + i + '</button>';
    });
    h += '</div><input class="inp" name="icon" value="' + esc(it.icon || '🔗') + '"></div>';

    h += '<div class="btn-row"><button class="btn btn-gold" data-save="material">Сохранить</button></div>';

    open(isNew ? 'Новый материал' : 'Материал', h);

    $$('#catChips .chip', body).forEach(function (c) {
      c.addEventListener('click', function () {
        body.querySelector('[name="category"]').value = c.dataset.cat;
        App.haptic();
      });
    });
    $$('#icoChips .chip', body).forEach(function (c) {
      c.addEventListener('click', function () {
        body.querySelector('[name="icon"]').value = c.dataset.ico;
        App.haptic();
      });
    });

    body.querySelector('[data-save="material"]').addEventListener('click', function () {
      var url = val('url');
      if (!url) return App.toast('Вставь ссылку', 'err');
      if (!/^https?:\/\//.test(url)) url = 'https://' + url;
      it.url = url;
      it.title = val('title') || url;
      it.desc = val('desc');
      it.category = val('category') || 'Разное';
      it.icon = val('icon') || '🔗';
      if (isNew) {
        Store.data.materials = Store.data.materials || [];
        Store.data.materials.push(it);
      }
      close();
      saved(isNew ? 'Материал добавлен' : 'Материал обновлён');
      App.switchTab('materials');
    });
  }

  /* ============================================================
     ФОРМА: МОДУЛЬ
     ============================================================ */
  function moduleForm(mod, isNew) {
    var h = field('Номер', 'num', mod.num, { ph: '09', hint: 'Две цифры — так же, как в курсе' });
    h += field('Короткое имя', 'name', mod.name, { ph: 'Дизайн-система', hint: 'Видно в карте курса' });
    h += field('Заголовок модуля', 'title', mod.title, { ph: 'Токены, кит, ведущий' });
    h += field('Подзаголовок', 'sub', mod.sub, { type: 'textarea', ph: 'Необязательно' });
    h += '<div class="btn-row"><button class="btn btn-gold" data-save="module">Сохранить</button>';
    if (!isNew) {
      h += '<button class="btn btn-ghost" data-act2="mod-up">↑ Выше</button>' +
           '<button class="btn btn-ghost" data-act2="mod-down">↓ Ниже</button>' +
           '<button class="btn btn-warn" data-act2="mod-del">Удалить модуль</button>';
    }
    h += '</div>';

    open(isNew ? 'Новый модуль' : 'Модуль', h);

    body.querySelector('[data-save="module"]').addEventListener('click', function () {
      mod.num = val('num');
      mod.name = val('name') || 'Без имени';
      mod.title = val('title') || mod.name;
      mod.sub = val('sub');
      if (isNew) {
        mod.lessons = [];
        Store.data.modules = Store.data.modules || [];
        Store.data.modules.push(mod);
      }
      close();
      saved(isNew ? 'Модуль добавлен' : 'Модуль обновлён');
    });

    $$('[data-act2]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var arr = Store.data.modules, i = arr.indexOf(mod), a = b.dataset.act2;
        if (a === 'mod-up') { if (!move(arr, i, -1)) return App.toast('Уже первый', 'err'); }
        if (a === 'mod-down') { if (!move(arr, i, 1)) return App.toast('Уже последний', 'err'); }
        if (a === 'mod-del') {
          if (!confirm('Удалить модуль «' + (mod.name || '') + '» вместе с уроками?')) return;
          arr.splice(i, 1);
        }
        close();
        saved('Готово');
      });
    });
  }

  /* ============================================================
     ФОРМА: УРОК
     ============================================================ */
  var SNIPPETS = [
    { name: 'Абзац', code: '<p class="body">Текст абзаца.</p>' },
    { name: 'Подзаголовок', code: '<h4>Подзаголовок</h4>' },
    { name: 'Промпт агенту', code: '<div class="bubble">\n  <div class="bubble-head"><span class="who"><span class="ic">💬</span>Отправь агенту</span><button type="button" class="copy">Копировать</button></div>\n  <pre><code>Текст промпта</code></pre>\n</div>' },
    { name: 'Команда', code: '<div class="bubble terminal">\n  <div class="bubble-head"><span class="who"><span class="ic">▸</span>В терминале</span><button type="button" class="copy">Копировать</button></div>\n  <pre><code>npm install</code></pre>\n</div>' },
    { name: 'Совет', code: '<div class="tip"><span class="ic">💡</span><p>Текст совета.</p></div>' },
    { name: 'Список', code: '<ul>\n  <li>Первый пункт</li>\n  <li>Второй пункт</li>\n</ul>' },
    { name: 'Нумерованный', code: '<ol>\n  <li>Шаг один</li>\n  <li>Шаг два</li>\n</ol>' },
    { name: 'Дерево файлов', code: '<div class="filetree">.claude/\n ├─ settings.json  <span class="dim">права</span>\n └─ hooks/         <span class="dim">скрипты</span></div>' },
    { name: 'Код в строке', code: '<code class="inline">CLAUDE.md</code>' },
    { name: 'Картинка', code: '<img src="https://" alt="">' },
    { name: 'Ссылка', code: '<a href="https://" target="_blank">текст ссылки</a>' }
  ];

  function lessonForm(ctx, isNew) {
    var les = ctx.les, mod = ctx.mod;
    var h = '<div class="note"><b>Модуль:</b> ' + esc(mod.name || mod.title) + '</div>';
    h += field('Подпись сверху', 'tag', les.tag, { ph: 'Урок 5 · Ключи и доступы' });
    h += field('Заголовок урока', 'title', les.title, { ph: 'О чём урок' });

    h += '<div class="field"><label>Содержание урока</label><div class="chips" id="snip">';
    SNIPPETS.forEach(function (s, i) {
      h += '<button class="chip" type="button" data-snip="' + i + '">＋ ' + esc(s.name) + '</button>';
    });
    h += '</div><textarea class="ta big" name="html" placeholder="&lt;p class=&quot;body&quot;&gt;Текст&lt;/p&gt;">' +
         esc(les.html || '') + '</textarea>' +
         '<div class="hint">Нажимай на кнопки выше — готовые блоки вставятся туда, где стоит курсор. ' +
         'Всё оформление подхватится автоматически.</div></div>';

    h += '<div class="btn-row"><button class="btn btn-gold" data-save="lesson">Сохранить</button>';
    if (!isNew) h += '<button class="btn btn-warn" data-act2="les-del">Удалить урок</button>';
    h += '</div>';

    open(isNew ? 'Новый урок' : 'Урок', h);

    var ta = body.querySelector('[name="html"]');
    $$('#snip .chip', body).forEach(function (c) {
      c.addEventListener('click', function () {
        var code = SNIPPETS[+c.dataset.snip].code;
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
        var pre = v.slice(0, s), post = v.slice(e);
        var ins = (pre && !/\n$/.test(pre) ? '\n' : '') + code + '\n';
        ta.value = pre + ins + post;
        ta.focus();
        ta.selectionStart = ta.selectionEnd = pre.length + ins.length;
        App.haptic();
      });
    });

    body.querySelector('[data-save="lesson"]').addEventListener('click', function () {
      les.tag = val('tag');
      les.title = val('title') || 'Без названия';
      les.html = ta.value.trim();
      if (isNew) {
        mod.lessons = mod.lessons || [];
        mod.lessons.push(les);
      }
      close();
      saved(isNew ? 'Урок добавлен' : 'Урок обновлён');
    });

    var del = body.querySelector('[data-act2="les-del"]');
    if (del) del.addEventListener('click', function () {
      if (!confirm('Удалить урок «' + (les.title || '') + '»?')) return;
      mod.lessons.splice(mod.lessons.indexOf(les), 1);
      close();
      saved('Урок удалён');
    });
  }

  /* ============================================================
     ФОРМА: ОБЛОЖКА КУРСА
     ============================================================ */
  function metaForm() {
    var m = Store.data.meta = Store.data.meta || {};
    var c = m.cost = m.cost || { items: [] };

    var h = field('Название курса', 'title', m.title, { ph: 'Пронин Learn', hint: 'Показывается под словом «Курс»' });
    h += field('Плашка сверху', 'badge', m.badge, { ph: '📚 Курс · 8 модулей · 16 уроков' });
    h += field('Описание', 'subtitle', m.subtitle, { type: 'textarea', ph: 'О чём курс' });

    h += '<div class="sep"></div><div class="field"><label>Блок со стоимостью</label></div>';
    h += field('Заголовок блока', 'ctitle', c.title, { ph: 'Во что обходится месяц роликов' });
    h += field('Итого', 'ctotal', c.total, { ph: '130 $' });
    h += '<div class="field"><label>Строки</label><div class="rowlist" id="costRows"></div>' +
         '<button class="mini gold" id="addCost">＋ Добавить строку</button></div>';
    h += field('Примечание', 'cnote', c.note, { type: 'textarea' });
    h += '<div class="btn-row"><button class="btn btn-gold" data-save="meta">Сохранить</button></div>';

    open('Обложка курса', h, adminMenu);

    function drawCost() {
      var box = $('#costRows', body);
      box.innerHTML = (c.items || []).map(function (it, i) {
        return '<div class="rowitem"><span class="rn">' + (i + 1) + '</span>' +
          '<input class="inp" style="flex:1;padding:8px 10px;font-size:13px" data-ci="' + i + '" data-k="amount" value="' + esc(it.amount) + '" placeholder="100 $">' +
          '<input class="inp" style="flex:1.3;padding:8px 10px;font-size:13px" data-ci="' + i + '" data-k="name" value="' + esc(it.name) + '" placeholder="Claude">' +
          '<div class="ra"><button class="icobtn warn" data-cdel="' + i + '">✕</button></div></div>';
      }).join('') || '<div class="hint">Пока пусто</div>';

      $$('[data-cdel]', box).forEach(function (b) {
        b.addEventListener('click', function () { c.items.splice(+b.dataset.cdel, 1); drawCost(); });
      });
      $$('[data-ci]', box).forEach(function (inp) {
        inp.addEventListener('input', function () { c.items[+inp.dataset.ci][inp.dataset.k] = inp.value; });
      });
    }
    c.items = c.items || [];
    drawCost();
    $('#addCost', body).addEventListener('click', function () {
      c.items.push({ amount: '', name: '' }); drawCost(); App.haptic();
    });

    body.querySelector('[data-save="meta"]').addEventListener('click', function () {
      m.title = val('title');
      m.badge = val('badge');
      m.subtitle = val('subtitle');
      c.title = val('ctitle');
      c.total = val('ctotal');
      c.note = val('cnote');
      close();
      saved('Обложка обновлена');
    });
  }

  /* ============================================================
     ПУБЛИКАЦИЯ
     ============================================================ */
  function publishSheet() {
    var gh = Store.ghReady();
    var h = '';

    h += '<div class="note">' +
      (Store.dirty
        ? '<b>Есть несохранённые правки.</b><br>Пока они видны только на этом телефоне. Чтобы их увидели все — опубликуй.'
        : '<span class="badge-ok">Всё опубликовано</span><br>Изменений с последней публикации нет.') +
      '</div>';

    if (gh) {
      h += '<div class="btn-row"><button class="btn btn-gold" id="pubGh">Опубликовать для всех</button></div>';
      h += '<div class="hint" style="margin:10px 2px 0">Репозиторий: ' +
           esc(CONFIG.GITHUB.owner + '/' + CONFIG.GITHUB.repo) + ' · ветка ' + esc(CONFIG.GITHUB.branch) +
           '.<br>Сайт обновится за 30–60 секунд после публикации.</div>';
      h += '<div class="sep"></div>';
    } else {
      h += '<div class="note">Чтобы публиковать прямо из приложения, впиши <b>owner</b> и <b>repo</b> ' +
           'в файле <b>js/config.js</b>. Без этого правки можно выгрузить файлом — способ ниже.</div>';
    }

    h += '<div class="btn-row">' +
         '<button class="btn btn-ghost" id="pubDl">Скачать файл content.json</button>' +
         '<button class="btn btn-ghost" id="pubCopy">Скопировать содержимое</button>' +
         '</div>';
    h += '<div class="hint" style="margin:10px 2px 0">Скачанный файл нужно положить в репозиторий вместо ' +
         '<b>data/content.json</b> — и сайт обновится сам.</div>';

    h += '<div class="sep"></div>';
    h += '<div class="btn-row">' +
         (gh ? '<button class="btn btn-ghost" id="pubToken">Токен GitHub</button>' : '') +
         '<button class="btn btn-warn" id="pubReset">Откатить мои правки</button>' +
         '</div>';

    open('Публикация', h, adminMenu);

    if (gh) {
      $('#pubGh', body).addEventListener('click', function () {
        var btn = this;
        Store.getToken().then(function (t) {
          if (!t) return tokenSheet();
          btn.textContent = 'Публикую…';
          Store.publish()
            .then(function () {
              close();
              App.toast('Опубликовано. Обновится через минуту');
            })
            .catch(function (e) {
              btn.textContent = 'Опубликовать для всех';
              App.toast(e.message, 'err');
            });
        });
      });
      $('#pubToken', body).addEventListener('click', tokenSheet);
    }

    $('#pubDl', body).addEventListener('click', function () {
      Store.download();
      App.toast('Файл сохранён');
    });
    $('#pubCopy', body).addEventListener('click', function () {
      App.copyText(Store.toJSON()).then(function () { App.toast('Скопировано'); });
    });
    $('#pubReset', body).addEventListener('click', function () {
      if (!confirm('Вернуть курс к тому виду, что опубликован? Твои правки на этом телефоне пропадут.')) return;
      Store.dropDraft();
      close();
      App.renderAll();
      App.toast('Правки откачены');
    });
  }

  /* ---------- токен ---------- */
  function tokenSheet() {
    Store.getToken().then(function (cur) {
      var h = '<div class="note">Токен нужен, чтобы приложение могло само записывать изменения в репозиторий.<br><br>' +
        '<b>Где взять:</b> github.com → Settings → Developer settings → Personal access tokens → ' +
        'Fine-grained tokens → Generate new token. Дай доступ только своему репозиторию и право ' +
        '<b>Contents: Read and write</b>.<br><br>Токен хранится только у тебя — в памяти Telegram на твоих устройствах.</div>';
      h += field('Токен', 'token', cur, { ph: 'github_pat_…' });
      h += '<div class="btn-row"><button class="btn btn-gold" id="tkSave">Сохранить токен</button>' +
           (cur ? '<button class="btn btn-warn" id="tkDel">Удалить токен</button>' : '') + '</div>';

      open('Токен GitHub', h, publishSheet);

      $('#tkSave', body).addEventListener('click', function () {
        var t = val('token');
        if (!t) return App.toast('Пустой токен', 'err');
        Store.setToken(t);
        publishSheet();
        App.toast('Токен сохранён');
      });
      var d = $('#tkDel', body);
      if (d) d.addEventListener('click', function () {
        Store.clearToken();
        publishSheet();
        App.toast('Токен удалён');
      });
    });
  }

  /* ============================================================
     ГЛАВНОЕ МЕНЮ РЕДАКТОРА
     ============================================================ */
  function adminMenu() {
    var nMod = (Store.data.modules || []).length;
    var nLes = (Store.data.modules || []).reduce(function (s, m) { return s + (m.lessons || []).length; }, 0);
    var nVid = (Store.data.videos || []).length;
    var nMat = (Store.data.materials || []).length;

    var h = '';
    if (App.ownersEmpty) {
      h += '<div class="note" style="border-color:rgba(207,157,74,.38);background:rgba(207,157,74,.1)">' +
           '<b>Редактор сейчас открыт всем.</b> Чтобы кнопку ⚙ видел только ты — нажми «Мой Telegram ID» внизу и впиши его в OWNERS в файле js/config.js.' +
           '</div>';
    }
    h += '<div class="note">' + (Store.dirty
      ? '<b>Есть неопубликованные правки.</b> Они видны только тебе, пока не нажмёшь «Опубликовать».'
      : '<span class="badge-ok">Всё опубликовано</span>') + '</div>';

    h += item('publish', '🚀', 'Публикация', Store.dirty ? 'Выложить правки, чтобы их увидели все' : 'Изменений нет');
    h += item('meta', '✨', 'Обложка курса', 'Название, описание, блок со стоимостью');
    h += item('mods', '📚', 'Модули и уроки', nMod + ' модулей · ' + nLes + ' уроков');
    h += item('vids', '🎬', 'Видео', nVid ? nVid + ' шт.' : 'Пока пусто');
    h += item('mats', '🔗', 'Материалы', nMat ? nMat + ' шт.' : 'Пока пусто');
    h += '<div class="sep"></div>';
    h += item('who', '🆔', 'Мой Telegram ID', App.userId ? String(App.userId) : 'Открой приложение внутри Telegram');

    open('Редактор', h);
  }

  /* один обработчик на все пункты меню — вешается ровно раз */
  body.addEventListener('click', function (e) {
    var it = e.target.closest('[data-menu]');
    if (!it) return;
    var k = it.dataset.menu;
    if (k === 'publish') publishSheet();
    else if (k === 'meta') metaForm();
    else if (k === 'mods') modsList();
    else if (k === 'vids') { close(); App.switchTab('video'); }
    else if (k === 'mats') { close(); App.switchTab('materials'); }
    else if (k === 'who') {
      if (App.userId) {
        App.copyText(String(App.userId)).then(function () {
          App.toast('ID скопирован: ' + App.userId);
        });
      } else App.toast('ID виден только внутри Telegram', 'err');
    }
  });

  function item(key, ic, tt, ds) {
    return '<button class="menu-item" type="button" data-menu="' + key + '">' +
      '<span class="menu-ic">' + ic + '</span><span class="menu-tx">' +
      '<span class="menu-tt">' + esc(tt) + '</span>' +
      '<span class="menu-ds">' + esc(ds) + '</span></span>' +
      '<span class="menu-ar">›</span></button>';
  }

  /* ---------- список модулей ---------- */
  function modsList() {
    var h = '<div class="note">Нажми на модуль, чтобы поправить его. Уроки редактируются прямо на вкладке «Курс» — ' +
            'разверни урок и нажми «Изменить».</div><div class="rowlist">';
    (Store.data.modules || []).forEach(function (m, i) {
      h += '<div class="rowitem"><span class="rn">' + esc(m.num || (i + 1)) + '</span>' +
        '<span class="rt">' + esc(m.name || m.title) + ' · ' + (m.lessons || []).length + ' ур.</span>' +
        '<span class="ra">' +
        '<button class="icobtn" data-mup="' + esc(m.id) + '">↑</button>' +
        '<button class="icobtn" data-mdown="' + esc(m.id) + '">↓</button>' +
        '<button class="icobtn" data-medit="' + esc(m.id) + '">✎</button>' +
        '</span></div>';
    });
    h += '</div><div class="btn-row"><button class="btn btn-gold" id="addMod">＋ Добавить модуль</button></div>';

    open('Модули и уроки', h, adminMenu);

    $$('[data-medit]', body).forEach(function (b) {
      b.addEventListener('click', function () { moduleForm(findModule(b.dataset.medit), false); });
    });
    $$('[data-mup],[data-mdown]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.mup || b.dataset.mdown;
        var arr = Store.data.modules, i = arr.indexOf(findModule(id));
        if (!move(arr, i, b.dataset.mup ? -1 : 1)) return App.toast('Дальше некуда', 'err');
        Store.save(); App.renderCourse(); modsList();
      });
    });
    $('#addMod', body).addEventListener('click', function () {
      moduleForm({ id: Store.uid('m'), num: '', name: '', title: '', sub: '', lessons: [] }, true);
    });
  }

  /* ============================================================
     КНОПКИ НА КАРТОЧКАХ
     ============================================================ */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    e.stopPropagation();
    var a = b.dataset.act, id = b.dataset.id;

    /* --- видео --- */
    if (a === 'add-video') return videoForm({ id: Store.uid('v') }, true);
    if (a === 'edit-video') return videoForm(findVideo(id), false);
    if (a === 'del-video') {
      if (!confirm('Удалить это видео?')) return;
      var vs = Store.data.videos;
      vs.splice(vs.indexOf(findVideo(id)), 1);
      return saved('Видео удалено');
    }
    if (a === 'move-video-up' || a === 'move-video-down') {
      var va = Store.data.videos;
      if (!move(va, va.indexOf(findVideo(id)), a.endsWith('up') ? -1 : 1)) return App.toast('Дальше некуда', 'err');
      return saved('Порядок изменён');
    }

    /* --- материалы --- */
    if (a === 'add-material') return materialForm({ id: Store.uid('mat'), icon: '🔗' }, true);
    if (a === 'edit-material') return materialForm(findMaterial(id), false);
    if (a === 'del-material') {
      if (!confirm('Удалить этот материал?')) return;
      var ms = Store.data.materials;
      ms.splice(ms.indexOf(findMaterial(id)), 1);
      return saved('Материал удалён');
    }
    if (a === 'move-material-up' || a === 'move-material-down') {
      var ma = Store.data.materials;
      if (!move(ma, ma.indexOf(findMaterial(id)), a.endsWith('up') ? -1 : 1)) return App.toast('Дальше некуда', 'err');
      return saved('Порядок изменён');
    }

    /* --- модули и уроки --- */
    if (a === 'add-module') return moduleForm({ id: Store.uid('m'), num: '', name: '', title: '', sub: '', lessons: [] }, true);
    if (a === 'edit-module') return moduleForm(findModule(id), false);
    if (a === 'add-lesson') {
      var mod = findModule(id);
      return lessonForm({ mod: mod, les: { id: Store.uid('l'), tag: '', title: '', html: '' } }, true);
    }
    if (a === 'edit-lesson') return lessonForm(findLesson(id), false);
    if (a === 'del-lesson') {
      var ctx = findLesson(id);
      if (!confirm('Удалить урок «' + (ctx.les.title || '') + '»?')) return;
      ctx.mod.lessons.splice(ctx.mod.lessons.indexOf(ctx.les), 1);
      return saved('Урок удалён');
    }
    if (a === 'move-lesson-up' || a === 'move-lesson-down') {
      var c2 = findLesson(id);
      if (!move(c2.mod.lessons, c2.mod.lessons.indexOf(c2.les), a.endsWith('up') ? -1 : 1))
        return App.toast('Дальше некуда', 'err');
      return saved('Порядок изменён');
    }
  }, true);

  $('#adminBtn').addEventListener('click', adminMenu);
  window.Admin = { menu: adminMenu, publish: publishSheet };
})();

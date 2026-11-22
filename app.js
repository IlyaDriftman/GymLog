(function () {
  const D = window.GymData;
  const KEY = "gymlog.telegram.v1";
  const UIKEY = "gymlog.telegram.ui";

  const state = {
    view: "home",
    dayId: null,
    sessionId: null,
    exerciseIndex: 0,
    detailId: null,
    catalogId: null,
    query: "",
    muscle: "all",
    modal: null,
    replaceUid: null,
    toast: "",
    undo: null,
    openTech: {},
    importText: "",
    returnTo: null,
    accountSync: "local",
  };

  let db = loadDb();
  let toastId = 0;
  let toastTimer = 0;
  let planFinger = "";
  let sessionFingers = new Map();
  let syncing = false;
  let syncAgain = false;

  function loadDb() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
      if (parsed?.plan?.days && Array.isArray(parsed.sessions)) {
        if (!Array.isArray(parsed.deletedSessionIds)) parsed.deletedSessionIds = [];
        return parsed;
      }
    } catch (error) {
      /* keep the starter plan */
    }
    return { plan: D.defaultPlan(), sessions: [], deletedSessionIds: [] };
  }

  function recordBody(record) {
    const copy = { ...record };
    delete copy.updatedAt;
    return JSON.stringify(copy);
  }

  function rememberFingers() {
    planFinger = recordBody(db.plan);
    sessionFingers = new Map(db.sessions.map((session) => [session.id, recordBody(session)]));
  }

  function stampDirty() {
    const now = new Date().toISOString();
    if (recordBody(db.plan) !== planFinger) db.plan.updatedAt = now;
    for (const session of db.sessions) {
      const body = recordBody(session);
      if (!sessionFingers.has(session.id) || sessionFingers.get(session.id) !== body) {
        session.updatedAt = now;
      }
    }
  }

  function writeLocal() {
    db.sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function save() {
    stampDirty();
    writeLocal();
    rememberFingers();
    scheduleSync();
  }

  function forgetSession(id) {
    if (!db.deletedSessionIds.includes(id)) db.deletedSessionIds.push(id);
    db.sessions = db.sessions.filter((session) => session.id !== id);
    save();
  }

  function dayById(id) {
    return db.plan.days.find((day) => day.id === id) || null;
  }

  function sessionById(id) {
    return db.sessions.find((session) => session.id === id) || null;
  }

  function activeSession() {
    return db.sessions.find((session) => !session.completed) || null;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function parseNum(value) {
    const text = String(value ?? "").trim().replace(",", ".");
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function countWord(n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }

  function shortDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  function dateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function weekdayLabel(day) {
    return D.WEEKDAYS
      .filter((item) => (day.weekdays || []).includes(item.id))
      .map((item) => item.title)
      .join(" · ");
  }

  function muscleLine(item) {
    if (!item) return "";
    return `${item.muscles.map(D.muscleTitle).join(" · ")} · ${D.EQUIPMENT[item.equipment] || ""}`;
  }

  function lastCompleted(dayId) {
    return db.sessions.find((session) => session.completed && session.dayId === dayId) || null;
  }

  function showToast(message, undo, keepScroll) {
    toastId += 1;
    const id = toastId;
    state.toast = message;
    state.undo = undo || null;
    render({ keepScroll: !!keepScroll });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (id !== toastId) return;
      state.toast = "";
      state.undo = null;
      render({ keepScroll: true });
    }, 4200);
  }

  function topbar(title) {
    return `<header class="top"><button class="icon" type="button" data-action="back" aria-label="Назад">←</button><h1>${esc(title)}</h1></header>`;
  }

  function barsHtml(points) {
    if (!points.length) return "";
    const max = Math.max(...points.map((point) => point.total), 1);
    return `<div class="bars">${points.map((point) => `
      <div class="barcol${point.live ? " live" : ""}">
        <span>${point.total}</span>
        <i style="height:${Math.max(8, Math.round(64 * point.total / max))}px"></i>
        <em>${esc(point.label)}</em>
      </div>`).join("")}</div>`;
  }

  function techniqueBlock(id, item) {
    if (!item?.technique?.length) return "";
    return `<details data-tech="${esc(id)}" ${state.openTech[id] ? "open" : ""}>
      <summary>Техника</summary>
      <ul>${item.technique.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
    </details>`;
  }

  function subsHtml(subs, action, extra) {
    if (!subs?.length) {
      return `<p class="muted small">В базе пока нет замены. Если снаряд занят — пропусти или оставь на конец тренировки.</p>`;
    }
    return subs.map((sub) => {
      const target = D.byId(sub.id);
      if (!target) return "";
      const inner = `<span>${esc(target.name)}</span><small>${esc(sub.reason)}</small>`;
      if (!action || action === "noop") return `<div class="sub">${inner}</div>`;
      return `<button class="sub" type="button" data-action="${action}" data-id="${esc(sub.id)}" ${extra || ""}>${inner}</button>`;
    }).join("");
  }

  function viewHome() {
    const today = new Date();
    const active = activeSession();
    const samples = D.pullupSamples(db.sessions);
    const todayIds = new Set(D.matchingDays(db.plan, today).map((day) => day.id));
    const days = db.plan.days.map((day) => {
      const last = lastCompleted(day.id);
      const suggested = todayIds.has(day.id);
      const bars = day.kind === "pullups" && samples.length
        ? barsHtml(samples.slice(-8).map((sample) => ({ total: sample.total, label: shortDate(sample.date) })))
        : "";
      const lastPull = day.kind === "pullups" ? samples[samples.length - 1] : null;
      return `<button class="card ${suggested ? "today" : ""}" type="button" data-action="start" data-day="${esc(day.id)}">
        <div class="card-top">
          <strong>${esc(day.title)}</strong>
          ${suggested ? `<span class="badge">сегодня</span>` : ""}
        </div>
        <p class="muted small">${esc(day.subtitle)}</p>
        <p class="muted small">${esc(weekdayLabel(day) || "день не выбран")} · ${day.blocks.length} ${countWord(day.blocks.length, "упражнение", "упражнения", "упражнений")}</p>
        ${last ? `<p class="small">последний раз ${esc(shortDate(last.date))}</p>` : ""}
        ${lastPull ? `<p class="small ${lastPull.delta > 0 ? "delta-up" : lastPull.delta < 0 ? "delta-down" : ""}">${lastPull.total} повт${lastPull.delta == null ? "" : ` · ${lastPull.delta > 0 ? "+" : ""}${lastPull.delta}`}</p>` : ""}
        ${bars}
      </button>`;
    }).join("");

    const resume = active ? `<button class="card today" type="button" data-action="resume">
      <p class="accent small">Продолжить</p>
      <strong>${esc(active.dayTitle)}</strong>
      <p class="muted small">${esc(dateTime(active.date))}</p>
    </button>
    <button class="danger" type="button" data-action="discard">Удалить незавершённую</button>` : "";

    return `<header class="hero">
      <h2>GymLog</h2>
      <p class="accent">Push · Pull · Legs</p>
      <p class="muted">${esc(D.todayLine(db.plan, today))}</p>
    </header>
    <div class="stack">
      ${resume}
      <button class="secondary wide" type="button" data-go="plan">Собрать или изменить план</button>
      <p class="section-label">Начать тренировку</p>
      ${days || `<p class="muted">План пустой. Собери день из упражнений.</p>`}
      <button class="secondary wide" type="button" data-go="history">История тренировок</button>
      <button class="secondary wide" type="button" data-go="catalog">База упражнений</button>
      <button class="secondary wide" type="button" data-go="data">Данные</button>
      <p class="muted small" data-sync>${esc(syncText())}</p>
      <p class="muted small foot">Левое плечо: жимы только гантелями, верхний блок к груди. Если больно — вес вниз, не терпеть.</p>
    </div>`;
  }

  function viewPlan() {
    const days = db.plan.days.map((day, index) => `<article class="card">
      <div class="card-top">
        <button class="textbtn" type="button" data-action="open-day" data-day="${esc(day.id)}"><strong>${esc(day.title)}</strong></button>
        <span class="muted small">${day.blocks.length}</span>
      </div>
      <p class="muted small">${esc(day.subtitle)}</p>
      <p class="muted small">${esc(weekdayLabel(day) || "без дня недели")}</p>
      <div class="cube-actions">
        <button type="button" data-action="move-day" data-day="${esc(day.id)}" data-dir="-1" ${index === 0 ? "disabled" : ""}>Вверх</button>
        <button type="button" data-action="move-day" data-day="${esc(day.id)}" data-dir="1" ${index === db.plan.days.length - 1 ? "disabled" : ""}>Вниз</button>
        <button type="button" data-action="open-day" data-day="${esc(day.id)}">Править</button>
        <button class="danger" type="button" data-action="delete-day" data-day="${esc(day.id)}">Удалить</button>
      </div>
    </article>`).join("");
    return `${topbar("План")}
      <p class="muted">День — это стопка кубиков. В каждом кубике свои подходы и повторения. Стартовый план — твоя текущая программа.</p>
      <div class="stack" style="margin-top:14px">${days}</div>
      <div class="stack" style="margin-top:14px">
        <button class="primary wide" type="button" data-action="add-day">Добавить день</button>
        <button class="secondary wide" type="button" data-action="reset-plan">Вернуть исходную программу</button>
      </div>`;
  }

  function cubeHtml(day, block, index) {
    const item = D.byId(block.exerciseId);
    const past = D.previousFor(db.sessions, block.exerciseId, null);
    const pastLine = past
      ? Object.keys(past.map).map(Number).sort((a, b) => a - b).map((key) => D.formatLoggedSet(past.map[key], item?.log === "reps")).join(", ")
      : "";
    return `<article class="cube" data-muscle="${esc(item?.muscles[0] || "core")}">
      <div class="cube-head">
        <span class="pip">${index + 1}</span>
        <div>
          <h3>${esc(item?.name || "Нет в базе")}</h3>
          <p class="muted small">${esc(muscleLine(item))}</p>
        </div>
      </div>
      <div class="scheme">
        <div class="stepper">
          <button type="button" data-action="plan-sets" data-day="${esc(day.id)}" data-block="${esc(block.uid)}" data-delta="-1" aria-label="Меньше подходов">−</button>
          <div><b>${block.sets}</b><span>${countWord(block.sets, "подход", "подхода", "подходов")}</span></div>
          <button type="button" data-action="plan-sets" data-day="${esc(day.id)}" data-block="${esc(block.uid)}" data-delta="1" aria-label="Больше подходов">+</button>
        </div>
        <label>повторения
          <input data-bind="block-reps" data-day="${esc(day.id)}" data-block="${esc(block.uid)}" value="${esc(block.reps)}">
        </label>
      </div>
      <label>старт, кг
        <input inputmode="decimal" data-bind="block-weight" data-day="${esc(day.id)}" data-block="${esc(block.uid)}" value="${esc(D.fmtNum(block.startWeightKg))}" placeholder="без веса">
      </label>
      <label>заметка к кубику
        <input data-bind="block-note" data-day="${esc(day.id)}" data-block="${esc(block.uid)}" value="${esc(block.note || "")}" placeholder="необязательно">
      </label>
      ${pastLine ? `<p class="was">было: ${esc(pastLine)}</p>` : ""}
      ${item?.caution ? `<p class="caution">${esc(item.caution)}</p>` : ""}
      <div class="subs">
        <p class="kicker">Если занято</p>
        ${subsHtml(item?.subs, "swap-block", `data-day="${esc(day.id)}" data-block="${esc(block.uid)}"`)}
      </div>
      ${techniqueBlock(block.uid, item)}
      <div class="cube-actions">
        <button type="button" data-action="move-block" data-day="${esc(day.id)}" data-block="${esc(block.uid)}" data-dir="-1" ${index === 0 ? "disabled" : ""}>Вверх</button>
        <button type="button" data-action="move-block" data-day="${esc(day.id)}" data-block="${esc(block.uid)}" data-dir="1" ${index === day.blocks.length - 1 ? "disabled" : ""}>Вниз</button>
        <button class="danger" type="button" data-action="remove-block" data-day="${esc(day.id)}" data-block="${esc(block.uid)}">Удалить</button>
      </div>
    </article>`;
  }

  function viewDay() {
    const day = dayById(state.dayId);
    if (!day) return viewPlan();
    const cubes = day.blocks.map((block, index) => cubeHtml(day, block, index)).join("");
    return `${topbar("День")}
      <label>название
        <input data-bind="day-title" data-day="${esc(day.id)}" value="${esc(day.title)}">
      </label>
      <label>подпись
        <input data-bind="day-subtitle" data-day="${esc(day.id)}" value="${esc(day.subtitle)}">
      </label>
      <p class="kicker">Дни недели</p>
      <div class="chips">
        ${D.WEEKDAYS.map((item) => `<button class="chip ${(day.weekdays || []).includes(item.id) ? "on" : ""}" type="button" data-action="weekday" data-day="${esc(day.id)}" data-wd="${item.id}">${item.title}</button>`).join("")}
      </div>
      <p class="kicker">Тип</p>
      <div class="chips">
        <button class="chip ${day.kind === "gym" ? "on" : ""}" type="button" data-action="day-kind" data-day="${esc(day.id)}" data-kind="gym">Зал</button>
        <button class="chip ${day.kind === "pullups" ? "on" : ""}" type="button" data-action="day-kind" data-day="${esc(day.id)}" data-kind="pullups">Подтягивания</button>
      </div>
      <p class="section-label">Кубики</p>
      <div class="stack">${cubes || `<p class="muted">Пока пусто. Добавь упражнения из базы — у каждого внутри подходы и повторения.</p>`}</div>
      <div class="navpad"></div>
      <div class="nav">
        <button class="secondary" type="button" data-action="open-pick" data-day="${esc(day.id)}">Добавить</button>
        <button class="primary" type="button" data-action="start" data-day="${esc(day.id)}">Начать</button>
      </div>`;
  }

  function viewPick() {
    const day = dayById(state.dayId);
    if (!day) return viewPlan();
    const query = state.query.trim().toLowerCase();
    const items = D.CATALOG.filter((item) => {
      if (query && !item.name.toLowerCase().includes(query)) return false;
      if (state.muscle !== "all" && !item.muscles.includes(state.muscle)) return false;
      return true;
    });
    const rows = items.map((item) => {
      const used = db.plan.days.filter((entry) => entry.blocks.some((block) => block.exerciseId === item.id)).map((entry) => entry.title);
      return `<button class="pick" type="button" data-action="add-exercise" data-id="${esc(item.id)}">
        <strong>${esc(item.name)}</strong>
        <p class="muted small">${esc(muscleLine(item))}</p>
        <p class="muted small">${item.defaults.sets}× ${esc(item.defaults.reps)}${item.defaults.startWeightKg != null ? ` · старт ${D.fmtNum(item.defaults.startWeightKg)} кг` : ""}</p>
        ${used.length ? `<p class="small">уже в плане: ${esc(used.join(", "))}</p>` : ""}
      </button>`;
    }).join("");
    return `${topbar(day.title)}
      <p class="muted">База пока из упражнений твоей программы. Нажатие кладёт кубик в день, можно добавить несколько.</p>
      <label>поиск
        <input data-bind="search" value="${esc(state.query)}" placeholder="название">
      </label>
      <div class="chips">
        <button class="chip ${state.muscle === "all" ? "on" : ""}" type="button" data-action="muscle" data-muscle="all">Все</button>
        ${D.MUSCLES.map((muscle) => `<button class="chip ${state.muscle === muscle.id ? "on" : ""}" type="button" data-action="muscle" data-muscle="${muscle.id}">${esc(muscle.title)}</button>`).join("")}
      </div>
      ${rows || `<p class="muted">Ничего не нашлось.</p>`}
      <div class="navpad"></div>
      <div class="nav">
        <button class="primary" type="button" data-action="back">К дню · ${day.blocks.length}</button>
      </div>`;
  }

  function setRow(session, exercise, set) {
    const repsOnly = exercise.log === "reps";
    const past = D.previousFor(db.sessions, exercise.exerciseId, session.id)?.map[set.index];
    const pastLabel = past ? D.formatLoggedSet(past, repsOnly) : "";
    return `<div class="set">
      <button class="check ${set.done ? "on" : ""}" type="button" data-action="toggle-done" data-session="${esc(session.id)}" data-ex="${esc(exercise.uid)}" data-index="${set.index}" aria-label="Подход сделан">✓</button>
      <span class="set-index">${set.index}</span>
      <div class="set-fields">
        <div class="inline">
          ${repsOnly ? "" : `<label>кг
            <input inputmode="decimal" data-bind="set-weight" data-session="${esc(session.id)}" data-ex="${esc(exercise.uid)}" data-index="${set.index}" value="${esc(D.fmtNum(set.weightKg))}">
          </label>`}
          <label>${repsOnly ? "повторы" : "повт"}
            <input inputmode="numeric" data-bind="set-reps" data-session="${esc(session.id)}" data-ex="${esc(exercise.uid)}" data-index="${set.index}" value="${esc(set.reps ?? "")}">
          </label>
        </div>
        <p class="muted small">цель: ${esc(exercise.targetReps)}${pastLabel ? ` · <span class="was">было: ${esc(pastLabel)}</span>` : ""}</p>
      </div>
    </div>`;
  }

  function viewWorkout() {
    const session = sessionById(state.sessionId);
    if (!session) return viewHome();
    if (!session.exercises.length) {
      return `${topbar(session.dayTitle)}<p class="muted">В этом дне нет упражнений.</p>`;
    }
    state.exerciseIndex = Math.max(0, Math.min(state.exerciseIndex, session.exercises.length - 1));
    const exercise = session.exercises[state.exerciseIndex];
    const item = D.byId(exercise.exerciseId);
    const repsOnly = exercise.log === "reps";
    const doneCount = session.exercises.filter((entry) => entry.sets.length && entry.sets.every((set) => set.done)).length;
    const width = Math.round(100 * doneCount / session.exercises.length);
    const warm = D.cardioSummary(session.warmup);
    const past = D.previousFor(db.sessions, exercise.exerciseId, session.id);
    const pastLine = past
      ? Object.keys(past.map).map(Number).sort((a, b) => a - b).map((key) => D.formatLoggedSet(past.map[key], repsOnly)).join(", ")
      : "";
    let pullup = "";
    if (repsOnly) {
      const live = D.repTotal(exercise.sets);
      const samples = D.pullupSamples(db.sessions);
      const last = samples[samples.length - 1];
      const delta = live > 0 && last ? live - last.total : null;
      const points = samples.slice(-7).map((sample) => ({ total: sample.total, label: shortDate(sample.date) }));
      if (live > 0) points.push({ total: live, label: "сейчас", live: true });
      pullup = `<p class="big">${live}</p><p class="muted">повторений сейчас</p>
        ${last ? `<p class="small">прошлый раз ${last.total}${delta == null ? "" : ` · <span class="${delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : ""}">${delta > 0 ? "+" : ""}${delta}</span>`}</p>` : ""}
        ${barsHtml(points)}`;
    }
    const last = state.exerciseIndex >= session.exercises.length - 1;
    return `${topbar(session.dayTitle)}
      ${warm ? `<p class="muted small">Разминка: ${esc(warm)}</p>` : ""}
      <p class="muted small">Упражнение ${state.exerciseIndex + 1} / ${session.exercises.length}</p>
      <div class="progress"><i style="width:${width}%"></i></div>
      ${pullup}
      <h2>${esc(exercise.name)}</h2>
      <p class="accent">${exercise.targetSets}× ${esc(exercise.targetReps)}${exercise.startWeightKg != null ? ` · план ${D.fmtNum(exercise.startWeightKg)} кг` : ""}</p>
      <p class="muted small">${esc(muscleLine(item))}</p>
      ${exercise.note ? `<p class="muted">${esc(exercise.note)}</p>` : ""}
      ${pastLine ? `<p class="was">прошлый раз: ${esc(pastLine)}</p>` : `<p class="muted small">Прошлых весов пока нет — ориентир это стартовый вес плана.</p>`}
      ${item?.caution ? `<p class="caution">${esc(item.caution)}</p>` : ""}
      <div class="subs"><p class="kicker">Если занято</p>
        ${subsHtml(item?.subs, "swap-quick")}
        <button class="textbtn" type="button" data-action="open-replace" data-ex="${esc(exercise.uid)}">Другая замена из базы</button>
      </div>
      ${techniqueBlock(exercise.uid, item)}
      <div class="stack" style="margin-top:14px">
        ${exercise.sets.map((set) => setRow(session, exercise, set)).join("")}
        <div class="pair">
          <button class="secondary" type="button" data-action="add-set" data-ex="${esc(exercise.uid)}">Ещё подход</button>
          <button class="secondary" type="button" data-action="remove-set" data-ex="${esc(exercise.uid)}" ${exercise.sets.length <= 1 ? "disabled" : ""}>Убрать</button>
        </div>
      </div>
      <div class="navpad"></div>
      <div class="nav">
        ${session.exercises.length > 1 ? `<button class="secondary" type="button" data-action="nav" data-dir="-1" ${state.exerciseIndex === 0 ? "disabled" : ""}>Назад</button>` : ""}
        ${session.dayKind !== "pullups" ? `<button class="secondary" type="button" data-action="open-cardio">Кардио</button>` : ""}
        <button class="primary" type="button" data-action="${last ? "open-finish" : "nav"}" ${last ? "" : `data-dir="1"`}>${last ? "Финиш" : "Далее"}</button>
      </div>`;
  }

  function cardioFields(phase, cardio) {
    const meta = D.CARDIO.find((item) => item.id === cardio.kind) || D.CARDIO[0];
    return `<section>
      <h3>${phase === "warmup" ? "Разминка" : "Заминка"}</h3>
      <div class="chips">
        ${D.CARDIO.map((item) => `<button class="chip ${item.id === cardio.kind ? "on" : ""}" type="button" data-action="cardio-kind" data-phase="${phase}" data-kind="${item.id}">${item.title}</button>`).join("")}
      </div>
      ${meta.minutes ? `<label>минуты <input inputmode="numeric" data-bind="cardio-minutes" data-phase="${phase}" value="${esc(cardio.minutes ?? "")}"></label>` : ""}
      ${meta.km ? `<label>км <input inputmode="decimal" data-bind="cardio-km" data-phase="${phase}" value="${esc(D.fmtNum(cardio.km))}"></label>` : ""}
      ${meta.steps ? `<label>шаги <input inputmode="numeric" data-bind="cardio-steps" data-phase="${phase}" value="${esc(cardio.steps ?? "")}"></label>` : ""}
    </section>`;
  }

  function viewFinish() {
    const session = sessionById(state.sessionId);
    if (!session) return viewHome();
    const doneSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0);
    const totalSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const pullup = session.exercises.filter((exercise) => exercise.log === "reps").reduce((sum, exercise) => sum + D.repTotal(exercise.sets), 0);
    return `${topbar("Завершить")}
      <p class="muted">${esc(session.dayTitle)} · подходы ${doneSets} / ${totalSets}${pullup ? ` · подтягивания ${pullup}` : ""}</p>
      ${session.dayKind === "pullups" ? "" : `${cardioFields("warmup", session.warmup)}${cardioFields("cooldown", session.cooldown)}`}
      <p class="muted small">Лёгкое кардио 5–15 минут до или после силовых. При подагре без изматывающего темпа.</p>
      <label>как прошло
        <textarea data-bind="notes" placeholder="Плечо, подагра, самочувствие…">${esc(session.notes || "")}</textarea>
      </label>
      <button class="primary wide" type="button" data-action="save-session">Сохранить в историю</button>`;
  }

  function viewHistory() {
    const rows = db.sessions.map((session) => {
      const done = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0);
      return `<button class="session" type="button" data-action="open-detail" data-session="${esc(session.id)}">
        <div class="card-top"><strong>${esc(session.dayTitle)}</strong><span class="muted small">${session.completed ? "готово" : "не завершена"}</span></div>
        <p class="muted small">${esc(dateTime(session.date))} · ${done} ${countWord(done, "подход", "подхода", "подходов")}</p>
      </button>`;
    }).join("");
    return `${topbar("История")}
      <div class="stack">${rows || `<p class="muted">Пока пусто. После тренировки запись появится здесь.</p>`}</div>`;
  }

  function viewDetail() {
    const session = sessionById(state.detailId);
    if (!session) return viewHistory();
    const blocks = session.exercises.map((exercise) => {
      const lines = exercise.sets.map((set) => `<p class="small ${set.done ? "" : "muted"}">${set.index}. ${esc(D.formatLoggedSet(set, exercise.log === "reps"))}${set.done ? "" : " · не отмечен"}</p>`).join("");
      return `<article class="card"><strong>${esc(exercise.name)}</strong><p class="muted small">${exercise.targetSets}× ${esc(exercise.targetReps)}</p>${lines}</article>`;
    }).join("");
    return `${topbar(session.dayTitle)}
      <p class="muted">${esc(dateTime(session.date))}${session.completed ? "" : " · не завершена"}</p>
      ${D.cardioSummary(session.warmup) ? `<p class="small">Разминка: ${esc(D.cardioSummary(session.warmup))}</p>` : ""}
      ${D.cardioSummary(session.cooldown) ? `<p class="small">Заминка: ${esc(D.cardioSummary(session.cooldown))}</p>` : ""}
      ${session.notes ? `<p>${esc(session.notes)}</p>` : ""}
      <div class="stack" style="margin-top:12px">${blocks}</div>
      <div class="stack" style="margin-top:14px">
        ${session.completed ? "" : `<button class="primary wide" type="button" data-action="resume-detail">Продолжить</button>`}
        <button class="danger" type="button" data-action="delete-session">Удалить тренировку</button>
      </div>`;
  }

  function viewCatalog() {
    const groups = D.MUSCLES.map((muscle) => {
      const items = D.CATALOG.filter((item) => item.muscles[0] === muscle.id);
      if (!items.length) return "";
      return `<p class="section-label">${esc(muscle.title)}</p>
        <div class="stack">${items.map((item) => `<button class="session" type="button" data-action="open-exercise" data-id="${esc(item.id)}">
          <strong>${esc(item.name)}</strong>
          <p class="muted small">${esc(D.EQUIPMENT[item.equipment])} · ${esc(item.muscles.map(D.muscleTitle).join(" · "))}</p>
        </button>`).join("")}</div>`;
    }).join("");
    return `${topbar("База")}
      <p class="muted">Сейчас здесь только упражнения из твоей программы. Группа мышц, техника и замена, если гантели или тренажёр заняты. Новые движения добавим следующим шагом.</p>
      ${groups}`;
  }

  function viewExercise() {
    const item = D.byId(state.catalogId);
    if (!item) return viewCatalog();
    const logs = [];
    for (const session of db.sessions) {
      if (!session.completed) continue;
      const exercise = session.exercises.find((entry) => entry.exerciseId === item.id);
      if (!exercise) continue;
      const done = exercise.sets.filter((set) => set.done);
      if (!done.length) continue;
      logs.push(`<p class="small"><span class="muted">${esc(shortDate(session.date))} · ${esc(session.dayTitle)}</span><br>${esc(done.map((set) => D.formatLoggedSet(set, item.log === "reps")).join(", "))}</p>`);
      if (logs.length >= 6) break;
    }
    const days = db.plan.days.filter((day) => day.blocks.some((block) => block.exerciseId === item.id));
    return `${topbar("Упражнение")}
      <h2>${esc(item.name)}</h2>
      <p class="muted">${esc(muscleLine(item))}</p>
      ${item.caution ? `<p class="caution">${esc(item.caution)}</p>` : ""}
      <p class="kicker">В плане</p>
      <p>${days.length ? esc(days.map((day) => day.title).join(", ")) : "пока ни в одном дне"}</p>
      ${techniqueBlock(item.id, item)}
      <div class="subs"><p class="kicker">Если занято</p>${subsHtml(item.subs, "noop")}</div>
      <p class="kicker">Последние записи</p>
      ${logs.join("") || `<p class="muted">В истории этого упражнения ещё нет.</p>`}
      <p class="kicker">Добавить кубиком в день</p>
      <div class="stack">${db.plan.days.map((day) => `<button class="secondary wide" type="button" data-action="add-to-day" data-day="${esc(day.id)}" data-id="${esc(item.id)}">${esc(day.title)}</button>`).join("")}</div>`;
  }

  function exportPayload() {
    return JSON.stringify({
      plan: db.plan,
      sessions: db.sessions,
      deletedSessionIds: db.deletedSessionIds,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  function viewData() {
    return `${topbar("Данные")}
      <p class="muted" data-sync>${esc(syncText())}</p>
      <p class="muted">Кнопка ниже выгружает копию JSON. Ею можно перенести базу, если Telegram на телефоне недоступен.</p>
      <div class="stack" style="margin-top:14px">
        <button class="secondary wide" type="button" data-action="download">Скачать JSON</button>
        <button class="secondary wide" type="button" data-action="copy-json">Скопировать JSON</button>
        <label class="secondary wide file">Загрузить файл
          <input id="import-file" type="file" accept="application/json,.json">
        </label>
        <label>или вставь JSON
          <textarea data-bind="import-text" placeholder="gymlog json">${esc(state.importText)}</textarea>
        </label>
        <button class="primary wide" type="button" data-action="import-paste">Загрузить вставленное</button>
      </div>`;
  }

  function view() {
    switch (state.view) {
      case "plan": return viewPlan();
      case "day": return viewDay();
      case "pick": return viewPick();
      case "workout": return viewWorkout();
      case "finish": return viewFinish();
      case "history": return viewHistory();
      case "detail": return viewDetail();
      case "catalog": return viewCatalog();
      case "exercise": return viewExercise();
      case "data": return viewData();
      default: return viewHome();
    }
  }

  function modalHtml() {
    if (state.modal === "cardio") {
      const session = sessionById(state.sessionId);
      if (!session) return "";
      return `<div class="overlay">
        <div class="sheet">
          <div class="spread"><h3>Кардио</h3><button class="textbtn" type="button" data-action="close-modal">Закрыть</button></div>
          ${cardioFields("warmup", session.warmup)}
          ${cardioFields("cooldown", session.cooldown)}
        </div>
      </div>`;
    }
    if (state.modal === "replace") {
      const session = sessionById(state.sessionId);
      const exercise = session?.exercises.find((entry) => entry.uid === state.replaceUid);
      const item = exercise ? D.byId(exercise.exerciseId) : null;
      if (!exercise || !item) return "";
      const subIds = new Set((item.subs || []).map((sub) => sub.id));
      const related = D.CATALOG.filter((entry) => entry.id !== item.id && !subIds.has(entry.id) && entry.muscles.some((muscle) => item.muscles.includes(muscle)));
      const row = (entry, reason) => `<div class="card">
        <strong>${esc(entry.name)}</strong>
        <p class="muted small">${esc(reason || muscleLine(entry))}</p>
        <div class="pair" style="margin-top:8px">
          <button class="secondary" type="button" data-action="swap-session" data-id="${esc(entry.id)}">Только сегодня</button>
          <button class="primary" type="button" data-action="swap-session" data-id="${esc(entry.id)}" data-plan="1">И в плане</button>
        </div>
      </div>`;
      const suggested = (item.subs || []).map((sub) => row(D.byId(sub.id), sub.reason)).join("");
      const sameMuscle = related.map((entry) => row(entry)).join("");
      return `<div class="overlay">
        <div class="sheet">
          <div class="spread"><h3>Заменить</h3><button class="textbtn" type="button" data-action="close-modal">Закрыть</button></div>
          <p class="muted">${esc(item.name)}. Вес в неотмеченных подходах подставится из истории замены или из её старта.</p>
          <div class="stack" style="margin-top:12px">
            ${suggested || `<p class="muted">Прямой замены в базе нет.</p>`}
            ${sameMuscle ? `<p class="kicker">Та же группа мышц</p>${sameMuscle}` : ""}
          </div>
        </div>
      </div>`;
    }
    return "";
  }

  function toastHtml() {
    if (!state.toast) return "";
    const lifted = state.view === "workout" || state.view === "day" || state.view === "pick";
    return `<div class="toast${lifted ? " up" : ""}">
      <span>${esc(state.toast)}</span>
      ${state.undo ? `<button class="textbtn" type="button" data-action="undo">Отменить</button>` : ""}
    </div>`;
  }

  function render(options = {}) {
    const y = options.keepScroll ? window.scrollY : 0;
    document.getElementById("app").innerHTML = view() + modalHtml() + toastHtml();
    if (options.keepScroll) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
    if (options.focus) {
      const input = document.querySelector(`[data-bind="${options.focus}"]`);
      if (input) {
        input.focus();
        const pos = options.pos ?? input.value.length;
        input.setSelectionRange?.(pos, pos);
      }
    }
    syncTelegram();
    persistUi();
  }

  function persistUi() {
    sessionStorage.setItem(UIKEY, JSON.stringify({
      view: state.view,
      dayId: state.dayId,
      sessionId: state.sessionId,
      exerciseIndex: state.exerciseIndex,
      detailId: state.detailId,
      catalogId: state.catalogId,
      returnTo: state.returnTo,
    }));
  }

  function syncTelegram() {
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;
    if (state.view === "home" && !state.modal) tg.BackButton.hide();
    else tg.BackButton.show();
  }

  function go(view) {
    state.modal = null;
    state.view = view;
    render();
  }

  function back() {
    if (state.modal) {
      state.modal = null;
      render({ keepScroll: true });
      return;
    }
    if (state.view === "exercise" && state.returnTo) {
      state.view = state.returnTo;
      state.returnTo = null;
      render();
      return;
    }
    const parent = {
      plan: "home",
      day: "plan",
      pick: "day",
      workout: "home",
      finish: "workout",
      history: "home",
      detail: "history",
      catalog: "home",
      exercise: "catalog",
      data: "home",
    };
    state.view = parent[state.view] || "home";
    render();
  }

  function openWorkout(session) {
    state.sessionId = session.id;
    const index = session.exercises.findIndex((exercise) => exercise.sets.some((set) => !set.done));
    state.exerciseIndex = index < 0 ? 0 : index;
    state.view = "workout";
    state.modal = null;
    render();
  }

  function startDay(dayId) {
    const day = dayById(dayId);
    if (!day) return;
    if (!day.blocks.length) {
      showToast("Сначала добавь упражнения в этот день", null, true);
      return;
    }
    const session = D.createSession(day, db.sessions);
    db.sessions.unshift(session);
    save();
    openWorkout(session);
  }

  function findBlock(dayId, blockUid) {
    const day = dayById(dayId);
    const block = day?.blocks.find((item) => item.uid === blockUid) || null;
    return { day, block };
  }

  function swapBlock(day, block, newId) {
    const item = D.byId(newId);
    if (!item || !block) return;
    const snapshot = {
      exerciseId: block.exerciseId,
      note: block.note,
      startWeightKg: block.startWeightKg,
    };
    block.exerciseId = newId;
    block.note = item.defaults.note || "";
    block.startWeightKg = item.defaults.startWeightKg;
    save();
    showToast(`Кубик заменён на «${item.name}». Подходы и повторения те же, стартовый вес из базы.`, () => {
      Object.assign(block, snapshot);
      save();
    }, true);
  }

  function swapSession(newId, alsoPlan) {
    const session = sessionById(state.sessionId);
    const exercise = session?.exercises.find((entry) => entry.uid === state.replaceUid);
    const item = D.byId(newId);
    if (!session || !exercise || !item) return;
    const past = D.previousFor(db.sessions, newId, session.id);
    const snapshot = JSON.parse(JSON.stringify(exercise));
    const day = dayById(session.dayId);
    const block = alsoPlan && exercise.blockUid ? day?.blocks.find((entry) => entry.uid === exercise.blockUid) : null;
    const blockSnap = block ? {
      exerciseId: block.exerciseId,
      note: block.note,
      startWeightKg: block.startWeightKg,
      reps: block.reps,
    } : null;
    exercise.exerciseId = newId;
    exercise.name = item.name;
    exercise.log = item.log;
    exercise.note = item.defaults.note || "";
    exercise.targetReps = item.defaults.reps;
    exercise.startWeightKg = item.defaults.startWeightKg;
    exercise.sets.forEach((set) => {
      if (set.done) return;
      const logged = past?.map[set.index];
      set.weightKg = logged ? (logged.weightKg ?? null) : (item.defaults.startWeightKg ?? null);
      set.reps = logged ? (logged.reps ?? null) : null;
    });
    if (block) {
      block.exerciseId = newId;
      block.note = item.defaults.note || "";
      block.startWeightKg = item.defaults.startWeightKg;
      block.reps = item.defaults.reps;
    }
    state.modal = null;
    save();
    showToast(alsoPlan ? `«${item.name}» в тренировке и в плане` : `Сегодня вместо этого — «${item.name}»`, () => {
      Object.assign(exercise, snapshot);
      if (block && blockSnap) Object.assign(block, blockSnap);
      save();
    }, true);
  }

  function applyCardioKind(phase, kind) {
    const session = sessionById(state.sessionId);
    if (!session) return;
    const cardio = session[phase];
    const meta = D.CARDIO.find((item) => item.id === kind);
    cardio.kind = kind;
    if (kind === "none") {
      cardio.minutes = null;
      cardio.km = null;
      cardio.steps = null;
    }
    if (!meta?.km) cardio.km = null;
    if (!meta?.steps) cardio.steps = null;
    save();
    render({ keepScroll: true });
  }

  function applyImport() {
    let parsed;
    try {
      parsed = JSON.parse(state.importText);
    } catch (error) {
      showToast("Это не JSON");
      return;
    }
    if (!parsed || typeof parsed !== "object" || (!parsed.plan && !parsed.sessions)) {
      showToast("В тексте нет плана или тренировок");
      return;
    }
    if (!window.confirm("Загрузить базу? План заменится. Тренировки с тем же id обновятся, остальные останутся.")) return;
    if (parsed.plan?.days) db.plan = parsed.plan;
    if (Array.isArray(parsed.sessions)) {
      const map = new Map(db.sessions.map((session) => [session.id, session]));
      parsed.sessions.forEach((session) => {
        if (session?.id) map.set(session.id, session);
      });
      db.sessions = [...map.values()];
    }
    if (Array.isArray(parsed.deletedSessionIds)) {
      db.deletedSessionIds = [...new Set([...(db.deletedSessionIds || []), ...parsed.deletedSessionIds])];
      db.sessions = db.sessions.filter((session) => !db.deletedSessionIds.includes(session.id));
    }
    save();
    state.view = "home";
    showToast("База загружена");
  }

  function downloadExport() {
    const blob = new Blob([exportPayload()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gymlog-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function onClick(event) {
    if (event.target.classList?.contains("overlay")) {
      state.modal = null;
      render({ keepScroll: true });
      return;
    }
    const el = event.target.closest("[data-action], [data-go]");
    if (!el || el.disabled) return;
    if (el.dataset.go) {
      go(el.dataset.go);
      return;
    }
    const action = el.dataset.action;
    if (action === "back") back();
    else if (action === "close-modal") {
      state.modal = null;
      render({ keepScroll: true });
    } else if (action === "undo") {
      const undo = state.undo;
      toastId += 1;
      state.toast = "";
      state.undo = null;
      if (undo) undo();
      render({ keepScroll: true });
    } else if (action === "start") startDay(el.dataset.day);
    else if (action === "resume") {
      const session = activeSession();
      if (session) openWorkout(session);
    } else if (action === "discard") {
      const session = activeSession();
      if (session && window.confirm("Удалить незавершённую тренировку?")) {
        forgetSession(session.id);
        render();
      }
    } else if (action === "open-day") {
      state.dayId = el.dataset.day;
      go("day");
    } else if (action === "delete-day") {
      if (!window.confirm("Удалить этот день из плана? История тренировок останется.")) return;
      db.plan.days = db.plan.days.filter((day) => day.id !== el.dataset.day);
      save();
      render({ keepScroll: true });
    } else if (action === "add-day") {
      const day = D.newDay();
      db.plan.days.push(day);
      save();
      state.dayId = day.id;
      go("day");
    } else if (action === "reset-plan") {
      if (window.confirm("Вернуть Push / Pull / Legs как в текущей программе? История тренировок останется.")) {
        db.plan = D.defaultPlan();
        save();
        showToast("План снова исходный", null, true);
      }
    } else if (action === "move-day" || action === "move-block") {
      const dir = Number(el.dataset.dir);
      const list = action === "move-day"
        ? db.plan.days
        : dayById(el.dataset.day)?.blocks;
      if (!list) return;
      const from = action === "move-day"
        ? list.findIndex((item) => item.id === el.dataset.day)
        : list.findIndex((item) => item.uid === el.dataset.block);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= list.length) return;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      save();
      render({ keepScroll: true });
    } else if (action === "plan-sets") {
      const { block } = findBlock(el.dataset.day, el.dataset.block);
      if (!block) return;
      block.sets = Math.min(12, Math.max(1, block.sets + Number(el.dataset.delta)));
      save();
      render({ keepScroll: true });
    } else if (action === "remove-block") {
      const { day } = findBlock(el.dataset.day, el.dataset.block);
      if (!day) return;
      if (!window.confirm("Убрать упражнение из дня?")) return;
      day.blocks = day.blocks.filter((block) => block.uid !== el.dataset.block);
      save();
      render({ keepScroll: true });
    } else if (action === "weekday") {
      const day = dayById(el.dataset.day);
      if (!day) return;
      const weekday = Number(el.dataset.wd);
      const selected = new Set(day.weekdays || []);
      if (selected.has(weekday)) selected.delete(weekday);
      else selected.add(weekday);
      day.weekdays = D.WEEKDAYS.map((item) => item.id).filter((id) => selected.has(id));
      save();
      render({ keepScroll: true });
    } else if (action === "day-kind") {
      const day = dayById(el.dataset.day);
      if (!day) return;
      day.kind = el.dataset.kind;
      save();
      render({ keepScroll: true });
    } else if (action === "open-pick") {
      state.dayId = el.dataset.day;
      state.query = "";
      state.muscle = "all";
      go("pick");
    } else if (action === "muscle") {
      state.muscle = el.dataset.muscle;
      render({ keepScroll: true, focus: state.query ? "search" : "" });
    } else if (action === "add-exercise") {
      const day = dayById(state.dayId);
      const item = D.byId(el.dataset.id);
      if (!day || !item) return;
      day.blocks.push(D.blockFromExercise(item.id));
      save();
      showToast(`Добавлено: ${item.name}`, null, true);
    } else if (action === "swap-block") {
      const { day, block } = findBlock(el.dataset.day, el.dataset.block);
      swapBlock(day, block, el.dataset.id);
    } else if (action === "toggle-done") {
      const session = sessionById(el.dataset.session);
      const exercise = session?.exercises.find((entry) => entry.uid === el.dataset.ex);
      const set = exercise?.sets.find((entry) => entry.index === Number(el.dataset.index));
      if (!set) return;
      set.done = !set.done;
      save();
      render({ keepScroll: true });
    } else if (action === "add-set" || action === "remove-set") {
      const session = sessionById(state.sessionId);
      const exercise = session?.exercises.find((entry) => entry.uid === el.dataset.ex);
      if (!exercise) return;
      if (action === "add-set") {
        const last = exercise.sets[exercise.sets.length - 1];
        exercise.sets.push({
          index: (last?.index || 0) + 1,
          weightKg: last?.weightKg ?? exercise.startWeightKg ?? null,
          reps: null,
          done: false,
        });
      } else if (exercise.sets.length > 1) {
        exercise.sets.pop();
      }
      exercise.targetSets = exercise.sets.length;
      save();
      render({ keepScroll: true });
    } else if (action === "nav") {
      state.exerciseIndex += Number(el.dataset.dir);
      render();
    } else if (action === "open-finish") go("finish");
    else if (action === "open-cardio") {
      state.modal = "cardio";
      render({ keepScroll: true });
    } else if (action === "cardio-kind") applyCardioKind(el.dataset.phase, el.dataset.kind);
    else if (action === "open-replace") {
      state.replaceUid = el.dataset.ex || el.dataset.id;
      state.modal = "replace";
      render({ keepScroll: true });
    } else if (action === "swap-quick") {
      const session = sessionById(state.sessionId);
      const exercise = session?.exercises[state.exerciseIndex];
      if (!exercise) return;
      state.replaceUid = exercise.uid;
      swapSession(el.dataset.id, false);
    } else if (action === "swap-session") swapSession(el.dataset.id, el.dataset.plan === "1");
    else if (action === "save-session") {
      const session = sessionById(state.sessionId);
      if (!session) return;
      session.completed = true;
      session.date = session.date || new Date().toISOString();
      save();
      state.view = "history";
      showToast("Тренировка в истории");
    } else if (action === "open-detail") {
      state.detailId = el.dataset.session;
      go("detail");
    } else if (action === "resume-detail") {
      const session = sessionById(state.detailId);
      if (session) openWorkout(session);
    } else if (action === "delete-session") {
      if (!window.confirm("Удалить эту тренировку из истории?")) return;
      forgetSession(state.detailId);
      go("history");
    } else if (action === "open-exercise") {
      state.catalogId = el.dataset.id;
      state.returnTo = state.view === "catalog" ? null : state.view;
      go("exercise");
    } else if (action === "add-to-day") {
      const day = dayById(el.dataset.day);
      const item = D.byId(el.dataset.id);
      if (!day || !item) return;
      day.blocks.push(D.blockFromExercise(item.id));
      save();
      state.dayId = day.id;
      state.view = "day";
      showToast(`«${item.name}» добавлено в ${day.title}`);
    } else if (action === "download") downloadExport();
    else if (action === "copy-json") {
      const text = exportPayload();
      navigator.clipboard?.writeText(text).then(() => {
        showToast("JSON скопирован", null, true);
      }).catch(() => {
        state.importText = text;
        showToast("Не удалось скопировать само — текст лежит в поле ниже", null, true);
      });
    } else if (action === "import-paste") applyImport();
    else if (action === "noop") return;
  }

  function bindField(el) {
    const bind = el.dataset.bind;
    if (!bind) return;
    if (bind === "search") {
      state.query = el.value;
      const pos = el.selectionStart;
      render({ keepScroll: true, focus: "search", pos });
      return;
    }
    if (bind === "import-text") {
      state.importText = el.value;
      return;
    }
    if (bind === "day-title" || bind === "day-subtitle") {
      const day = dayById(el.dataset.day);
      if (!day) return;
      day[bind === "day-title" ? "title" : "subtitle"] = el.value;
      save();
      return;
    }
    if (bind === "block-reps" || bind === "block-note" || bind === "block-weight") {
      const { block } = findBlock(el.dataset.day, el.dataset.block);
      if (!block) return;
      if (bind === "block-reps") block.reps = el.value;
      if (bind === "block-note") block.note = el.value;
      if (bind === "block-weight") block.startWeightKg = parseNum(el.value);
      save();
      return;
    }
    if (bind === "set-weight" || bind === "set-reps") {
      const session = sessionById(el.dataset.session);
      const exercise = session?.exercises.find((entry) => entry.uid === el.dataset.ex);
      const set = exercise?.sets.find((entry) => entry.index === Number(el.dataset.index));
      if (!set) return;
      if (bind === "set-weight") set.weightKg = parseNum(el.value);
      if (bind === "set-reps") set.reps = parseNum(el.value);
      save();
      return;
    }
    if (bind === "notes") {
      const session = sessionById(state.sessionId);
      if (!session) return;
      session.notes = el.value;
      save();
      return;
    }
    if (bind === "cardio-minutes" || bind === "cardio-km" || bind === "cardio-steps") {
      const session = sessionById(state.sessionId);
      const cardio = session?.[el.dataset.phase];
      if (!cardio) return;
      const key = bind === "cardio-minutes" ? "minutes" : bind === "cardio-km" ? "km" : "steps";
      cardio[key] = parseNum(el.value);
      save();
    }
  }

  function restoreUi() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(UIKEY) || "null");
      if (!saved?.view) return;
      Object.assign(state, {
        view: saved.view,
        dayId: saved.dayId,
        sessionId: saved.sessionId,
        exerciseIndex: saved.exerciseIndex || 0,
        detailId: saved.detailId,
        catalogId: saved.catalogId,
        returnTo: saved.returnTo || null,
      });
      if ((state.view === "workout" || state.view === "finish") && !sessionById(state.sessionId)) state.view = "home";
      if ((state.view === "day" || state.view === "pick") && !dayById(state.dayId)) state.view = "plan";
      if (state.view === "detail" && !sessionById(state.detailId)) state.view = "history";
      if (state.view === "exercise" && !D.byId(state.catalogId)) state.view = "catalog";
    } catch (error) {
      state.view = "home";
    }
  }

  function syncText() {
    if (state.accountSync === "ok") return "План и история привязаны к аккаунту Telegram и подтягиваются на других телефонах.";
    if (state.accountSync === "syncing") return "Синхронизация с аккаунтом Telegram…";
    if (state.accountSync === "error") return "Не удалось связаться с аккаунтом Telegram. Пока данные только на этом телефоне.";
    return "Чтобы план и история были на всех телефонах, открой GymLog внутри Telegram.";
  }

  function cloudOn() {
    const telegram = window.Telegram?.WebApp;
    return !!(telegram?.initData && telegram.CloudStorage);
  }

  function cloudCall(method, ...args) {
    return new Promise((resolve, reject) => {
      const storage = window.Telegram?.WebApp?.CloudStorage;
      if (!storage?.[method]) {
        reject(new Error("no-cloud"));
        return;
      }
      storage[method](...args, (error, result) => {
        if (error) reject(new Error(String(error)));
        else resolve(result);
      });
    });
  }

  function sessionCloudKey(id, index) {
    const safe = String(id).replace(/[^A-Za-z0-9]/g, "").slice(0, 80);
    return index ? `gymlog_s_${safe}_${index}` : `gymlog_s_${safe}`;
  }

  async function writeCloudText(baseKey, text, indexedKey) {
    const pieces = [];
    const source = String(text);
    for (let i = 0; i < source.length; i += 3900) pieces.push(source.slice(i, i + 3900));
    if (!pieces.length) pieces.push("");
    for (let index = 0; index < pieces.length; index += 1) {
      const key = indexedKey ? indexedKey(index) : (index ? `${baseKey}_${index}` : baseKey);
      await cloudCall("setItem", key, pieces[index]);
    }
    for (let index = pieces.length; index < 6; index += 1) {
      const key = indexedKey ? indexedKey(index) : (index ? `${baseKey}_${index}` : baseKey);
      try {
        await cloudCall("removeItem", key);
      } catch (error) {
        /* the extra chunk was already absent */
      }
    }
  }

  function readGroupedCloud(keys, values) {
    const planParts = [];
    const deletedParts = [];
    const sessionParts = new Map();
    keys.forEach((key) => {
      const text = values?.[key];
      if (text == null || text === "") return;
      if (key === "gymlog_plan" || key.startsWith("gymlog_plan_")) {
        const index = key === "gymlog_plan" ? 0 : Number(key.slice("gymlog_plan_".length));
        planParts.push({ index, text });
        return;
      }
      if (key === "gymlog_deleted" || key.startsWith("gymlog_deleted_")) {
        const index = key === "gymlog_deleted" ? 0 : Number(key.slice("gymlog_deleted_".length));
        deletedParts.push({ index, text });
        return;
      }
      if (!key.startsWith("gymlog_s_")) return;
      const rest = key.slice("gymlog_s_".length);
      const split = rest.match(/^(.*)_(\d+)$/);
      const id = split ? split[1] : rest;
      const index = split ? Number(split[2]) : 0;
      if (!sessionParts.has(id)) sessionParts.set(id, []);
      sessionParts.get(id).push({ index, text });
    });
    const join = (parts) => parts.slice().sort((a, b) => a.index - b.index).map((part) => part.text).join("");
    let plan = null;
    let deletedSessionIds = [];
    const sessions = [];
    try {
      const planText = join(planParts);
      if (planText) plan = JSON.parse(planText);
    } catch (error) {
      plan = null;
    }
    try {
      const deletedText = join(deletedParts);
      if (deletedText) deletedSessionIds = JSON.parse(deletedText);
    } catch (error) {
      deletedSessionIds = [];
    }
    sessionParts.forEach((parts) => {
      try {
        sessions.push(JSON.parse(join(parts)));
      } catch (error) {
        /* skip a broken workout */
      }
    });
    return { plan, sessions, deletedSessionIds: Array.isArray(deletedSessionIds) ? deletedSessionIds : [] };
  }

  async function pullCloud() {
    const raw = await cloudCall("getKeys");
    const keys = Array.isArray(raw) ? raw : (raw?.keys || []);
    const ours = keys.filter((key) => String(key).startsWith("gymlog_"));
    const values = {};
    for (let index = 0; index < ours.length; index += 40) {
      const chunk = ours.slice(index, index + 40);
      const part = await cloudCall("getItems", chunk);
      const map = part?.values && typeof part.values === "object" ? part.values : part;
      if (Array.isArray(map)) {
        chunk.forEach((key, itemIndex) => {
          values[key] = map[itemIndex];
        });
      } else if (map && typeof map === "object") {
        Object.assign(values, map);
      }
    }
    return readGroupedCloud(ours, values);
  }

  async function pushAccount(remote) {
    const remoteSessions = new Map((remote?.sessions || []).map((session) => [session.id, session]));
    if (db.plan.updatedAt && String(db.plan.updatedAt) >= String(remote?.plan?.updatedAt || "")) {
      await writeCloudText("gymlog_plan", JSON.stringify(db.plan));
    }
    for (const session of db.sessions) {
      const previous = remoteSessions.get(session.id);
      if (previous && String(previous.updatedAt || "") >= String(session.updatedAt || "")) continue;
      await writeCloudText("", JSON.stringify(session), (index) => sessionCloudKey(session.id, index));
    }
    for (const id of db.deletedSessionIds) {
      for (let index = 0; index < 6; index += 1) {
        try {
          await cloudCall("removeItem", sessionCloudKey(id, index));
        } catch (error) {
          /* already removed */
        }
      }
    }
    await writeCloudText("gymlog_deleted", JSON.stringify(db.deletedSessionIds));
  }

  function paintSync() {
    document.querySelectorAll("[data-sync]").forEach((node) => {
      node.textContent = syncText();
    });
  }

  function applyMerged(merged) {
    const before = JSON.stringify(db);
    db.plan = merged.plan;
    db.sessions = merged.sessions;
    db.deletedSessionIds = merged.deletedSessionIds;
    db.sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const changed = JSON.stringify(db) !== before;
    if (changed) {
      rememberFingers();
      writeLocal();
    }
    return changed;
  }

  async function syncAccount() {
    if (!cloudOn()) {
      state.accountSync = "local";
      paintSync();
      return;
    }
    if (syncing) {
      syncAgain = true;
      return;
    }
    syncing = true;
    state.accountSync = "syncing";
    paintSync();
    try {
      const remote = await pullCloud();
      const changed = applyMerged(D.mergeAccount(db, remote));
      await pushAccount(remote);
      state.accountSync = "ok";
      if (changed) render({ keepScroll: true });
      else paintSync();
    } catch (error) {
      state.accountSync = "error";
      paintSync();
    } finally {
      syncing = false;
      if (syncAgain) {
        syncAgain = false;
        syncAccount();
      }
    }
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncAccount();
    }, 700);
  }

  let syncTimer = 0;

  function initTelegram() {
    const tg = window.Telegram?.WebApp;
    if (!tg || tg.__gymlog) return;
    tg.__gymlog = true;
    tg.ready();
    tg.expand?.();
    try {
      tg.setHeaderColor("#121314");
      tg.setBackgroundColor("#121314");
      tg.disableVerticalSwipes?.();
    } catch (error) {
      /* older Telegram clients */
    }
    tg.BackButton?.onClick(() => back());
  }

  document.addEventListener("click", onClick);
  document.addEventListener("input", (event) => {
    const el = event.target.closest("[data-bind]");
    if (el) bindField(el);
  });
  document.addEventListener("change", (event) => {
    const input = event.target.closest("#import-file");
    if (!input?.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.importText = String(reader.result || "");
      applyImport();
    };
    reader.readAsText(input.files[0]);
    input.value = "";
  });
  document.addEventListener("toggle", (event) => {
    const details = event.target.closest?.("details[data-tech]");
    if (!details) return;
    state.openTech[details.dataset.tech] = details.open;
  }, true);

  initTelegram();
  const stamped = D.accountStamp(db);
  if (stamped.planUpdatedAt && stamped.planUpdatedAt !== db.plan.updatedAt) db.plan.updatedAt = stamped.planUpdatedAt;
  stamped.sessions.forEach((session, index) => {
    db.sessions[index].updatedAt = session.updatedAt;
  });
  rememberFingers();
  writeLocal();
  state.accountSync = cloudOn() ? "syncing" : "local";
  restoreUi();
  render();
  syncAccount();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncAccount();
  });
})();

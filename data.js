(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GymData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MUSCLES = [
    { id: "chest", title: "Грудь" },
    { id: "front-delt", title: "Передняя дельта" },
    { id: "side-delt", title: "Средняя дельта" },
    { id: "rear-delt", title: "Задняя дельта" },
    { id: "triceps", title: "Трицепс" },
    { id: "back", title: "Спина" },
    { id: "biceps", title: "Бицепс" },
    { id: "quads", title: "Квадрицепс" },
    { id: "hams", title: "Бицепс бедра" },
    { id: "glutes", title: "Ягодицы" },
    { id: "calves", title: "Икры" },
    { id: "core", title: "Кор" },
  ];

  const EQUIPMENT = {
    barbell: "Штанга",
    dumbbell: "Гантели",
    cable: "Блок",
    machine: "Тренажёр",
    bodyweight: "Вес тела",
  };

  const CARDIO = [
    { id: "none", title: "Нет" },
    { id: "run", title: "Бег", minutes: true, km: true },
    { id: "walk", title: "Ходьба", minutes: true, km: true, steps: true },
    { id: "steps", title: "Шаги", minutes: true, steps: true },
    { id: "bike", title: "Вело", minutes: true, km: true },
    { id: "other", title: "Другое", minutes: true, km: true },
  ];

  const WEEKDAYS = [
    { id: 1, title: "Пн" },
    { id: 2, title: "Вт" },
    { id: 3, title: "Ср" },
    { id: 4, title: "Чт" },
    { id: 5, title: "Пт" },
    { id: 6, title: "Сб" },
    { id: 0, title: "Вс" },
  ];

  function ex(spec) {
    return {
      log: "strength",
      caution: "",
      technique: [],
      subs: [],
      muscles: [],
      defaults: { sets: 3, reps: "10", startWeightKg: null, note: "" },
      ...spec,
    };
  }

  const CATALOG = [
    ex({
      id: "bench-barbell",
      name: "Жим штанги лёжа",
      equipment: "barbell",
      muscles: ["chest", "front-delt", "triceps"],
      defaults: { sets: 4, reps: "6–8", startWeightKg: 70, note: "Разминка: гриф×10, 40×5, 60×3" },
      caution: "Если левое плечо ноет — снижай вес, не терпи.",
      technique: [
        "Лопатки сведи, стопы на полу, таз не отрывай.",
        "Опускай гриф к нижней части груди примерно за 2 секунды.",
        "Локти около 45–60° от корпуса, не разводи их в одну линию с грифом.",
        "Последний подход — до отказа, без помощи.",
      ],
      subs: [
        { id: "incline-db", reason: "если стойка со штангой занята" },
        { id: "dips", reason: "если нет свободной штанги" },
        { id: "cable-fly", reason: "блок вместо жима, легче для плеча" },
      ],
    }),
    ex({
      id: "incline-db",
      name: "Жим гантелей на наклонной 30–45°",
      equipment: "dumbbell",
      muscles: ["chest", "front-delt", "triceps"],
      defaults: { sets: 3, reps: "10–12", startWeightKg: 20, note: "Верх груди" },
      technique: [
        "Скамья 30–45°.",
        "Гантели над верхней частью груди, вверху не стукай их друг о друга.",
        "Опускай до линии груди, локти под контролем.",
        "Медленный эксцентрик 2–3 секунды.",
      ],
      subs: [
        { id: "bench-barbell", reason: "если гантели заняты, а штанга свободна" },
        { id: "cable-fly", reason: "если и гантели, и скамья заняты" },
        { id: "dips", reason: "вес тела, акцент на грудь и трицепс" },
      ],
    }),
    ex({
      id: "seated-db-press",
      name: "Жим гантелей сидя (плечи)",
      equipment: "dumbbell",
      muscles: ["front-delt", "side-delt", "triceps"],
      defaults: { sets: 3, reps: "10–12", startWeightKg: 15, note: "Гантели — безопаснее для левого плеча" },
      caution: "Жим плеч только гантелями, не штангой из-за вывиха левого плеча.",
      technique: [
        "Спинка почти вертикальная, поясницу не прогибай.",
        "Гантели от уровня ушей вверх.",
        "Не заменяй это жимом штанги стоя или сидя.",
        "При дискомфорте в плече — меньше вес или разведения.",
      ],
      subs: [
        { id: "lateral-raise", reason: "если тяжёлые гантели заняты: это уже изоляция, вес меньше" },
        { id: "cable-lateral", reason: "блок вместо гантелей, тоже изоляция" },
      ],
    }),
    ex({
      id: "lateral-raise",
      name: "Разведения гантелей стоя",
      equipment: "dumbbell",
      muscles: ["side-delt"],
      defaults: { sets: 3, reps: "15", startWeightKg: 9, note: "Суперсет с кроссовером" },
      technique: [
        "Чуть согни локти и держи угол постоянным.",
        "Поднимай до уровня плеч, мизинец чуть выше большого пальца.",
        "Корпус не раскачивай.",
        "Суперсет со сведениями в кроссовере: отдых после пары.",
      ],
      subs: [
        { id: "cable-lateral", reason: "если гантели заняты" },
      ],
    }),
    ex({
      id: "cable-fly",
      name: "Сведения в кроссовере",
      equipment: "cable",
      muscles: ["chest"],
      defaults: { sets: 3, reps: "12–15", startWeightKg: 50, note: "Суперсет с разведениями" },
      technique: [
        "Корпус чуть вперёд, руки идут по дуге.",
        "Своди кисти перед собой и коротко сожми грудь.",
        "Локти мягкие: не превращай сведение в жим.",
        "Суперсет с разведениями стоя.",
      ],
      subs: [
        { id: "incline-db", reason: "если кроссовер занят" },
        { id: "bench-barbell", reason: "штанга, если нужен жим вместо сведения" },
        { id: "dips", reason: "брусья, если блоки заняты" },
      ],
    }),
    ex({
      id: "cable-pushdown",
      name: "Разгибания рук на блоке",
      equipment: "cable",
      muscles: ["triceps"],
      defaults: { sets: 3, reps: "12–15", startWeightKg: 40, note: "" },
      technique: [
        "Локти прижаты к корпусу и не уезжают вперёд.",
        "Разгибай руки полностью, плечи не поднимай.",
        "Возвращай рукоять медленно, 2–3 секунды.",
      ],
      subs: [
        { id: "close-pushup", reason: "если блок занят" },
        { id: "dips", reason: "брусья вместо блока" },
      ],
    }),
    ex({
      id: "dips",
      name: "Отжимания на брусьях",
      equipment: "bodyweight",
      muscles: ["chest", "triceps"],
      defaults: { sets: 2, reps: "7–8", startWeightKg: null, note: "Вес тела" },
      caution: "Не проваливайся в левое плечо. Глубина — только комфортная.",
      technique: [
        "Корпус чуть наклонён вперёд, если чувствуешь грудь.",
        "Опускайся до глубины, которая не тянет плечо.",
        "Локти назад, не в стороны до отказа.",
      ],
      subs: [
        { id: "close-pushup", reason: "если брусья заняты" },
        { id: "cable-pushdown", reason: "блок, мягче для плеча" },
        { id: "bench-barbell", reason: "если нужен жим вместо брусьев" },
      ],
    }),
    ex({
      id: "close-pushup",
      name: "Отжимания узким хватом",
      equipment: "bodyweight",
      muscles: ["triceps", "chest"],
      defaults: { sets: 2, reps: "до отказа", startWeightKg: null, note: "Вес тела" },
      technique: [
        "Ладони уже плеч, локти идут вдоль корпуса.",
        "Тело прямое от головы до пяток.",
        "По плану это работа до отказа.",
      ],
      subs: [
        { id: "cable-pushdown", reason: "если пол занят или нужен блок" },
        { id: "dips", reason: "брусья вместо пола" },
      ],
    }),
    ex({
      id: "lat-pulldown",
      name: "Тяга верхнего блока широким хватом",
      equipment: "cable",
      muscles: ["back", "biceps"],
      defaults: { sets: 4, reps: "8–10", startWeightKg: 55, note: "Только к груди" },
      caution: "Только к груди, не за голову — так спокойнее левому плечу.",
      technique: [
        "Широкий хват, грудь вверх.",
        "Тяни рукоять к верхней части груди, не за голову.",
        "Лопатки вниз, корпус не откидывай рывком.",
      ],
      subs: [
        { id: "pullups", reason: "если верхний блок занят и есть турник" },
        { id: "db-row", reason: "гантель, если блоки заняты" },
      ],
    }),
    ex({
      id: "barbell-row",
      name: "Тяга штанги в наклоне",
      equipment: "barbell",
      muscles: ["back", "biceps"],
      defaults: { sets: 3, reps: "8–10", startWeightKg: 50, note: "Корпус ~45°" },
      technique: [
        "Корпус около 45°, спина ровная.",
        "Тяни гриф к поясу, локти вдоль тела.",
        "Поясницу не кругли.",
      ],
      subs: [
        { id: "seated-row", reason: "если штанга занята — горизонтальный блок" },
        { id: "db-row", reason: "гантель вместо штанги" },
      ],
    }),
    ex({
      id: "seated-row",
      name: "Горизонтальная тяга блока",
      equipment: "cable",
      muscles: ["back"],
      defaults: { sets: 3, reps: "12", startWeightKg: 55, note: "" },
      technique: [
        "Сядь ровно и тяни рукоять к животу.",
        "В конце сведи лопатки, плечи не округляй.",
        "Возвращай вес без рывка вперёд.",
      ],
      subs: [
        { id: "barbell-row", reason: "если блок занят" },
        { id: "db-row", reason: "гантель вместо блока" },
      ],
    }),
    ex({
      id: "db-row",
      name: "Тяга гантели одной рукой",
      equipment: "dumbbell",
      muscles: ["back", "biceps"],
      defaults: { sets: 3, reps: "10–12", startWeightKg: 20, note: "Начинай с левой" },
      technique: [
        "Опора коленом и рукой о скамью, спина ровная.",
        "Начинай с левой руки, правую доводи до того же веса.",
        "Тяни к бедру, локоть к потолку, без рывка.",
      ],
      subs: [
        { id: "seated-row", reason: "если гантели заняты" },
        { id: "barbell-row", reason: "штанга вместо гантели" },
        { id: "lat-pulldown", reason: "верхний блок, если нет свободной скамьи" },
      ],
    }),
    ex({
      id: "face-pull",
      name: "Face pull (канат к лицу)",
      equipment: "cable",
      muscles: ["rear-delt", "back"],
      defaults: { sets: 3, reps: "12–15", startWeightKg: null, note: "Локти высоко, без рывков; суперсет с разведениями" },
      caution: "Это замена тяги к подбородку: мягче для левого плеча. Без рывков.",
      technique: [
        "Канат к лицу, локти выше кистей.",
        "В конце чуть разверни кисти наружу.",
        "Вес лёгкий или средний, без читинга.",
        "Суперсет с разведениями в наклоне.",
      ],
      subs: [
        { id: "rear-delt-fly", reason: "если канат или блок заняты" },
      ],
    }),
    ex({
      id: "rear-delt-fly",
      name: "Разведения в наклоне",
      equipment: "dumbbell",
      muscles: ["rear-delt"],
      defaults: { sets: 3, reps: "15–20", startWeightKg: 7, note: "Задний пучок" },
      technique: [
        "Корпус почти параллелен полу, колени мягкие.",
        "Разводи гантели в стороны, мизинец чуть вверх.",
        "Не кидай вес, держи заднюю дельту.",
        "Суперсет с face pull.",
      ],
      subs: [
        { id: "face-pull", reason: "если гантели заняты" },
      ],
    }),
    ex({
      id: "hammer-curl",
      name: "Молотки с супинацией",
      equipment: "dumbbell",
      muscles: ["biceps"],
      defaults: { sets: 3, reps: "10–12", startWeightKg: 15, note: "" },
      technique: [
        "Старт нейтральным хватом, локти у корпуса.",
        "По пути разверни ладонь вверх.",
        "Не раскачивай корпус.",
      ],
      subs: [],
    }),
    ex({
      id: "squat",
      name: "Приседания со штангой",
      equipment: "barbell",
      muscles: ["quads", "glutes", "hams"],
      defaults: { sets: 4, reps: "8–10", startWeightKg: 50, note: "Разминка: гриф×10, 20×8, 40×5" },
      technique: [
        "Гриф на верхней части спины, корпус собран.",
        "Колени идут по направлению носков.",
        "Глубина комфортная, поясницу не кругли.",
        "Разминка: гриф×10, 20×8, 40×5.",
      ],
      subs: [
        { id: "leg-press", reason: "если стойка для приседа занята" },
        { id: "db-lunge", reason: "гантели, если нет штанги" },
      ],
    }),
    ex({
      id: "leg-press",
      name: "Жим ногами",
      equipment: "machine",
      muscles: ["quads", "glutes"],
      defaults: { sets: 3, reps: "12", startWeightKg: 80, note: "" },
      technique: [
        "Стопы на ширине таза, поясница прижата к спинке.",
        "Опускай до безопасной глубины и не отрывай таз.",
        "Вверху не защёлкивай колени жёстко.",
      ],
      subs: [
        { id: "squat", reason: "если тренажёр занят" },
        { id: "db-lunge", reason: "гантели вместо жима ногами" },
      ],
    }),
    ex({
      id: "leg-curl",
      name: "Сгибания ног лёжа",
      equipment: "machine",
      muscles: ["hams"],
      defaults: { sets: 3, reps: "12", startWeightKg: 36, note: "" },
      technique: [
        "Таз прижат к скамье.",
        "Сгибай плавно и не отрывай бёдра.",
        "Опускай вес за 2–3 секунды.",
      ],
      subs: [],
    }),
    ex({
      id: "cable-lateral",
      name: "Кабельные разведения в стороны",
      equipment: "cable",
      muscles: ["side-delt"],
      defaults: { sets: 4, reps: "15–20", startWeightKg: null, note: "Лёгкий вес, постоянное натяжение" },
      technique: [
        "Рука чуть согнута, трос не даёт расслабиться внизу.",
        "Подъём в сторону до уровня плеча.",
        "Лёгкий вес, без раскачки.",
      ],
      subs: [
        { id: "lateral-raise", reason: "если блок занят — гантели" },
      ],
    }),
    ex({
      id: "db-lunge",
      name: "Выпады с гантелями",
      equipment: "dumbbell",
      muscles: ["quads", "glutes"],
      defaults: { sets: 3, reps: "12/ногу", startWeightKg: 8, note: "" },
      technique: [
        "Шаг назад или вперёд, корпус почти вертикальный.",
        "Колено передней ноги не заваливается внутрь.",
        "Считай 12 на каждую ногу.",
      ],
      subs: [
        { id: "squat", reason: "если нет места или гантелей" },
        { id: "leg-press", reason: "тренажёр вместо выпадов" },
      ],
    }),
    ex({
      id: "calf-raise",
      name: "Подъёмы на носки",
      equipment: "machine",
      muscles: ["calves"],
      defaults: { sets: 3, reps: "15–20", startWeightKg: 50, note: "" },
      technique: [
        "Полная амплитуда: пятка вниз, затем пауза вверху.",
        "Не пружинь на носке.",
        "Опускайся медленно.",
      ],
      subs: [],
    }),
    ex({
      id: "plank",
      name: "Планка",
      equipment: "bodyweight",
      muscles: ["core"],
      defaults: { sets: 3, reps: "45–60 сек", startWeightKg: null, note: "" },
      technique: [
        "Локти под плечами, тело одной линией.",
        "Не проваливай поясницу и не задирай таз.",
        "Дыши ровно, время пиши в поле повторений.",
      ],
      subs: [
        { id: "crunch-bike", reason: "если на пол встать нельзя" },
        { id: "hanging-leg-raise", reason: "вис вместо планки, если плечо спокойно" },
      ],
    }),
    ex({
      id: "hanging-leg-raise",
      name: "Подъёмы ног в висе",
      equipment: "bodyweight",
      muscles: ["core"],
      defaults: { sets: 3, reps: "12–15", startWeightKg: null, note: "" },
      caution: "Если вис тянет левое плечо — замени на планку или скручивания.",
      technique: [
        "Хват спокойный, без раскачки.",
        "Подкручивай таз, а не только поднимай прямые ноги.",
        "Не дёргай плечо внизу.",
      ],
      subs: [
        { id: "crunch-bike", reason: "если турник занят или вис беспокоит плечо" },
        { id: "plank", reason: "пол вместо виса" },
      ],
    }),
    ex({
      id: "crunch-bike",
      name: "Скручивания / Велосипед",
      equipment: "bodyweight",
      muscles: ["core"],
      defaults: { sets: 2, reps: "20 / 30 сек", startWeightKg: null, note: "" },
      technique: [
        "Поясница остаётся на полу.",
        "Движение от рёбер к тазу, шею руками не тяни.",
        "В велосипеде локоть идёт к противоположному колену.",
      ],
      subs: [
        { id: "plank", reason: "если скручивания неудобны" },
        { id: "hanging-leg-raise", reason: "если пол занят и плечо спокойно" },
      ],
    }),
    ex({
      id: "pullups",
      name: "Подтягивания",
      equipment: "bodyweight",
      log: "reps",
      muscles: ["back", "biceps"],
      defaults: { sets: 4, reps: "повторы", startWeightKg: null, note: "Вес тела. Сумма считается по отмеченным подходам." },
      caution: "Без рывка в левое плечо. Если турника нет — верхний блок к груди.",
      technique: [
        "Из виса сначала включи лопатки, потом сгибай руки.",
        "Тяни грудь к перекладине.",
        "Опускайся почти до прямых рук.",
        "В сумму идут только подходы с галочкой.",
      ],
      subs: [
        { id: "lat-pulldown", reason: "если турник занят" },
      ],
    }),
  ];

  const PROGRAM = [
    {
      id: "push",
      title: "PUSH",
      subtitle: "Грудь · Передняя дельта · Трицепс",
      weekdays: [2],
      kind: "gym",
      exerciseIds: [
        "bench-barbell",
        "incline-db",
        "seated-db-press",
        "lateral-raise",
        "cable-fly",
        "cable-pushdown",
        "dips",
        "close-pushup",
      ],
    },
    {
      id: "pull",
      title: "PULL",
      subtitle: "Спина · Задняя дельта · Бицепс",
      weekdays: [4],
      kind: "gym",
      exerciseIds: [
        "lat-pulldown",
        "barbell-row",
        "seated-row",
        "db-row",
        "face-pull",
        "rear-delt-fly",
        "hammer-curl",
      ],
    },
    {
      id: "legs",
      title: "LEGS",
      subtitle: "Ноги · Средняя дельта · Кор",
      weekdays: [0],
      kind: "gym",
      exerciseIds: [
        "squat",
        "leg-press",
        "leg-curl",
        "cable-lateral",
        "db-lunge",
        "calf-raise",
        "plank",
        "hanging-leg-raise",
        "crunch-bike",
      ],
    },
    {
      id: "pullups",
      title: "Подтягивания",
      subtitle: "Пн · Ср · Сб",
      weekdays: [1, 3, 6],
      kind: "pullups",
      exerciseIds: ["pullups"],
    },
  ];

  function byId(id) {
    return CATALOG.find((item) => item.id === id) || null;
  }

  function muscleTitle(id) {
    return MUSCLES.find((item) => item.id === id)?.title || id;
  }

  let seq = 0;
  function uid() {
    seq += 1;
    return `${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  function blockFromExercise(exerciseId, dayId) {
    const item = byId(exerciseId);
    const defaults = item?.defaults || { sets: 3, reps: "8–12", startWeightKg: null, note: "" };
    return {
      uid: dayId ? `plan-${dayId}-${exerciseId}` : uid(),
      exerciseId,
      sets: defaults.sets,
      reps: defaults.reps,
      startWeightKg: defaults.startWeightKg,
      note: defaults.note || "",
    };
  }

  function defaultPlan() {
    return {
      days: PROGRAM.map((day) => ({
        id: day.id,
        title: day.title,
        subtitle: day.subtitle,
        weekdays: day.weekdays.slice(),
        kind: day.kind,
        blocks: day.exerciseIds.map((exerciseId) => blockFromExercise(exerciseId, day.id)),
      })),
    };
  }

  function emptyCardio() {
    return { kind: "none", minutes: null, km: null, steps: null };
  }

  function fmtNum(value) {
    if (value == null || value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return String(Math.round(number * 10) / 10);
  }

  function previousFor(sessions, exerciseId, excludeId) {
    const list = (sessions || [])
      .filter((session) => session.completed && session.id !== excludeId)
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    for (const session of list) {
      const exercise = (session.exercises || []).find((item) => item.exerciseId === exerciseId);
      if (!exercise) continue;
      const sets = exercise.sets || [];
      const done = sets.filter((set) => set.done);
      const source = (done.length ? done : sets).slice().sort((a, b) => a.index - b.index);
      if (!source.length) continue;
      const map = {};
      for (const set of source) {
        map[set.index] = { weightKg: set.weightKg ?? null, reps: set.reps ?? null };
      }
      return { date: session.date, sessionId: session.id, map };
    }
    return null;
  }

  function createSession(day, sessions) {
    const session = {
      id: uid(),
      date: new Date().toISOString(),
      dayId: day.id,
      dayTitle: day.title,
      dayKind: day.kind,
      notes: "",
      completed: false,
      warmup: emptyCardio(),
      cooldown: emptyCardio(),
      exercises: [],
    };

    for (const block of day.blocks) {
      const item = byId(block.exerciseId);
      const prev = previousFor(sessions, block.exerciseId, null);
      const prevCount = prev ? Math.max(...Object.keys(prev.map).map(Number)) : 0;
      const setCount = day.kind === "pullups" && prevCount > 0 ? prevCount : block.sets;
      const sets = [];
      for (let index = 1; index <= setCount; index += 1) {
        const past = prev?.map[index];
        sets.push({
          index,
          weightKg: past ? (past.weightKg ?? null) : (block.startWeightKg ?? null),
          reps: past ? (past.reps ?? null) : null,
          done: false,
        });
      }
      session.exercises.push({
        uid: uid(),
        blockUid: block.uid,
        exerciseId: block.exerciseId,
        name: item?.name || "Упражнение",
        log: item?.log || "strength",
        targetSets: setCount,
        targetReps: block.reps,
        startWeightKg: block.startWeightKg ?? null,
        note: block.note || "",
        sets,
      });
    }
    return session;
  }

  function repTotal(sets) {
    return (sets || []).reduce((sum, set) => sum + (set.done ? Number(set.reps) || 0 : 0), 0);
  }

  function isPullupExercise(exercise) {
    return exercise?.exerciseId === "pullups" || exercise?.log === "reps";
  }

  function pullupSamples(sessions) {
    const list = (sessions || [])
      .filter((session) => session.completed && (session.exercises || []).some(isPullupExercise))
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let previous = null;
    return list.map((session) => {
      const total = (session.exercises || []).reduce((sum, exercise) => (
        isPullupExercise(exercise) ? sum + repTotal(exercise.sets) : sum
      ), 0);
      const delta = previous == null ? null : total - previous;
      previous = total;
      return { id: session.id, date: session.date, total, delta };
    });
  }

  function matchingDays(plan, date) {
    const weekday = date.getDay();
    return (plan?.days || []).filter((day) => (day.weekdays || []).includes(weekday));
  }

  function todayLine(plan, date) {
    const names = matchingDays(plan, date).map((day) => day.title);
    if (!names.length) return "Сегодня день отдыха по расписанию — или выбери сам";
    return `Сегодня по плану: ${names.join(" · ")}`;
  }

  function cardioSummary(cardio) {
    if (!cardio || cardio.kind === "none") return "";
    const title = CARDIO.find((item) => item.id === cardio.kind)?.title || cardio.kind;
    const parts = [title];
    if (cardio.minutes) parts.push(`${cardio.minutes} мин`);
    if (cardio.km) parts.push(`${fmtNum(cardio.km)} км`);
    if (cardio.steps) parts.push(`${cardio.steps} шагов`);
    return parts.join(" · ");
  }

  function formatLoggedSet(set, repsOnly) {
    if (repsOnly) return set.reps != null ? String(set.reps) : "—";
    const weight = set.weightKg != null && set.weightKg !== "" ? `${fmtNum(set.weightKg)} кг` : "—";
    return set.reps != null && set.reps !== "" ? `${weight} × ${set.reps}` : weight;
  }

  function newDay() {
    return {
      id: uid(),
      title: "Новый день",
      subtitle: "Собери из упражнений",
      weekdays: [],
      kind: "gym",
      blocks: [],
    };
  }

  function withoutStamp(record) {
    if (!record) return "";
    const copy = { ...record };
    delete copy.updatedAt;
    return JSON.stringify(copy);
  }

  function accountTime(record) {
    return String(record?.updatedAt || record?.date || "");
  }

  function accountStamp(database) {
    const plan = database?.plan || defaultPlan();
    const sessions = database?.sessions || [];
    let planUpdatedAt = plan.updatedAt || "";
    const customized = withoutStamp(plan) !== withoutStamp(defaultPlan());
    if (!planUpdatedAt && (sessions.length || customized)) {
      planUpdatedAt = sessions.reduce((max, session) => (
        String(session.date || "") > max ? String(session.date) : max
      ), "") || "2020-01-01T00:00:00.000Z";
    }
    return {
      planUpdatedAt,
      sessions: sessions.map((session) => ({
        ...session,
        updatedAt: session.updatedAt || session.date || planUpdatedAt || "2020-01-01T00:00:00.000Z",
      })),
    };
  }

  function mergeAccount(local, remote) {
    const deleted = [];
    const seenDeleted = new Set();
    for (const id of [...(local?.deletedSessionIds || []), ...(remote?.deletedSessionIds || [])]) {
      if (!id || seenDeleted.has(id)) continue;
      seenDeleted.add(id);
      deleted.push(id);
    }
    const keptDeleted = deleted.slice(-400);

    let plan = local?.plan || defaultPlan();
    if (remote?.plan?.days && accountTime(remote.plan) > accountTime(plan)) plan = remote.plan;

    const sessions = new Map();
    for (const session of [...(local?.sessions || []), ...(remote?.sessions || [])]) {
      if (!session?.id || seenDeleted.has(session.id)) continue;
      const previous = sessions.get(session.id);
      if (!previous || accountTime(session) > accountTime(previous)) sessions.set(session.id, session);
    }

    return {
      plan,
      sessions: [...sessions.values()],
      deletedSessionIds: keptDeleted,
    };
  }

  return {
    MUSCLES,
    EQUIPMENT,
    CARDIO,
    WEEKDAYS,
    CATALOG,
    byId,
    muscleTitle,
    uid,
    blockFromExercise,
    defaultPlan,
    emptyCardio,
    fmtNum,
    previousFor,
    createSession,
    repTotal,
    pullupSamples,
    matchingDays,
    todayLine,
    cardioSummary,
    formatLoggedSet,
    newDay,
    accountStamp,
    mergeAccount,
  };
});

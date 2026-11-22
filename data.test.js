const assert = require("assert");
const D = require("./data.js");

const pushNames = [
  "Жим штанги лёжа",
  "Жим гантелей на наклонной 30–45°",
  "Жим гантелей сидя (плечи)",
  "Разведения гантелей стоя",
  "Сведения в кроссовере",
  "Разгибания рук на блоке",
  "Отжимания на брусьях",
  "Отжимания узким хватом",
];
const pullNames = [
  "Тяга верхнего блока широким хватом",
  "Тяга штанги в наклоне",
  "Горизонтальная тяга блока",
  "Тяга гантели одной рукой",
  "Face pull (канат к лицу)",
  "Разведения в наклоне",
  "Молотки с супинацией",
];
const legNames = [
  "Приседания со штангой",
  "Жим ногами",
  "Сгибания ног лёжа",
  "Кабельные разведения в стороны",
  "Выпады с гантелями",
  "Подъёмы на носки",
  "Планка",
  "Подъёмы ног в висе",
  "Скручивания / Велосипед",
];

const ids = D.CATALOG.map((item) => item.id);
assert.equal(new Set(ids).size, ids.length);
assert.equal(ids.length, 25);

for (const item of D.CATALOG) {
  assert.ok(item.muscles.length, item.id);
  assert.ok(D.EQUIPMENT[item.equipment], item.id);
  for (const sub of item.subs) {
    assert.notEqual(sub.id, item.id, item.id);
    assert.ok(D.byId(sub.id), `${item.id} -> ${sub.id}`);
  }
  for (const muscle of item.muscles) {
    assert.ok(D.MUSCLES.some((entry) => entry.id === muscle), muscle);
  }
}

const plan = D.defaultPlan();
const byDay = Object.fromEntries(plan.days.map((day) => [day.id, day]));
assert.deepEqual(byDay.push.blocks.map((block) => D.byId(block.exerciseId).name), pushNames);
assert.deepEqual(byDay.pull.blocks.map((block) => D.byId(block.exerciseId).name), pullNames);
assert.deepEqual(byDay.legs.blocks.map((block) => D.byId(block.exerciseId).name), legNames);
assert.equal(byDay.pullups.blocks.length, 1);
assert.equal(byDay.push.blocks[0].sets, 4);
assert.equal(byDay.push.blocks[0].reps, "6–8");
assert.equal(byDay.push.blocks[0].startWeightKg, 70);
assert.equal(byDay.push.blocks[3].startWeightKg, 9);
assert.equal(byDay.pull.blocks[0].note, "Только к груди");
assert.equal(byDay.legs.blocks[0].startWeightKg, 50);
assert.equal(byDay.legs.blocks[1].startWeightKg, 80);
assert.equal(byDay.pull.blocks[4].startWeightKg, null);
assert.deepEqual(byDay.push.weekdays, [2]);
assert.deepEqual(byDay.pullups.weekdays, [1, 3, 6]);

const history = [
  {
    id: "old",
    completed: true,
    date: "2026-11-01T10:00:00.000Z",
    exercises: [
      {
        exerciseId: "bench-barbell",
        sets: [
          { index: 1, weightKg: 70, reps: 8, done: true },
          { index: 2, weightKg: 70, reps: 8, done: true },
        ],
      },
    ],
  },
  {
    id: "draft",
    completed: false,
    date: "2026-11-20T10:00:00.000Z",
    exercises: [
      {
        exerciseId: "bench-barbell",
        sets: [{ index: 1, weightKg: 200, reps: 1, done: true }],
      },
    ],
  },
  {
    id: "latest",
    completed: true,
    date: "2026-11-12T10:00:00.000Z",
    exercises: [
      {
        exerciseId: "bench-barbell",
        sets: [
          { index: 1, weightKg: 72.5, reps: 6, done: true },
          { index: 2, weightKg: 72.5, reps: 5, done: true },
          { index: 3, weightKg: 70, reps: 4, done: false },
        ],
      },
    ],
  },
];

const previous = D.previousFor(history, "bench-barbell", null);
assert.equal(previous.sessionId, "latest");
assert.equal(previous.map[1].weightKg, 72.5);
assert.equal(previous.map[3], undefined);

const session = D.createSession(byDay.push, history);
const bench = session.exercises[0];
assert.equal(bench.sets.length, 4);
assert.equal(bench.sets[0].weightKg, 72.5);
assert.equal(bench.sets[0].reps, 6);
assert.equal(bench.sets[0].done, false);
assert.equal(bench.sets[2].weightKg, 70);
assert.equal(bench.sets[2].reps, null);
assert.equal(bench.blockUid, "plan-push-bench-barbell");

const pullupHistory = [
  {
    id: "p1",
    completed: true,
    date: "2026-11-10T10:00:00.000Z",
    dayKind: "pullups",
    exercises: [
      {
        exerciseId: "pullups",
        sets: [
          { index: 1, weightKg: null, reps: 5, done: true },
          { index: 2, weightKg: null, reps: 4, done: true },
          { index: 3, weightKg: null, reps: 3, done: true },
          { index: 4, weightKg: null, reps: 3, done: true },
          { index: 5, weightKg: null, reps: 2, done: true },
        ],
      },
    ],
  },
];
const pullupSession = D.createSession(byDay.pullups, pullupHistory);
assert.equal(pullupSession.exercises[0].sets.length, 5);
assert.equal(pullupSession.exercises[0].sets[0].reps, 5);
assert.equal(D.repTotal(pullupHistory[0].exercises[0].sets), 17);
assert.equal(D.pullupSamples(pullupHistory)[0].total, 17);

const freshPullups = D.createSession(byDay.pullups, []);
assert.equal(freshPullups.exercises[0].sets.length, 4);

const sunday = new Date(2026, 10, 22);
const monday = new Date(2026, 10, 23);
const tuesday = new Date(2026, 10, 24);
const thursday = new Date(2026, 10, 26);
const friday = new Date(2026, 10, 27);
assert.equal(sunday.getDay(), 0);
assert.deepEqual(D.matchingDays(plan, sunday).map((day) => day.id), ["legs"]);
assert.deepEqual(D.matchingDays(plan, monday).map((day) => day.id), ["pullups"]);
assert.deepEqual(D.matchingDays(plan, tuesday).map((day) => day.id), ["push"]);
assert.deepEqual(D.matchingDays(plan, thursday).map((day) => day.id), ["pull"]);
assert.equal(D.matchingDays(plan, friday).length, 0);
assert.equal(D.todayLine(plan, friday), "Сегодня день отдыха по расписанию — или выбери сам");
assert.equal(D.fmtNum(72.5), "72.5");
assert.equal(D.fmtNum(70), "70");

const freshStamp = D.accountStamp({ plan: D.defaultPlan(), sessions: [] });
assert.equal(freshStamp.planUpdatedAt, "");

const legacy = D.accountStamp({
  plan: D.defaultPlan(),
  sessions: [{ id: "a", date: "2026-11-01T00:00:00.000Z", exercises: [] }],
});
assert.equal(legacy.planUpdatedAt, "2026-11-01T00:00:00.000Z");
assert.equal(legacy.sessions[0].updatedAt, "2026-11-01T00:00:00.000Z");

const merged = D.mergeAccount(
  {
    plan: { days: [{ id: "push" }], updatedAt: "2026-11-02T00:00:00.000Z" },
    sessions: [{ id: "a", date: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", notes: "local" }],
    deletedSessionIds: [],
  },
  {
    plan: { days: [{ id: "pull" }], updatedAt: "2026-11-03T00:00:00.000Z" },
    sessions: [
      { id: "a", date: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-04T00:00:00.000Z", notes: "cloud" },
      { id: "b", date: "2026-11-03T00:00:00.000Z", updatedAt: "2026-11-03T00:00:00.000Z" },
      { id: "c", date: "2026-11-03T00:00:00.000Z", updatedAt: "2026-11-03T00:00:00.000Z" },
    ],
    deletedSessionIds: ["b"],
  },
);
assert.equal(merged.plan.days[0].id, "pull");
assert.deepEqual(merged.sessions.map((session) => session.id), ["a", "c"]);
assert.equal(merged.sessions[0].notes, "cloud");
assert.ok(merged.deletedSessionIds.includes("b"));

const native = D.createSession(byDay.push, []);
assert.equal(D.adoptSession(native, plan), native);

const archive = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "../gymlog-2026-11-22.json"), "utf8"));
const adopted = D.adoptArchive(archive);
assert.equal(adopted.sessions.length, archive.sessions.length);
const pullupArchive = archive.sessions.find((session) => session.day === "pullups");
const pullupAdopted = D.adoptSession(pullupArchive, plan);
assert.equal(pullupAdopted.dayId, "pullups");
assert.equal(pullupAdopted.dayTitle, "Подтягивания");
assert.equal(pullupAdopted.exercises[0].exerciseId, "pullups");
assert.equal(pullupAdopted.exercises[0].log, "reps");
assert.equal(D.adoptSession(pullupAdopted, plan), pullupAdopted);

const benchPast = D.previousFor(archive.sessions, "bench-barbell", null);
assert.equal(benchPast.map[1].weightKg, 80);
assert.equal(benchPast.map[1].reps, 8);
const continued = D.createSession(byDay.push, adopted.sessions);
assert.equal(continued.exercises[0].sets[0].weightKg, 80);
assert.equal(continued.exercises[0].sets[0].reps, 8);
assert.equal(continued.exercises[0].sets[0].done, false);
const continuedPullups = D.createSession(byDay.pullups, adopted.sessions);
assert.equal(continuedPullups.exercises[0].sets.length, 5);
assert.equal(continuedPullups.exercises[0].sets[0].reps, 6);

console.log("data.test.js ok");

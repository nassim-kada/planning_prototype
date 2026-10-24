// -----------------------------------------------------------------------------
// Schedule data and shared helpers
// -----------------------------------------------------------------------------
// الحجم الساعي الأسبوعي لكل مادة: [أولى، ثانية، ثالثة، رابعة] متوسط
const SUB = [
  ["اللغة العربية", [5, 5, 4, 4]],
  ["الرياضيات", [4, 4, 4, 4]],
  ["اللغة الفرنسية", [3, 3, 4, 4]],
  ["اللغة الإنجليزية", [3, 3, 4, 4]],
  ["علوم الطبيعة والحياة", [2, 2, 2, 2]],
  ["العلوم الفيزيائية والتكنولوجيا", [2, 2, 2, 2]],
  ["التاريخ والجغرافيا", [2, 2, 2, 2]],
  ["التربية الإسلامية", [1, 1, 1, 1]],
  ["التربية المدنية", [1, 1, 1, 1]],
  ["الإعلام الآلي", [1, 1, 1, 1]],
  ["التربية البدنية والرياضية", [2, 2, 2, 2]],
  ["التربية الفنية التشكيلية", [1, 1, 1, 1]],
];
const NS = SUB.length,
  CORE = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
const LBL = (i) => (i == 6 ? "التاريخ والجغرافيا والتربية المدنية" : SUB[i][0]);
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const PER = [
  "08:15 - 09:15",
  "09:15 - 10:15",
  "10:30 - 11:30",
  "11:30 - 12:30",
  "13:15 - 14:15",
  "14:15 - 15:15",
  "15:15 - 16:15",
];
const Y = ["أولى", "ثانية", "ثالثة", "رابعة"];
const CL = [];
Y.forEach((y) => [1, 2].forEach((k) => CL.push(`${y} متوسط - القسم ${k}`)));
const $ = (s) => document.querySelector(s);
const ACTIVE_SUBJECTS = SUB.map(() => true);
const savedSubjectHours = SUB.map((subject) => subject[1].slice());
const hy = (i) => [0, 1, 2, 3].map((y) => +$(`#h${i}_${y}`).value || 0);
const asg = (hs, n) => {
  const l = Array(n).fill(0);
  [...hs]
    .sort((a, b) => b - a)
    .forEach((x) => {
      l[l.indexOf(Math.min(...l))] += x;
    });
  return Math.max(...l);
};
const minT = (h, L) => {
  const hs = h.flatMap((x) => [x, x]).filter((x) => x > 0);
  if (!hs.length) return 0;
  for (let n = 1; n <= 8; n++) if (asg(hs, n) <= L) return n;
  return 8;
};
SUB.forEach((s, i) =>
  $("#subs").insertAdjacentHTML(
    "beforeend",
    `<tr id="subject-row-${i}"><td><div class="subject-name"><span>${s[0]}</span><button class="subject-toggle" type="button" onclick="toggleSubject(${i})" aria-label="إزالة ${s[0]} من البرنامج">إزالة</button></div></td>${s[1].map((v, y) => `<td><input type=number min=0 max=10 value=${v} id=h${i}_${y} oninput=updateTotalsAndTeacherCards()></td>`).join("")}</tr>`,
  ),
);
function toggleSubject(i) {
  const row = $("#subject-row-" + i);
  ACTIVE_SUBJECTS[i] = !ACTIVE_SUBJECTS[i];
  row.classList.toggle("inactive", !ACTIVE_SUBJECTS[i]);
  for (let y = 0; y < 4; y++) {
    const input = $(`#h${i}_${y}`);
    if (ACTIVE_SUBJECTS[i]) {
      input.value = savedSubjectHours[i][y];
      input.disabled = false;
    } else {
      savedSubjectHours[i][y] = +input.value || 0;
      input.value = 0;
      input.disabled = true;
    }
  }
  const button = row.querySelector(".subject-toggle");
  button.textContent = ACTIVE_SUBJECTS[i] ? "إزالة" : "إعادة تفعيل";
  button.setAttribute(
    "aria-label",
    `${ACTIVE_SUBJECTS[i] ? "إزالة" : "إعادة تفعيل"} ${SUB[i][0]} ${ACTIVE_SUBJECTS[i] ? "من" : "في"} البرنامج`,
  );
  updateTotalsAndTeacherCards();
}
// -----------------------------------------------------------------------------
// Subject hours and teacher cards
// -----------------------------------------------------------------------------
function updateTotalsAndTeacherCards() {
  const L = +$("#ml").value || 24;
  renderTeacherCards();
  for (let y = 0; y < 4; y++) {
    const t = SUB.reduce((a, _, i) => a + hy(i)[y], 0);
    const e = $("#t" + y);
    e.textContent = t + " ساعة";
    e.style.color = t > 35 ? "#d33" : "";
  }
}
$("#ml").oninput = updateTotalsAndTeacherCards;
const TN = SUB.map(() => []);
const esc = (t) =>
  t.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const hyT = (i) => (i == 6 ? hy(6).map((v, y) => v + hy(8)[y]) : hy(i));
const mn = (i) => minT(hyT(i), +$("#ml").value || 24);
const rngs = (t) => {
  const p = [];
  for (let d = 0; d < 5; d++) {
    const r = [];
    let s = 0;
    while (s < 7) {
      if (t.off[d * 7 + s]) {
        let e = s;
        while (e + 1 < 7 && t.off[d * 7 + e + 1]) e++;
        r.push(
          s == 0 && e == 6
            ? "طوال اليوم"
            : PER[s].split(" - ")[0] + " إلى " + PER[e].split(" - ")[1],
        );
        s = e + 1;
      } else s++;
    }
    if (r.length) p.push(DAYS[d] + ": " + r.join(" و "));
  }
  return p;
};
// -----------------------------------------------------------------------------
// Teacher class and availability controls
// -----------------------------------------------------------------------------
function renderAvailabilityGrid(i, k, t) {
  let h = `<div class="gw" data-i="${i}" data-k="${k}"><div class="lg"><span><i style="background:#d9f5e3"></i>متاح للتدريس</span><span><i style="background:#fde0e0"></i>غير متاح (لا تُبرمج له حصص)</span></div><table class="av"><tr><th>الوقت</th>${DAYS.map((d, x) => `<th class="hc" onclick="toggleTeacherDay(${i},${k},${x})">${d}</th>`).join("")}</tr>`;
  PER.forEach((p, s) => {
    h +=
      `<tr><th class="hc" onclick="toggleTeacherPeriod(${i},${k},${s})">${p}</th>` +
      DAYS.map((_, d) => {
        const o = t.off[d * 7 + s];
        return `<td class="cell ${o ? "off" : "on"}" data-x="${d * 7 + s}">${o ? "غير متاح" : "متاح"}</td>`;
      }).join("") +
      "</tr>";
    if (s == 1)
      h += '<tr class="brk"><td colspan="6">استراحة 10:15 - 10:30</td></tr>';
    if (s == 3)
      h +=
        '<tr class="brk"><td colspan="6">فترة الغداء 12:30 - 13:15</td></tr>';
  });
  return (
    h +
    `</table><div class="ab"><button class="s sm" onclick="setTeacherAvailability(${i},${k},false)">الكل متاح</button><button class="s sm" onclick="setTeacherAvailability(${i},${k},true)">الكل غير متاح</button></div><div class="em">انقر على أي خانة لتبديلها أو اسحب لتلوين عدة خانات. انقر على اسم اليوم أو على الوقت لتبديل العمود أو الصف كاملا.</div></div>`
  );
}
const summarizeTeacherClasses = (t) => {
  const n = t.cl.filter((x) => x).length;
  return n == 8
    ? "كل الأقسام (يوزّعها البرنامج تلقائيا إن وُجد أكثر من أستاذ)"
    : n == 0
      ? "لا قسم محدد (لن تُبرمج له حصص)"
      : CL.filter((_, c) => t.cl[c]).join("، ");
};
function renderClassAssignmentGrid(i, k, t) {
  const takenByOthers = new Set(
    TN[i].flatMap((teacher, index) =>
      index === k ? [] : teacher.cl.flatMap((assigned, c) => assigned ? [c] : []),
    ),
  );
  return `<div class="cg">${Y.map(
    (y, yy) =>
      `<div class="cy"><b>${y} متوسط</b>${[0, 1]
        .map((q) => {
          const c = yy * 2 + q;
          const unavailable = takenByOthers.has(c);
          return `<label class="ck ${unavailable ? "disabled" : ""}"><input type="checkbox" ${t.cl[c] ? "checked" : ""} ${unavailable ? "disabled" : ""} onchange="setTeacherClassAssignment(${i},${k},${c},this.checked)">القسم ${q + 1}${unavailable ? " — مُسنَد" : ""}</label>`;
        })
        .join("")}</div>`,
  ).join(
    "",
  )}</div><div class="ab"><button class="s sm" onclick="setTeacherClassAssignments(${i},${k},true)">كل الأقسام المتاحة</button><button class="s sm" onclick="setTeacherClassAssignments(${i},${k},false)">إلغاء التحديد</button></div><div class="em">الأقسام المسندة إلى أستاذ آخر في هذه المادة غير متاحة للاختيار. أزل التحديد عن قسم من الأستاذ الآخر لإتاحته هنا.</div>`;
}
function setTeacherClassAssignment(i, k, c, v) {
  if (v && TN[i].some((teacher, index) => index !== k && teacher.cl[c])) return;
  TN[i][k].cl[c] = v;
  refreshTeacherViews();
}
function setTeacherClassAssignments(i, k, v) {
  const taken = new Set(
    TN[i].flatMap((teacher, index) =>
      index === k ? [] : teacher.cl.flatMap((assigned, c) => assigned ? [c] : []),
    ),
  );
  TN[i][k].cl = TN[i][k].cl.map((assigned, c) =>
    v ? assigned || !taken.has(c) : false,
  );
  refreshTeacherViews();
}
function renderTeacherCard(i, k, t) {
  const o = rngs(t);
  return `<div class="tw"><div class="hd"><b>${esc(t.n)}</b><button class="s sm" onclick="openTeacherModal(${i},${k},'c')">الأقسام</button><button class="s sm" onclick="openTeacherModal(${i},${k},'a')">تخصيص الأوقات</button><button class="x" onclick="removeTeacher(${i},${k})" aria-label="حذف">×</button></div><div class="em">الأقسام: ${summarizeTeacherClasses(t)}</div><div class="em">${o.length ? "غير متاح — " + o.join(" | ") : "متاح طوال الأسبوع"}</div></div>`;
}
function renderTeacherCards() {
  $("#tg").innerHTML = SUB.map((s, i) => {
    if (i == 8 || !hyT(i).some((x) => x)) return "";
    const m = mn(i),
      n = TN[i].length;
    return `<div class="tc"><div class="th"><span class="dot" style="background:hsl(${i * 27} 70% 60%)"></span><b>${LBL(i)}</b><span class="bd ${n >= m ? "g" : "r"}">${n} من ${m} أستاذ</span></div>
  <div class="tl">${TN[i].map((t, k) => renderTeacherCard(i, k, t)).join("") || '<span class="em">لم يُضف أي أستاذ بعد</span>'}</div>
  <div class="ad"><input id="in${i}" placeholder="اسم الأستاذ" onkeydown="if(event.key==='Enter'){event.preventDefault();addTeacher(${i})}"><button onclick="addTeacher(${i})">إضافة</button></div></div>`;
  }).join("");
}
const mk = (n) => ({
  n,
  off: Array(35).fill(false),
  cl: Array(8).fill(false),
  open: false,
});
// -----------------------------------------------------------------------------
// Teacher management and modal controls
// -----------------------------------------------------------------------------
function addTeacher(i) {
  const v = $("#in" + i)
    .value.split(/[,،\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!v.length) return;
  v.forEach((name) => {
    const teacher = mk(name);
    teacher.cl.fill(TN[i].length === 0);
    TN[i].push(teacher);
  });
  renderTeacherCards();
  $("#in" + i).focus();
}
function removeTeacher(i, k) {
  TN[i].splice(k, 1);
  renderTeacherCards();
}
let MD = null;
function openTeacherModal(i, k, m) {
  MD = { i, k, m };
  renderTeacherModal();
}
function closeTeacherModal() {
  MD = null;
  renderTeacherModal();
  renderTeacherCards();
}
function renderTeacherModal() {
  const m = $("#md");
  if (!MD) {
    m.hidden = true;
    return;
  }
  const t = TN[MD.i][MD.k];
  m.hidden = false;
  $("#mt").textContent =
    (MD.m == "c" ? "الأقسام التي يدرّسها الأستاذ: " : "تخصيص أوقات الأستاذ: ") +
    t.n +
    " (" +
    LBL(MD.i) +
    ")";
  $("#mb").innerHTML =
    MD.m == "c"
      ? renderClassAssignmentGrid(MD.i, MD.k, t)
      : renderAvailabilityGrid(MD.i, MD.k, t);
}
const refreshTeacherViews = () => {
  renderTeacherCards();
  renderTeacherModal();
};
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && MD) closeTeacherModal();
});
const flip = (t, ix) => {
  const v = !ix.every((x) => t.off[x]);
  ix.forEach((x) => (t.off[x] = v));
};
function toggleTeacherDay(i, k, d) {
  flip(
    TN[i][k],
    [0, 1, 2, 3, 4, 5, 6].map((s) => d * 7 + s),
  );
  refreshTeacherViews();
}
function toggleTeacherPeriod(i, k, s) {
  flip(
    TN[i][k],
    [0, 1, 2, 3, 4].map((d) => d * 7 + s),
  );
  refreshTeacherViews();
}
function setTeacherAvailability(i, k, v) {
  TN[i][k].off.fill(v);
  refreshTeacherViews();
}
function addSuggestedTeachers() {
  SUB.forEach((s, i) => {
    if (i == 8) return;
    if (!hyT(i).some((hours) => hours > 0)) return;
    const m = mn(i);
    while (TN[i].length < m)
      TN[i].push(mk(`أستاذ ${s[0]} ${TN[i].length + 1}`));

    // Spread all classes as evenly as possible across this subject's teachers.
    const teachers = TN[i];
    if (!teachers.length) return;
    teachers.forEach((teacher) => teacher.cl.fill(false));
    CL.forEach((_, c) => {
      teachers[c % teachers.length].cl[c] = true;
    });
  });
  renderTeacherCards();
}
// Tracks a pointer drag while marking availability cells.
let pt = null;
const setAvailabilityCell = (c, x) => {
  TN[pt.i][pt.k].off[x] = pt.v;
  c.className = "cell " + (pt.v ? "off" : "on");
  c.textContent = pt.v ? "غير متاح" : "متاح";
};
$("#md").addEventListener("pointerdown", (e) => {
  const c = e.target.closest(".cell");
  if (!c) return;
  const g = c.closest(".gw"),
    i = +g.dataset.i,
    k = +g.dataset.k,
    x = +c.dataset.x;
  pt = { i, k, v: !TN[i][k].off[x] };
  setAvailabilityCell(c, x);
  e.preventDefault();
});
$("#md").addEventListener("pointermove", (e) => {
  if (!pt) return;
  const el = document.elementFromPoint(e.clientX, e.clientY),
    c = el && el.closest(".cell");
  if (!c) return;
  const g = c.closest(".gw");
  if (+g.dataset.i !== pt.i || +g.dataset.k !== pt.k) return;
  setAvailabilityCell(c, +c.dataset.x);
});
addEventListener("pointerup", () => {
  if (pt) {
    pt = null;
    refreshTeacherViews();
  }
});
updateTotalsAndTeacherCards();

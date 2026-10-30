// -----------------------------------------------------------------------------
// Timetable validation, assignment, and search
// -----------------------------------------------------------------------------
const msg = (t, c = "err") => {
  $("#msg").innerHTML = `<p class="${c}">${t}</p>`;
  return 0;
};
function generateTimetable() {
  // Hide any previous result while validating or generating new settings.
  $("#out").innerHTML = "";
  $("#out").style.display = "none";
  $("#pb").hidden = true;
  // Read weekly hours and merge civics into the history/geography lesson.
  const L = +$("#ml").value || 24,
    HY = SUB.map((_, i) => hy(i));
  const hc = CL.map((_, c) => HY.map((h) => h[c >> 1])),
    Hc = hc.map((a) => a.reduce((x, y) => x + y, 0)),
    hT = hc.map((a) => a.map((v, i) => (i == 6 ? v + a[8] : v))),
    HYT = HY.map((h, i) => (i == 6 ? h.map((v, y) => v + HY[8][y]) : h));
  if (Hc.some((x) => x < 5 || x > 32))
    return msg(
      "لا يمكن ملء الحصة الأولى يوميا بهذا المجموع: يجب أن يكون لكل قسم 5 حصص أسبوعيا على الأقل (حصة يوميا)، وبحد أقصى 32 حصة بسبب توقف الدراسة الثلاثاء بعد الظهر.",
    );
  // Give every class one first-period lesson each day, then distribute its
  // remaining hours across the week without exceeding the shorter Tuesday.
  // Every day's lessons occupy one uninterrupted block from period 1 onward.
  const len = Hc.map((H) => {
    const daily = [1, 1, 1, 1, 1];
    const capacity = [7, 7, 4, 7, 7];
    let remaining = H - daily.reduce((sum, hours) => sum + hours, 0);
    while (remaining > 0) {
      let advanced = false;
      for (let d = 0; d < 5 && remaining > 0; d++) {
        if (daily[d] < capacity[d]) {
          daily[d]++;
          remaining--;
          advanced = true;
        }
      }
      if (!advanced) break;
    }
    return daily;
  });
  const T = [];
  const ts = SUB.map(() => []);
  const pairedCoreTeacherIds = new Map();
  const personAvailability = [];
  const personLoad = [];
  SUB.forEach((sb, i) => {
    if (i == 8 || !HYT[i].some((x) => x)) return;
    TN[i].forEach((o) => {
      const normalizedName = o.n.trim().toLocaleLowerCase();
      const isPairedCoreSubject = i === 0 || i === 7;
      let personId;

      if (isPairedCoreSubject && pairedCoreTeacherIds.has(normalizedName)) {
        personId = pairedCoreTeacherIds.get(normalizedName);
        personAvailability[personId] = personAvailability[personId].map(
          (unavailable, slot) => unavailable || o.off[slot],
        );
      } else {
        personId = personAvailability.length;
        personAvailability.push(o.off.slice());
        personLoad.push(0);
        if (isPairedCoreSubject) {
          pairedCoreTeacherIds.set(normalizedName, personId);
        }
      }

      const t = {
        name: o.n,
        sub: i,
        load: 0,
        id: T.length,
        personId,
        off: o.off.slice(),
        cl: o.cl.slice(),
        av: o.off.filter((v) => !v).length,
      };
      T.push(t);
      ts[i].push(t);
    });
  });
  T.forEach((teacher) => {
    teacher.off = personAvailability[teacher.personId].slice();
    teacher.av = teacher.off.filter((unavailable) => !unavailable).length;
  });
  // Check teacher counts, availability, and per-class subject assignments.
  const bad = [];
  SUB.forEach((sb, i) => {
    if (i != 8 && HYT[i].some((x) => x) && ts[i].length < minT(HYT[i], L))
      bad.push(
        `${LBL(i)}: المطلوب ${minT(HYT[i], L)} على الأقل، المُدخل ${ts[i].length}`,
      );
  });
  if (bad.length) return msg("عدد الأساتذة غير كافٍ:\n" + bad.join("\n"));
  const errs = [];
  // Check availability across every period when students have classes.
  const feas = (t, c) => {
    let m = 0;
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < (d === 2 ? 4 : 7); s++) {
        if (!personAvailability[t.personId][d * 7 + s]) m++;
      }
    }
    return m;
  };
  const cap = (t) => Math.min(L, t.av) - personLoad[t.personId];
  // Assign each class and subject to an eligible teacher before placing lessons.
  const tOf = CL.map(() => []),
    cls = {};
  SUB.forEach((sb, i) => {
    if (i == 8 || !ts[i].length) return;
    [...CL.keys()]
      .filter((c) => hT[c][i] > 0)
      .sort(
        (a, b) =>
          ts[i].filter((t) => t.cl[a]).length -
            ts[i].filter((t) => t.cl[b]).length || hT[b][i] - hT[a][i],
      )
      .forEach((c) => {
        const h = hT[c][i],
          cd = ts[i].filter((t) => t.cl[c]);
        if (!cd.length) {
          const k = `مادة «${LBL(i)}»: لا يوجد أستاذ مُعيَّن للأقسام التالية (استعمل زر «الأقسام» عند الأستاذ): `;
          (cls[k] = cls[k] || []).push(CL[c]);
          return;
        }
        const ok = cd.filter((t) => feas(t, c) >= h && cap(t) >= h);
        if (!ok.length) {
          const fe = cd.filter((t) => feas(t, c) >= h);
          if (!fe.length) {
            const b = cd.reduce((a, t) => (feas(t, c) > feas(a, c) ? t : a)),
              k = `مادة «${LBL(i)}» تحتاج ${h} ساعة أسبوعيا لكل قسم، بينما لا تسمح أوقات عدم توفر أساتذتها إلا بـ ${feas(b, c)} ساعة كحد أقصى (الأقرب: ${b.name})، وذلك في الأقسام: `;
            (cls[k] = cls[k] || []).push(CL[c]);
          } else
            errs.push(
              `مادة «${LBL(i)}»: الأساتذة المُعيَّنون للقسم «${CL[c]}» لا يكفي حجمهم الساعي (الحد الأقصى ${L} ساعة وأوقات عدم التوفر). وزّع الأقسام على أساتذة آخرين أو أضف أستاذا.`,
            );
          return;
        }
        const t = ok.reduce((a, b) => (cap(b) > cap(a) ? b : a));
        t.load += h;
        personLoad[t.personId] += h;
        tOf[c][i] = t.id;
        if (i == 6) tOf[c][8] = t.id;
      });
  });
  // A teacher may individually have enough periods for each assigned class,
  // while the combined assignments still exceed their shared timetable slots.
  // Check that aggregate limit before launching the expensive search.
  if (!errs.length && !Object.keys(cls).length) {
    const needsByTeacher = new Map();
    CL.forEach((_, c) =>
      SUB.forEach((_, i) => {
        if (i === 8 || hT[c][i] <= 0 || tOf[c][i] === undefined) return;
        const teacher = T[tOf[c][i]];
        let need = needsByTeacher.get(teacher.personId);
        if (!need) {
          need = { teacher, hours: 0, classes: new Set(), subjects: new Set() };
          needsByTeacher.set(teacher.personId, need);
        }
        need.hours += hT[c][i];
        need.classes.add(c);
        need.subjects.add(LBL(i));
      }),
    );
    for (const [personId, need] of needsByTeacher) {
      const availableSlots = new Set();
      for (const c of need.classes) {
        for (let d = 0; d < 5; d++) {
          for (let s = 0; s < (d === 2 ? 4 : 7); s++) {
            const slot = d * 7 + s;
            if (!personAvailability[personId][slot]) availableSlots.add(slot);
          }
        }
      }
      const capacity = Math.min(L, availableSlots.size);
      if (need.hours > capacity) {
        const classNames = [...need.classes].map((c) => CL[c]).join("، ");
        const slotList = [...availableSlots]
          .sort((a, b) => a - b)
          .map((slot) => `${DAYS[Math.floor(slot / 7)]} ${PER[slot % 7]}`)
          .join("، ");
        errs.push(
          `الأستاذ ${need.teacher.name} (${[...need.subjects].join("، ")}): يحتاج إلى ${need.hours} حصص أسبوعيا للأقسام ${classNames}، لكن لديه ${capacity} فترات صالحة فقط ضمن دوامها (عجز ${need.hours - capacity}). فتراته الصالحة: ${slotList || "لا توجد"}. أعد توزيع قسم أو أكثر، أو زد فترات توفره.`,
        );
      }
    }
  }
  errs.push(...Object.entries(cls).map(([k, v]) => k + v.join("، ") + "."));
  if (errs.length)
    return msg(
      "لا يمكن إنجاز الجدول للأسباب التالية:\n" + [...new Set(errs)].join("\n"),
    );
  const templateErrors = validateTimetable(
    DEFAULT_FEASIBLE_TIMETABLE,
    T,
    tOf,
    hT,
    L,
  );
  if (!templateErrors.length) {
    renderTimetables(DEFAULT_FEASIBLE_TIMETABLE, T, tOf);
    msg("تم توليد الجدول بنجاح ✔", "ok");
    return 0;
  }
  // Search for a valid arrangement after teacher and class assignments pass.
  msg("جاري التوليد...", "ok");
  setTimeout(() => {
    const t0 = performance.now();
    let timetable = null;
    while (!timetable && performance.now() - t0 < 25000) {
      // Backtracking search: place every active class into each required slot.
      const slots = [];
      for (let d = 0; d < 5; d++)
        for (let s = 0; s < (d === 2 ? 4 : 7); s++) {
          const act = CL.map((_, c) => c).filter((c) => s < len[c][d]);
          if (act.length) slots.push([d, s, act]);
        }
      const g = CL.map(() =>
          Array.from({ length: 5 }, () => Array(7).fill(-1)),
        ),
        rem = hc.map((a) => a.slice()),
        busy = personAvailability.map(() =>
          Array.from({ length: 5 }, () => Array(7).fill(0)),
        ),
        dc = CL.map(() => Array.from({ length: 5 }, () => Array(NS).fill(0)));
      const tr = personAvailability.map(() => 0);
      CL.forEach((_, c) =>
        SUB.forEach((_, i) => {
          if (hc[c][i] > 0) {
            const teacher = T[tOf[c][i]];
            tr[teacher.personId] += hc[c][i];
          }
        }),
      );
      const avF = personAvailability.map((availability) => {
        const a = Array(slots.length + 1).fill(0);
        for (let k = slots.length - 1; k >= 0; k--)
          a[k] =
            a[k + 1] + (availability[slots[k][0] * 7 + slots[k][1]] ? 0 : 1);
        return a;
      });
      let nodes = 0;
      const cands = (c, d, s, si) => {
        const r = [];
        // Finish a PE pair in the next period once its first lesson is placed.
        if (s > 0 && s !== 4 && g[c][d][s - 1] === 10) {
          const teacherId = tOf[c][10];
          const personId = T[teacherId].personId;
          if (busy[personId][d][s] || personAvailability[personId][d * 7 + s])
            return r;
          return [[1000, 10]];
        }
        for (let i = 0; i < NS; i++) {
          if (rem[c][i] <= 0) continue;
          if (i === 10) {
            const pairStarts = [0, 1, 2, 4, 5];
            const nextPeriod = s + 1;
            const nextSlot = d * 7 + nextPeriod;
            if (
              rem[c][10] !== 2 ||
              !pairStarts.includes(s) ||
              nextPeriod >= len[c][d] ||
              personAvailability[T[tOf[c][10]].personId][nextSlot]
            ) continue;
          }
          const tid = tOf[c][i];
          const personId = T[tid].personId;
          const bt = busy[personId][d];
          if (bt[s] || personAvailability[personId][d * 7 + s]) continue;
          r.push([
            (tr[personId] / Math.max(1, avF[personId][si])) * 6 +
              (rem[c][i] * 2) / (5 - d) +
              rem[c][i] * 0.3 +
              (CORE[i] && s < 4 ? 1 : 0) +
              (s > 0 && bt[s - 1] ? 1.5 : 0) +
              Math.random() * 2,
            i,
          ]);
        }
        return r.sort((a, b) => b[0] - a[0]);
      };
      const fill = (si, left) => {
        if (!left.length) return rec(si + 1);
        const [d, s] = slots[si];
        let bc = -1,
          best = null;
        for (const c of left) {
          const cd = cands(c, d, s, si);
          if (!cd.length) return false;
          if (!best || cd.length < best.length) {
            best = cd;
            bc = c;
          }
        }
        if (++nodes > 20000) throw 0;
        const nl = left.filter((x) => x !== bc);
        for (const [, i] of best) {
          const t = tOf[bc][i];
          const personId = T[t].personId;
          g[bc][d][s] = i;
          rem[bc][i]--;
          dc[bc][d][i]++;
          tr[personId]--;
          busy[personId][d][s] = 1;
          if (fill(si, nl)) return true;
          g[bc][d][s] = -1;
          rem[bc][i]++;
          dc[bc][d][i]--;
          tr[personId]++;
          busy[personId][d][s] = 0;
        }
        return false;
      };
      const rec = (si) => {
        if (si == slots.length) return true;
        const [d, s] = slots[si];
        for (let teacher = 0; teacher < personAvailability.length; teacher++) {
          if (tr[teacher] > avF[teacher][si]) return false;
        }
        for (let c = 0; c < CL.length; c++) {
          const remainingClassSlots = slots
            .slice(si)
            .filter(([, , activeClasses]) => activeClasses.includes(c)).length;
          for (let i = 0; i < NS; i++) {
            if (rem[c][i] > remainingClassSlots) return false;
          }
        }
        return fill(si, slots[si][2].slice());
      };
      try {
        if (rec(0)) timetable = g;
      } catch (e) {}
    }
    if (!timetable) {
      return msg(
        "لم يُعثر على جدول ضمن مهلة البحث بعد تغيّر الإعدادات. الجدول الجاهز لم يعد صالحا لهذه الإعدادات للأسباب التالية:\n" +
          templateErrors.slice(0, 8).join("\n") +
          (templateErrors.length > 8 ? "\nوأسباب أخرى." : "") +
          "\nهذا يعني أن البحث لم يجد حلا في المهلة، ولا يثبت وحده استحالة الجدول. راجع الأسباب المذكورة أو أعد المحاولة.",
      );
    }
    const validationErrors = validateTimetable(timetable, T, tOf, hT, L);
    if (validationErrors.length) {
      return msg(
        "أوقف البرنامج عرض الجدول لأن التحقق النهائي وجد أخطاء:\n" +
          validationErrors.slice(0, 12).join("\n"),
      );
    }
    renderTimetables(timetable, T, tOf);
    msg("تم توليد الجدول بنجاح ✔", "ok");
  }, 30);
}
function validateTimetable(g, T, tOf, requiredHours, maxTeacherHours) {
  const problems = [];
  if (!Array.isArray(g) || g.length !== CL.length) {
    return ["عدد جداول الأقسام لا يطابق عدد الأقسام."];
  }
  const counts = CL.map(() => Array(NS).fill(0));
  const teacherLoads = new Map();
  for (let c = 0; c < CL.length; c++) {
    if (!Array.isArray(g[c]) || g[c].length !== 5) {
      problems.push(`${CL[c]}: يجب أن يحتوي الجدول على خمسة أيام.`);
      continue;
    }
    for (let d = 0; d < 5; d++) {
      const day = g[c][d];
      if (!Array.isArray(day) || day.length !== 7) {
        problems.push(`${CL[c]}، ${DAYS[d]}: يجب أن يحتوي اليوم على سبع فترات.`);
        continue;
      }
      let lessonsToday = 0;
      let firstLesson = -1;
      let lastLesson = -1;
      if (day[0] === -1) {
        problems.push(`${CL[c]}، ${DAYS[d]}: يجب أن تبدأ الدراسة بالحصة الأولى.`);
      }
      for (let s = 0; s < 7; s++) {
        const subject = day[s];
        if (d === 2 && s >= 4 && subject !== -1) {
          problems.push(`${CL[c]}، ${DAYS[d]}، ${PER[s]}: لا توجد دراسة يوم الثلاثاء بعد الظهر.`);
        }
        if (subject === -1) continue;
        lessonsToday++;
        if (firstLesson < 0) firstLesson = s;
        lastLesson = s;
        if (!Number.isInteger(subject) || subject < 0 || subject >= NS) {
          problems.push(`${CL[c]}، ${DAYS[d]}، ${PER[s]}: رمز المادة غير صالح.`);
          continue;
        }
        if (!(requiredHours[c][subject] > 0)) {
          problems.push(`${CL[c]}، ${DAYS[d]}، ${PER[s]}: مادة ${LBL(subject)} ليست مطلوبة لهذا القسم.`);
          continue;
        }
        counts[c][subject]++;
        const teacherId = tOf[c][subject];
        const teacher = T[teacherId];
        if (!teacher || !teacher.cl[c]) {
          problems.push(`${CL[c]}، ${DAYS[d]}، ${PER[s]}: لا يوجد أستاذ مسند لمادة ${LBL(subject)}.`);
          continue;
        }
        const slot = d * 7 + s;
        if (teacher.off[slot]) {
          problems.push(`${teacher.name}: حصة ${LBL(subject)} في ${CL[c]} تقع ضمن وقت عدم توفره (${DAYS[d]}، ${PER[s]}).`);
        }
        const key = `${teacher.personId}:${slot}`;
        if (teacherLoads.has(key)) {
          problems.push(`${teacher.name}: حصتان متزامنتان في ${DAYS[d]}، ${PER[s]} للقسمين ${teacherLoads.get(key)} و${CL[c]}.`);
        } else {
          teacherLoads.set(key, CL[c]);
        }
        const load = (teacherLoads.get(`load:${teacher.personId}`) || 0) + 1;
        teacherLoads.set(`load:${teacher.personId}`, load);
      }
      if (!lessonsToday) {
        problems.push(`${CL[c]}: لا توجد أي حصة يوم ${DAYS[d]}.`);
      } else {
        for (let s = firstLesson; s < lastLesson; s++) {
          if (day[s] === -1) {
            problems.push(`${CL[c]}، ${DAYS[d]}: توجد فترة فارغة بين حصتين.`);
            break;
          }
        }
      }
    }
    for (let subject = 0; subject < NS; subject++) {
      const expected = requiredHours[c][subject];
      if (counts[c][subject] !== expected) {
        problems.push(`${CL[c]}، ${LBL(subject)}: المطلوب ${expected} حصص، والجدول يحتوي ${counts[c][subject]}.`);
      }
    }
    const sportLessons = [];
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 7; s++) {
        if (g[c][d][s] === 10) sportLessons.push([d, s]);
      }
    }
    sportLessons.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (
      requiredHours[c][10] !== 2 ||
      sportLessons.length !== 2 ||
      sportLessons[0][0] !== sportLessons[1][0] ||
      sportLessons[1][1] !== sportLessons[0][1] + 1 ||
      ![0, 1, 2, 4, 5].includes(sportLessons[0][1])
    ) {
      problems.push(`${CL[c]}، ${LBL(10)}: يجب جدولة ساعتين متتاليتين في اليوم نفسه، دون عبور فترة الغداء.`);
    }
  }
  for (const teacher of T) {
    const load = teacherLoads.get(`load:${teacher.personId}`) || 0;
    if (load > maxTeacherHours) {
      problems.push(`${teacher.name}: لديه ${load} حصص، والحد الأسبوعي المحدد ${maxTeacherHours}.`);
    }
  }
  return [...new Set(problems)];
}
// -----------------------------------------------------------------------------
// Printable timetable output
// -----------------------------------------------------------------------------
function downloadPdf(k) {
  document.body.className = "p" + k;
  const done = () => {
    document.body.className = "";
    removeEventListener("afterprint", done);
  };
  addEventListener("afterprint", done);
  print();
}
function renderTimetables(g, T, tOf) {
  window.LAST = { g, T, tOf };
  const schoolName = $("#sch").value,
    yr = $("#yr").value;
  const tbl = (k, title, f) => {
    let r = `<div class="sheet" data-k="${k}"><h2>${schoolName} — ${yr}<br>${title}</h2><div class="sc"><table class="tt"><tr><th>الحصة</th>${DAYS.map((d) => `<th>${d}</th>`).join("")}</tr>`;
    PER.forEach((p, s) => {
      r +=
        `<tr><th>${p}</th>` +
        DAYS.map((_, d) => f(d, s) || "<td></td>").join("") +
        "</tr>";
      if (s == 1)
        r += '<tr class="br"><td colspan="6">استراحة 10:15 - 10:30</td></tr>';
      if (s == 3)
        r +=
          '<tr class="br"><td colspan="6">فترة الغداء 12:30 - 13:15</td></tr>';
    });
    return r + "</table></div></div>";
  };
  const col = (i) => `style="background:hsl(${i * 27} 70% 88%)"`;
  let o = "";
  CL.forEach(
    (n, c) =>
      (o += tbl("c", n, (d, s) => {
        const i = g[c][d][s];
        return i < 0
          ? '<td class="free">لا توجد حصة</td>'
          : `<td ${col(i)}><b>${SUB[i][0]}</b><br><small>${T[tOf[c][i]].name}</small></td>`;
      })),
  );
  const teachersByPerson = new Map();
  T.forEach((teacher) => {
    if (!teachersByPerson.has(teacher.personId)) {
      teachersByPerson.set(teacher.personId, []);
    }
    teachersByPerson.get(teacher.personId).push(teacher);
  });
  teachersByPerson.forEach((teachers, personId) => {
    const teacher = teachers[0];
    const subjects = [...new Set(teachers.map((entry) => LBL(entry.sub)))];
    const weeklyLoad = teachers.reduce((total, entry) => total + entry.load, 0);
    o += tbl(
      "t",
      `الأستاذ: ${teacher.name} (${subjects.join("، ")}) — ${weeklyLoad} ساعة أسبوعيا`,
      (d, s) => {
        for (let c = 0; c < CL.length; c++) {
          const i = g[c][d][s];
          if (i >= 0 && T[tOf[c][i]].personId === personId) {
            return `<td ${col(i)}><b>${CL[c]}</b><br><small>${SUB[i][0]}</small></td>`;
          }
        }
        return teacher.off[d * 7 + s]
          ? '<td style="background:#e6e6e6;color:#666">غير متاح</td>'
          : '<td class="free">متاح</td>';
      },
    );
  });
  $("#out").innerHTML = o;
  $("#out").style.display = "block";
  $("#pb").hidden = false;
  $("#out").scrollIntoView({ behavior: "smooth", block: "start" });
}

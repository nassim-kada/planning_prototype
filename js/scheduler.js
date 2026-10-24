// -----------------------------------------------------------------------------
// Timetable validation, assignment, and search
// -----------------------------------------------------------------------------
const msg = (t, c = "err") => {
  $("#msg").innerHTML = `<p class="${c}">${t}</p>`;
  return 0;
};
function generateTimetable() {
  // Read weekly hours and merge civics into the history/geography lesson.
  const L = +$("#ml").value || 24,
    HY = SUB.map((_, i) => hy(i));
  const hc = CL.map((_, c) => HY.map((h) => h[c >> 1])),
    Hc = hc.map((a) => a.reduce((x, y) => x + y, 0)),
    hT = hc.map((a) => a.map((v, i) => (i == 6 ? v + a[8] : v))),
    HYT = HY.map((h, i) => (i == 6 ? h.map((v, y) => v + HY[8][y]) : h));
  if (Hc.some((x) => x < 1 || x > 35))
    return msg("مجموع الساعات الأسبوعية لكل سنة يجب أن يكون بين 1 و 35");
  const len = Hc.map((H) =>
    [0, 1, 2, 3, 4].map((d) => Math.floor(H / 5) + (d < H % 5 ? 1 : 0)),
  );
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
  for (let d = 0; d < 5; d++) {
    const w = [];
    for (let s = 0; s < 7; s++) {
      const act = CL.filter((_, c) => s < len[c][d]).length,
        av = personAvailability.filter(
          (availability) => !availability[d * 7 + s],
        ).length;
      if (av < act) w.push(`${PER[s]} (يلزم ${act} أساتذة والمتاحون ${av})`);
    }
    if (w.length)
      errs.push(
        `يوم ${DAYS[d]}: عدد الأساتذة المتاحين أقل من عدد الأقسام التي تدرس في وقت واحد، في الحصص: ${w.join("، ")}. قلّل أوقات عدم التوفر في هذه الأوقات أو أضف أساتذة.`,
      );
  }
  // Estimate available lessons within this class's scheduled periods.
  const feas = (t, c) => {
    let m = 0;
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < len[c][d]; s++) {
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
  errs.push(...Object.entries(cls).map(([k, v]) => k + v.join("، ") + "."));
  if (errs.length)
    return msg(
      "لا يمكن إنجاز الجدول للأسباب التالية:\n" + [...new Set(errs)].join("\n"),
    );
  // Search for a valid arrangement after teacher and class assignments pass.
  msg("جاري التوليد...", "ok");
  setTimeout(() => {
    const t0 = performance.now();
    let timetable = null;
    while (!timetable && performance.now() - t0 < 25000) {
      // Backtracking search: place every active class into each required slot.
      const slots = [];
      for (let d = 0; d < 5; d++)
        for (let s = 0; s < 7; s++) {
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
        for (let i = 0; i < NS; i++) {
          if (rem[c][i] <= 0) continue;
          const n = dc[c][d][i],
            tid = tOf[c][i];
          const personId = T[tid].personId;
          const bt = busy[personId][d];
          if (bt[s] || personAvailability[personId][d * 7 + s]) continue;
          if (s > 0 && !bt[s - 1]) {
            let e = 0;
            for (let k = s < 4 ? 0 : 4; k < s; k++)
              if (bt[k]) {
                e = 1;
                break;
              }
            if (e) continue;
          }
          if (n == 1 && (s == 0 || s == 4 || g[c][d][s - 1] != i)) continue;
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
      const w = SUB.map((sb, i) => {
        const D = hT.reduce((a, x) => a + x[i], 0),
          cp = ts[i].reduce((a, t) => a + Math.min(L, t.av), 0);
        return { sb: [LBL(i)], D, cp, r: cp ? D / cp : 0, i };
      })
        .filter((x) => x.D > 0 && x.i != 8)
        .sort((a, b) => b.r - a.r)[0];
      return msg(
        `لا يمكن إنجاز الجدول مع كل الشروط (لا انقطاع للأستاذ وأوقات عدم التوفر). السبب الأرجح: مادة «${w.sb[0]}» تحتاج ${w.D} ساعة أسبوعيا بينما يغطي أساتذتها ${w.cp} ساعة فقط، فلا تتسع حصصها في الأوقات المتاحة. أضف أستاذا لهذه المادة أو قلّل أوقات عدم التوفر ثم أعد المحاولة.`,
      );
    }
    renderTimetables(timetable, T, tOf);
    msg("تم توليد الجدول بنجاح ✔ — " + T.length + " أستاذ", "ok");
  }, 30);
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
          ? ""
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
          : "";
      },
    );
  });
  $("#out").innerHTML = o;
  $("#pb").hidden = false;
}

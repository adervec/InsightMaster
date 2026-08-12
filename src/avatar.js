/* ==================================================================
   AVATAR — an optional 3D figure that performs the practice while you
   time it. No WebGL and no libraries: joints are 3D points, rotated and
   perspective-projected into an SVG every frame.

   The poses below are neutral body mechanics (anatomy, not tradition).
   Which poses a given practice performs, and in what order, is CONTENT:
   packs supply avatarClips / avatarByEx / avatarDefaultsByMega.
   ================================================================== */

// joint -> [x, y, z] in centimetres; y is up, z is forward, origin on the floor
const AV_POSES = {
  stand: {
    head: [0, 160, 0], neck: [0, 145, 0], chest: [0, 125, 0], pelvis: [0, 92, 0],
    shL: [-18, 142, 0], elL: [-20, 118, 0], haL: [-21, 95, 0],
    shR: [18, 142, 0], elR: [20, 118, 0], haR: [21, 95, 0],
    hiL: [-10, 90, 0], knL: [-10, 45, 1], ftL: [-10, 0, 2],
    hiR: [10, 90, 0], knR: [10, 45, 1], ftR: [10, 0, 2],
  },
  reachUp: {
    head: [0, 158, 4], neck: [0, 145, 2], chest: [0, 125, 0], pelvis: [0, 92, 0],
    shL: [-18, 143, 0], elL: [-22, 163, 0], haL: [-15, 186, 0],
    shR: [18, 143, 0], elR: [22, 163, 0], haR: [15, 186, 0],
    hiL: [-10, 90, 0], knL: [-10, 45, 1], ftL: [-10, 0, 2],
    hiR: [10, 90, 0], knR: [10, 45, 1], ftR: [10, 0, 2],
  },
  hinge: { // folded forward at the hips, arms hanging
    head: [0, 84, 58], neck: [0, 92, 50], chest: [0, 101, 32], pelvis: [0, 90, 2],
    shL: [-18, 98, 47], elL: [-19, 71, 45], haL: [-17, 46, 41],
    shR: [18, 98, 47], elR: [19, 71, 45], haR: [17, 46, 41],
    hiL: [-10, 89, 0], knL: [-10, 45, 3], ftL: [-10, 0, 2],
    hiR: [10, 89, 0], knR: [10, 45, 3], ftR: [10, 0, 2],
  },
  pushupTop: { // straight line from heels to head, arms vertical
    head: [0, 44, 66], neck: [0, 42, 54], chest: [0, 38, 40], pelvis: [0, 32, 2],
    shL: [-18, 40, 52], elL: [-18, 20, 57], haL: [-18, 0, 60],
    shR: [18, 40, 52], elR: [18, 20, 57], haR: [18, 0, 60],
    hiL: [-10, 30, 0], knL: [-10, 19, -34], ftL: [-10, 8, -68],
    hiR: [10, 30, 0], knR: [10, 19, -34], ftR: [10, 8, -68],
  },
  archBack: { // hips low, chest lifted, arms straight
    head: [0, 73, 44], neck: [0, 63, 38], chest: [0, 50, 32], pelvis: [0, 18, 6],
    shL: [-18, 55, 42], elL: [-18, 28, 44], haL: [-18, 0, 45],
    shR: [18, 55, 42], elR: [18, 28, 44], haR: [18, 0, 45],
    hiL: [-10, 15, 2], knL: [-10, 8, -40], ftL: [-10, 3, -74],
    hiR: [10, 15, 2], knR: [10, 8, -40], ftR: [10, 3, -74],
  },
  pikeInverted: { // hips high, hands and feet on the floor
    head: [0, 60, 30], neck: [0, 67, 22], chest: [0, 64, 26], pelvis: [0, 88, -6],
    shL: [-18, 58, 34], elL: [-18, 29, 45], haL: [-18, 0, 55],
    shR: [18, 58, 34], elR: [18, 29, 45], haR: [18, 0, 55],
    hiL: [-10, 86, -8], knL: [-11, 47, -38], ftL: [-11, 3, -57],
    hiR: [10, 86, -8], knR: [11, 47, -38], ftR: [11, 3, -57],
  },
  crossLegged: {
    head: [0, 74, 0], neck: [0, 60, 0], chest: [0, 43, 0], pelvis: [0, 11, -3],
    shL: [-17, 57, 0], elL: [-22, 38, 6], haL: [-15, 21, 15],
    shR: [17, 57, 0], elR: [22, 38, 6], haR: [15, 21, 15],
    hiL: [-10, 11, -4], knL: [-26, 7, 15], ftL: [7, 6, 17],
    hiR: [10, 11, -4], knR: [26, 7, 15], ftR: [-7, 6, 19],
  },
  kneelSit: {
    head: [0, 88, 0], neck: [0, 74, 0], chest: [0, 57, 0], pelvis: [0, 26, -6],
    shL: [-17, 71, 0], elL: [-21, 51, 4], haL: [-16, 33, 12],
    shR: [17, 71, 0], elR: [21, 51, 4], haR: [16, 33, 12],
    hiL: [-10, 25, -6], knL: [-11, 8, 22], ftL: [-11, 5, -14],
    hiR: [10, 25, -6], knR: [11, 8, 22], ftR: [11, 5, -14],
  },
  supine: { // lying on the back
    head: [0, 7, -72], neck: [0, 7, -62], chest: [0, 8, -45], pelvis: [0, 9, -12],
    shL: [-17, 8, -58], elL: [-24, 6, -38], haL: [-27, 5, -18],
    shR: [17, 8, -58], elR: [24, 6, -38], haR: [27, 5, -18],
    hiL: [-10, 9, -10], knL: [-11, 8, 25], ftL: [-11, 6, 60],
    hiR: [10, 9, -10], knR: [11, 8, 25], ftR: [11, 6, 60],
  },
  tableTop: { // hands and knees
    head: [0, 62, 52], neck: [0, 62, 42], chest: [0, 60, 30], pelvis: [0, 58, -12],
    shL: [-17, 60, 34], elL: [-17, 30, 36], haL: [-17, 0, 38],
    shR: [17, 60, 34], elR: [17, 30, 36], haR: [17, 0, 38],
    hiL: [-10, 57, -14], knL: [-11, 28, -20], ftL: [-11, 4, -34],
    hiR: [10, 57, -14], knR: [11, 28, -20], ftR: [11, 4, -34],
  },
};

const AV_BONES = [
  ['pelvis', 'chest', 7], ['chest', 'neck', 6], ['neck', 'head', 5],
  ['shL', 'shR', 5], ['chest', 'shL', 5], ['chest', 'shR', 5],
  ['shL', 'elL', 5], ['elL', 'haL', 4], ['shR', 'elR', 5], ['elR', 'haR', 4],
  ['pelvis', 'hiL', 5], ['pelvis', 'hiR', 5],
  ['hiL', 'knL', 6], ['knL', 'ftL', 5], ['hiR', 'knR', 6], ['knR', 'ftR', 5],
];

// generic motions the app ships with — no tradition attached
const AV_CLIPS_BUILTIN = {
  still: { breath: 1, period: 8, loop: [{ pose: 'stand', in: 1.2, hold: 7 }] },
  seated: { breath: 1, period: 9, loop: [{ pose: 'crossLegged', in: 1.5, hold: 9 }] },
  rest: { breath: 0.8, period: 11, loop: [{ pose: 'supine', in: 2, hold: 10 }] },
};

const AV_REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function avClips() { return Object.assign({}, AV_CLIPS_BUILTIN, IH_C.avatarClips || {}); }

/* which motion a practice performs — the mapping lives in the content pack */
function avClipFor(exId, varId) {
  const all = avClips();
  const byEx = IH_C.avatarByEx || {};
  const name = (varId && byEx[exId + '/' + varId]) || byEx[exId]
    || (IH_C.avatarDefaultsByMega || {})[(exFor(exId) || {}).mega];
  const clip = all[name] || AV_CLIPS_BUILTIN.still;
  return clip.loop && clip.loop.length ? clip : AV_CLIPS_BUILTIN.still;
}

/* pose at time t seconds into a looping clip, blended between keyframes */
function avPoseAt(clip, t) {
  const loop = clip.loop;
  const total = loop.reduce((s, k) => s + (k.in || 0) + (k.hold || 0), 0) || 1;
  if (AV_REDUCED) return AV_POSES[loop[0].pose] || AV_POSES.stand;
  let u = ((t % total) + total) % total;
  for (let i = 0; i < loop.length; i++) {
    const k = loop[i];
    const from = AV_POSES[loop[(i - 1 + loop.length) % loop.length].pose] || AV_POSES.stand;
    const to = AV_POSES[k.pose] || AV_POSES.stand;
    const tin = k.in || 0;
    if (u < tin) {
      const f = tin ? u / tin : 1;
      const e = f * f * (3 - 2 * f); // smoothstep, so poses ease rather than snap
      const out = {};
      for (const j in to) {
        const a = from[j] || to[j];
        out[j] = [a[0] + (to[j][0] - a[0]) * e, a[1] + (to[j][1] - a[1]) * e, a[2] + (to[j][2] - a[2]) * e];
      }
      return out;
    }
    u -= tin + (k.hold || 0);
    if (u < 0) return to;
  }
  return AV_POSES[loop[loop.length - 1].pose] || AV_POSES.stand;
}

/* Frame the camera on the whole clip, not one pose: a seated figure and a standing one
   should each fill the box, and the framing must not jump between keyframes. Uses the
   rotation-invariant radius so turning the figure never crops it. */
function avClipBounds(clip) {
  let r = 0, top = 0;
  for (const k of clip.loop) {
    const pose = AV_POSES[k.pose] || AV_POSES.stand;
    for (const j in pose) {
      const p = pose[j];
      r = Math.max(r, Math.sqrt(p[0] * p[0] + p[2] * p[2]));
      top = Math.max(top, p[1]);
    }
  }
  const s = 0.78, halfW = r * s * 1.25 + 10, h = top * s * 1.15 + 12;
  return { x: 100 - halfW, y: 186 - h, w: halfW * 2, h: h + 12 };
}

function avProject(p, yaw, pitch, s, cx, cy) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const x = p[0] * cyw + p[2] * syw;
  const zr = -p[0] * syw + p[2] * cyw;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y = p[1] * cp - zr * sp;
  const z = p[1] * sp + zr * cp;
  const k = 420 / (420 + z); // perspective divide
  return [cx + x * k * s, cy - y * k * s, z, k];
}

/* AV.mount(el, {exId, varId}) draws and animates until AV.stop() */
const AV = {
  // a 3/4 view from the side: forward motion (folds, planks) has to read as depth
  raf: 0, host: null, els: null, yaw: 1.05, pitch: 0.12, clip: null, t0: 0,

  mount(host, opts) {
    this.stop();
    this.host = host;
    this.clip = opts.clip || avClipFor(opts.exId, opts.varId);
    this.t0 = Date.now();
    const vb = avClipBounds(this.clip);
    // classes, not ids: an avatar can be mounted in the timer and the settings preview at once
    host.innerHTML = `
      <svg class="av-svg" viewBox="${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}" aria-hidden="true">
        <ellipse class="av-shadow" cx="100" cy="182" rx="34" ry="7" fill="#000" opacity="0.35"/>
        ${AV_BONES.map(() => '<line class="av-bone" stroke-linecap="round"/>').join('')}
        <circle class="av-head" r="9"/>
      </svg>
      <div class="av-caption"></div>`;
    this.els = {
      svg: host.querySelector('.av-svg'),
      shadow: host.querySelector('.av-shadow'),
      head: host.querySelector('.av-head'),
      caption: host.querySelector('.av-caption'),
      bones: [...host.querySelectorAll('.av-bone')],
    };
    // drag to orbit
    let dragX = null, yaw0 = 0;
    const down = (e) => { dragX = (e.touches ? e.touches[0] : e).clientX; yaw0 = this.yaw; };
    const move = (e) => {
      if (dragX === null) return;
      const x = (e.touches ? e.touches[0] : e).clientX;
      this.yaw = yaw0 + (x - dragX) * 0.012;
      if (e.cancelable) e.preventDefault();
    };
    const up = () => { dragX = null; };
    this.els.svg.addEventListener('pointerdown', down);
    this.els.svg.addEventListener('pointermove', move);
    this.els.svg.addEventListener('pointerup', up);
    this.els.svg.addEventListener('pointercancel', up);
    this.draw(0);
    if (!AV_REDUCED) this.loop();
    return this;
  },

  loop() {
    const step = () => {
      if (!this.host || !this.host.isConnected) return this.stop();
      this.draw((Date.now() - this.t0) / 1000);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },

  draw(t) {
    const clip = this.clip;
    const pose = avPoseAt(clip, t);
    // breath: chest and shoulders rise on the inhale, and drive the caption
    const period = clip.period || 8;
    const phase = AV_REDUCED ? 0 : Math.sin((t / period) * Math.PI * 2);
    const amp = (clip.breath === undefined ? 1 : clip.breath) * 2.6;
    const lifted = {};
    for (const j in pose) {
      const rise = (j === 'chest' || j === 'neck' || j === 'head' || j === 'shL' || j === 'shR') ? amp * phase : 0;
      lifted[j] = [pose[j][0], pose[j][1] + rise, pose[j][2] + rise * 0.4];
    }
    const pts = {};
    for (const j in lifted) pts[j] = avProject(lifted[j], this.yaw, this.pitch, 0.78, 100, 186);

    AV_BONES.forEach((b, i) => {
      const a = pts[b[0]], c = pts[b[1]];
      const el = this.els.bones[i];
      if (!a || !c) return;
      el.setAttribute('x1', a[0].toFixed(1)); el.setAttribute('y1', a[1].toFixed(1));
      el.setAttribute('x2', c[0].toFixed(1)); el.setAttribute('y2', c[1].toFixed(1));
      const k = (a[3] + c[3]) / 2;
      el.setAttribute('stroke-width', (b[2] * k).toFixed(2));
      el.setAttribute('opacity', Math.max(0.45, Math.min(1, k)).toFixed(2)); // depth cue
    });
    const h = pts.head;
    this.els.head.setAttribute('cx', h[0].toFixed(1));
    this.els.head.setAttribute('cy', h[1].toFixed(1));
    this.els.head.setAttribute('r', (9 * h[3]).toFixed(1));
    // ground contact: screen y grows downwards, so the lowest point is the largest y
    let low = 0, sumX = 0, n = 0;
    for (const j in pts) { low = Math.max(low, pts[j][1]); sumX += pts[j][0]; n++; }
    this.els.shadow.setAttribute('cy', (low + 2).toFixed(1));
    this.els.shadow.setAttribute('cx', (sumX / n).toFixed(1));
    this.els.shadow.setAttribute('rx', (18 + 16 * Math.abs(Math.sin(this.yaw))).toFixed(1));
    if (this.els.caption) {
      this.els.caption.textContent = AV_REDUCED || clip.breath === 0 ? ''
        : (Math.cos((t / period) * Math.PI * 2) > 0 ? 'Inhale' : 'Exhale');
    }
  },

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.host = null;
    this.els = null;
  },
};

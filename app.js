(async function boot() {
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js");

  const TAU = Math.PI * 2;
  const TRACK_WIDTH = 1.38;
  const LAPS = 2;
  const MAX_RACE_TIME = 42;
  const ROAD_SEGMENTS = 420;

  const slotDefs = [
    { id: "nose", label: "NOSE", x: 50, y: 15, mount: [0, 0.28, 0.8], scale: 1.08 },
    { id: "left", label: "LEFT", x: 20, y: 45, mount: [-0.48, 0.22, 0.05], scale: 0.94 },
    { id: "core", label: "CORE", x: 50, y: 45, mount: [0, 0.36, 0.08], scale: 1 },
    { id: "right", label: "RIGHT", x: 80, y: 45, mount: [0.48, 0.22, 0.05], scale: 0.94 },
    { id: "tail", label: "TAIL", x: 50, y: 76, mount: [0, 0.25, -0.76], scale: 1.08 },
    { id: "top", label: "TOP", x: 50, y: 31, mount: [0, 0.56, 0.26], scale: 0.86 }
  ];

  const parts = {
    empty: { mark: "·", name: "EMPTY", color: "#69737a", role: "core", stats: {} },
    booster: {
      mark: "↯",
      name: "BOOSTER",
      color: "#ffb84e",
      role: "speed",
      stats: { top: 0.42, accel: 0.16, boost: 0.92, grip: -0.12, stability: -0.16, mass: 0.18 }
    },
    roller: {
      mark: "◎",
      name: "ROLLER",
      color: "#55d8f0",
      role: "wall",
      stats: { wall: 0.88, grip: 0.12, stability: 0.08, top: -0.06, mass: 0.14 }
    },
    grip: {
      mark: "●",
      name: "GRIP",
      color: "#7ee081",
      role: "grip",
      stats: { grip: 0.78, accel: 0.16, top: -0.1, mass: 0.16 }
    },
    weight: {
      mark: "◆",
      name: "WEIGHT",
      color: "#9b8cff",
      role: "stability",
      stats: { stability: 0.72, wall: 0.2, top: -0.32, accel: -0.12, mass: 0.74 }
    },
    wing: {
      mark: "▱",
      name: "WING",
      color: "#f4df62",
      role: "air",
      stats: { air: 0.95, stability: 0.2, grip: 0.08, top: -0.06, mass: 0.1 }
    },
    bumper: {
      mark: "▰",
      name: "BUMPER",
      color: "#ff6461",
      role: "guard",
      stats: { toughness: 0.76, wall: 0.32, stability: 0.18, top: -0.08, mass: 0.24 }
    }
  };

  const paletteGroups = [
    { label: "RUN", ids: ["booster", "grip"] },
    { label: "STAY", ids: ["roller", "weight"] },
    { label: "JUMP", ids: ["wing", "bumper"] },
    { label: "CLEAR", ids: ["empty"] }
  ];

  const playerPresets = [
    makeBuild("Pocket Rocket", {
      nose: "bumper",
      left: "roller",
      core: "grip",
      right: "roller",
      tail: "booster",
      top: "wing"
    }),
    makeBuild("Boost Needle", {
      nose: "booster",
      left: "grip",
      core: "booster",
      right: "grip",
      tail: "booster",
      top: "wing"
    }),
    makeBuild("Wall Rider", {
      nose: "bumper",
      left: "roller",
      core: "weight",
      right: "roller",
      tail: "booster",
      top: "grip"
    }),
    makeBuild("Low Heavy", {
      nose: "bumper",
      left: "weight",
      core: "weight",
      right: "weight",
      tail: "booster",
      top: "roller"
    })
  ];

  const rivalPresets = [
    makeBuild("Red Comet", {
      nose: "booster",
      left: "grip",
      core: "booster",
      right: "grip",
      tail: "booster",
      top: "wing"
    }),
    makeBuild("Corner King", {
      nose: "bumper",
      left: "roller",
      core: "grip",
      right: "roller",
      tail: "booster",
      top: "weight"
    }),
    makeBuild("Stone Wall", {
      nose: "bumper",
      left: "weight",
      core: "weight",
      right: "weight",
      tail: "roller",
      top: "grip"
    })
  ];

  const featureZones = [
    { type: "boost", start: 0.02, end: 0.11, color: 0x55d8f0 },
    { type: "jump", start: 0.25, end: 0.32, color: 0xf4df62 },
    { type: "rough", start: 0.52, end: 0.64, color: 0x9b8cff },
    { type: "boost", start: 0.75, end: 0.84, color: 0xffb84e },
    { type: "wall", start: 0.88, end: 0.97, color: 0xff6461 }
  ];

  const els = {
    scene: document.querySelector("#scene"),
    garageMap: document.querySelector("#garageMap"),
    selectionReadout: document.querySelector("#selectionReadout"),
    builderTelemetry: document.querySelector("#builderTelemetry"),
    palette: document.querySelector("#palette"),
    presets: document.querySelector("#presets"),
    rivalSelect: document.querySelector("#rivalSelect"),
    raceBtn: document.querySelector("#raceBtn"),
    resetBtn: document.querySelector("#resetBtn"),
    exportBtn: document.querySelector("#exportBtn"),
    importBtn: document.querySelector("#importBtn"),
    codeBox: document.querySelector("#codeBox"),
    machineName: document.querySelector("#machineName"),
    raceState: document.querySelector("#raceState"),
    playerMeter: document.querySelector("#playerMeter"),
    rivalMeter: document.querySelector("#rivalMeter"),
    clock: document.querySelector("#clock"),
    resultLine: document.querySelector("#resultLine")
  };

  let playerBuild = clone(playerPresets[0]);
  let importedRival = null;
  let rivalBuild = clone(rivalPresets[0]);
  let selectedSlot = "tail";
  let playerMachine = null;
  let rivalMachine = null;
  let particles = [];
  let running = false;
  let raceTime = 0;
  let lastTick = performance.now();
  let cameraShake = 0;
  let dragState = null;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  els.scene.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x101417, 10, 26);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 80);
  const target = new THREE.Vector3(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xe9fbff, 0x171c1e, 2.6);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-4, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 24;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  scene.add(key);

  const track = createTrack();
  scene.add(track.group);

  initUi();
  resetRace();
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);

  function makeBuild(name, slotMap) {
    const slots = {};
    slotDefs.forEach((slot) => {
      slots[slot.id] = slotMap[slot.id] || "empty";
    });
    return { version: 1, name, slots };
  }

  function initUi() {
    renderGarage();
    renderPalette();
    renderPresets();
    renderRivals();

    els.garageMap.addEventListener("click", (event) => {
      const button = event.target.closest("[data-slot]");
      if (!button) return;
      selectedSlot = button.dataset.slot;
      renderGarage();
    });

    els.palette.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("[data-part]");
      if (!button) return;
      beginPartDrag(button.dataset.part, event);
    });

    els.presets.addEventListener("click", (event) => {
      const button = event.target.closest("[data-preset]");
      if (!button) return;
      playerBuild = clone(playerPresets[Number(button.dataset.preset)]);
      selectedSlot = "tail";
      syncBuildUi();
      resetRace();
    });

    els.rivalSelect.addEventListener("change", () => {
      const value = els.rivalSelect.value;
      rivalBuild = value === "imported" && importedRival ? clone(importedRival) : clone(rivalPresets[Number(value) || 0]);
      resetRace();
    });

    els.raceBtn.addEventListener("click", () => {
      resetRace();
      running = true;
      els.raceState.textContent = "RACING";
    });

    els.resetBtn.addEventListener("click", resetRace);

    els.exportBtn.addEventListener("click", () => {
      els.codeBox.value = encodeBuild(playerBuild);
      navigator.clipboard?.writeText(els.codeBox.value);
    });

    els.importBtn.addEventListener("click", () => {
      try {
        importedRival = decodeBuild(els.codeBox.value);
        rivalBuild = clone(importedRival);
        renderRivals();
        els.rivalSelect.value = "imported";
        resetRace();
      } catch (error) {
        els.raceState.textContent = "BAD CODE";
      }
    });

    els.codeBox.value = encodeBuild(playerBuild);
  }

  function syncBuildUi() {
    els.codeBox.value = encodeBuild(playerBuild);
    renderGarage();
    renderPresets();
  }

  function renderGarage() {
    const stats = calcStats(playerBuild);
    els.machineName.textContent = playerBuild.name;
    els.garageMap.innerHTML = `
      <div class="garage-grid"></div>
      <div class="machine-shadow"></div>
      <div class="machine-shell"><span></span></div>
    `;

    slotDefs.forEach((slot) => {
      const partId = playerBuild.slots[slot.id] || "empty";
      const part = parts[partId];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `slot-node ${slot.id === selectedSlot ? "active" : ""} ${partId === "empty" ? "empty" : ""}`;
      button.dataset.slot = slot.id;
      button.dataset.part = partId;
      button.dataset.role = part.role;
      button.title = `${slot.label} ${part.name}`;
      button.style.left = `${slot.x}%`;
      button.style.top = `${slot.y}%`;
      button.style.color = part.color;
      button.textContent = part.mark;
      els.garageMap.append(button);
    });

    renderSelectionReadout(stats);
    renderTelemetry(stats);
    updatePaletteState();
  }

  function renderSelectionReadout(stats) {
    const partId = playerBuild.slots[selectedSlot] || "empty";
    const part = parts[partId];
    const slot = slotDefs.find((item) => item.id === selectedSlot);
    els.selectionReadout.innerHTML = "";

    const mark = document.createElement("span");
    mark.className = "selected-mark";
    mark.style.color = part.color;
    mark.textContent = part.mark;

    const text = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = slot.label;
    const name = document.createElement("strong");
    name.textContent = part.name;
    text.append(label, name);

    const rating = document.createElement("span");
    rating.className = "balance-chip";
    rating.textContent = `${Math.round(stats.rating)}`;

    els.selectionReadout.append(mark, text, rating);
  }

  function renderTelemetry(stats) {
    els.builderTelemetry.innerHTML = "";
    [
      { mark: "↯", label: "SPD", value: stats.bars.speed, color: "#ffb84e" },
      { mark: "●", label: "GRP", value: stats.bars.grip, color: "#7ee081" },
      { mark: "◆", label: "STB", value: stats.bars.stability, color: "#9b8cff" },
      { mark: "◎", label: "WALL", value: stats.bars.wall, color: "#55d8f0" },
      { mark: "▱", label: "AIR", value: stats.bars.air, color: "#f4df62" },
      { mark: "▰", label: "SAFE", value: stats.bars.toughness, color: "#ff6461" }
    ].forEach((row) => {
      const item = document.createElement("div");
      item.className = "telemetry-row";
      item.style.setProperty("--row-color", row.color);

      const mark = document.createElement("span");
      mark.className = "telemetry-mark";
      mark.textContent = row.mark;

      const label = document.createElement("span");
      label.className = "telemetry-label";
      label.textContent = row.label;

      const track = document.createElement("span");
      track.className = "telemetry-track";
      const fill = document.createElement("span");
      fill.style.width = `${Math.round(clamp01(row.value) * 100)}%`;
      track.append(fill);

      item.append(mark, label, track);
      els.builderTelemetry.append(item);
    });
  }

  function renderPalette() {
    els.palette.innerHTML = "";
    paletteGroups.forEach((groupDef) => {
      const group = document.createElement("div");
      group.className = "palette-group";
      const label = document.createElement("span");
      label.className = "palette-label";
      label.textContent = groupDef.label;
      group.append(label);

      const tray = document.createElement("div");
      tray.className = "palette-tray";
      groupDef.ids.forEach((id) => {
        const part = parts[id];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "part-button";
        button.dataset.part = id;
        button.title = part.name;
        button.style.color = part.color;
        button.textContent = part.mark;
        tray.append(button);
      });
      group.append(tray);
      els.palette.append(group);
    });
    updatePaletteState();
  }

  function updatePaletteState() {
    if (!els.palette) return;
    const selectedPart = playerBuild.slots[selectedSlot] || "empty";
    els.palette.querySelectorAll("[data-part]").forEach((button) => {
      button.classList.toggle("active", button.dataset.part === selectedPart);
    });
  }

  function renderPresets() {
    els.presets.innerHTML = "";
    playerPresets.forEach((preset, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.preset = String(index);
      button.textContent = preset.name.toUpperCase();
      if (preset.name === playerBuild.name) button.classList.add("active");
      els.presets.append(button);
    });
  }

  function renderRivals() {
    els.rivalSelect.innerHTML = "";
    rivalPresets.forEach((preset, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = preset.name;
      els.rivalSelect.append(option);
    });
    if (importedRival) {
      const option = document.createElement("option");
      option.value = "imported";
      option.textContent = importedRival.name;
      els.rivalSelect.append(option);
    }
  }

  function beginPartDrag(partId, event) {
    event.preventDefault();
    const chip = document.createElement("div");
    chip.className = "drag-chip";
    chip.style.color = parts[partId].color;
    chip.textContent = parts[partId].mark;
    document.body.append(chip);
    dragState = {
      partId,
      chip,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId
    };
    moveDragChip(event.clientX, event.clientY);
    document.addEventListener("pointermove", movePartDrag);
    document.addEventListener("pointerup", endPartDrag, { once: true });
  }

  function movePartDrag(event) {
    if (!dragState) return;
    moveDragChip(event.clientX, event.clientY);
    const targetSlot = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-slot]");
    els.garageMap.querySelectorAll("[data-slot]").forEach((node) => {
      node.classList.toggle("drop-target", node === targetSlot);
    });
  }

  function endPartDrag(event) {
    if (!dragState) return;
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    const targetSlot = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-slot]");
    attachPart(targetSlot?.dataset.slot || (distance < 10 ? selectedSlot : null), dragState.partId);
    dragState.chip.remove();
    dragState = null;
    document.removeEventListener("pointermove", movePartDrag);
    els.garageMap.querySelectorAll("[data-slot]").forEach((node) => node.classList.remove("drop-target"));
  }

  function moveDragChip(x, y) {
    if (!dragState) return;
    dragState.chip.style.left = `${x}px`;
    dragState.chip.style.top = `${y}px`;
  }

  function attachPart(slotId, partId) {
    if (!slotId || !parts[partId]) return;
    playerBuild.slots[slotId] = partId;
    playerBuild.name = "Custom Mini";
    selectedSlot = slotId;
    syncBuildUi();
    resetRace();
  }

  function calcStats(build) {
    const raw = {
      top: 4.18,
      accel: 2.24,
      grip: 1,
      stability: 0.92,
      wall: 0.16,
      air: 0.48,
      boost: 0,
      toughness: 0.24,
      mass: 1
    };

    slotDefs.forEach((slot) => {
      const partId = build.slots[slot.id] || "empty";
      const part = parts[partId] || parts.empty;
      const mul = slotMultiplier(partId, slot.id);
      Object.entries(part.stats).forEach(([key, value]) => {
        raw[key] += value * mul;
      });
    });

    const topSpeed = clamp(3.05, 7.55, raw.top - Math.max(0, raw.mass - 1) * 0.16);
    const accel = clamp(1.05, 4.2, raw.accel - Math.max(0, raw.mass - 1) * 0.2);
    const grip = clamp(0.55, 2.85, raw.grip);
    const stability = clamp(0.48, 2.8, raw.stability);
    const wall = clamp(0.08, 2.55, raw.wall);
    const air = clamp(0.18, 2.45, raw.air);
    const boost = clamp(0, 3.3, raw.boost);
    const toughness = clamp(0.15, 2.4, raw.toughness);
    const mass = clamp(0.8, 4.5, raw.mass);
    const rating = 48 + topSpeed * 5.5 + grip * 8 + stability * 6 + wall * 5 + air * 4 + boost * 5 - mass * 2.8;

    return {
      topSpeed,
      accel,
      grip,
      stability,
      wall,
      air,
      boost,
      toughness,
      mass,
      rating: clamp(0, 99, rating),
      bars: {
        speed: normalize(topSpeed, 3.05, 7.55),
        grip: normalize(grip, 0.55, 2.85),
        stability: normalize(stability, 0.48, 2.8),
        wall: normalize(wall, 0.08, 2.55),
        air: normalize(air, 0.18, 2.45),
        toughness: normalize(toughness, 0.15, 2.4)
      }
    };
  }

  function slotMultiplier(partId, slotId) {
    if (partId === "booster" && slotId === "tail") return 1.35;
    if (partId === "booster" && slotId === "nose") return 0.75;
    if (partId === "roller" && (slotId === "left" || slotId === "right")) return 1.28;
    if (partId === "grip" && (slotId === "left" || slotId === "right" || slotId === "core")) return 1.16;
    if (partId === "weight" && slotId === "core") return 1.26;
    if (partId === "wing" && slotId === "top") return 1.36;
    if (partId === "bumper" && slotId === "nose") return 1.34;
    return 1;
  }

  function createTrack() {
    const points = [
      new THREE.Vector3(-4.6, 0, -2.4),
      new THREE.Vector3(2.8, 0, -2.45),
      new THREE.Vector3(5.3, 0, -0.6),
      new THREE.Vector3(4.2, 0, 2.05),
      new THREE.Vector3(0.8, 0, 2.62),
      new THREE.Vector3(-2.4, 0, 1.45),
      new THREE.Vector3(-5.1, 0, 2.1),
      new THREE.Vector3(-6.2, 0, -0.2)
    ];
    const curve = new THREE.CatmullRomCurve3(points, true, "centripetal", 0.82);
    const length = curve.getLength();
    const samples = Array.from({ length: ROAD_SEGMENTS + 1 }, (_, index) => sampleCurve(curve, index / ROAD_SEGMENTS));

    const group = new THREE.Group();
    const road = new THREE.Mesh(
      makeRibbonGeometry(samples, TRACK_WIDTH, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x222c2f, roughness: 0.72, metalness: 0.08 })
    );
    road.receiveShadow = true;
    group.add(road);

    const innerRail = makeRail(samples, -TRACK_WIDTH * 0.55, 0x47545a);
    const outerRail = makeRail(samples, TRACK_WIDTH * 0.55, 0xffd36b);
    group.add(innerRail, outerRail);

    featureZones.forEach((zone) => {
      const strip = new THREE.Mesh(
        makeFeatureGeometry(curve, zone.start, zone.end, TRACK_WIDTH * 0.82, 0.026),
        new THREE.MeshStandardMaterial({
          color: zone.color,
          emissive: zone.color,
          emissiveIntensity: zone.type === "boost" ? 0.22 : 0.08,
          roughness: 0.52,
          transparent: true,
          opacity: zone.type === "wall" ? 0.72 : 0.88
        })
      );
      strip.receiveShadow = true;
      group.add(strip);
    });

    for (let i = 0; i < 22; i += 1) {
      const u = i / 22;
      const sample = sampleCurve(curve, u);
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.42, 0.055),
        new THREE.MeshStandardMaterial({ color: 0x637078, emissive: 0x101719 })
      );
      const side = i % 2 === 0 ? 1 : -1;
      post.position.copy(sample.point.clone().add(sample.normal.clone().multiplyScalar(side * TRACK_WIDTH * 0.68)));
      post.position.y = 0.23;
      post.castShadow = true;
      group.add(post);
    }

    const startSample = sampleCurve(curve, 0);
    const startLine = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH * 0.95, 0.026, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xf4efe6, emissive: 0x302a18 })
    );
    startLine.position.copy(startSample.point.clone().add(startSample.tangent.clone().multiplyScalar(0.06)));
    startLine.position.y = 0.045;
    startLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), startSample.tangent);
    group.add(startLine);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 13),
      new THREE.MeshStandardMaterial({ color: 0x101417, roughness: 0.85, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.025;
    ground.receiveShadow = true;
    group.add(ground);

    return { curve, group, length, samples };
  }

  function sampleCurve(curve, u) {
    const point = curve.getPointAt(wrap01(u));
    const tangent = curve.getTangentAt(wrap01(u)).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const prev = curve.getTangentAt(wrap01(u - 0.003)).normalize();
    const next = curve.getTangentAt(wrap01(u + 0.003)).normalize();
    const cross = prev.x * next.z - prev.z * next.x;
    const angle = Math.acos(clamp(-1, 1, prev.dot(next)));
    return {
      u: wrap01(u),
      point,
      tangent,
      normal,
      curvature: angle / 0.006,
      curveSign: Math.sign(cross) || 1,
      feature: featureAt(wrap01(u))
    };
  }

  function sampleTrack(progress) {
    return sampleCurve(track.curve, (progress % track.length) / track.length);
  }

  function featureAt(u) {
    return featureZones.find((zone) => u >= zone.start && u <= zone.end) || null;
  }

  function featurePhase(u, feature) {
    if (!feature) return 0;
    return clamp01((u - feature.start) / Math.max(0.001, feature.end - feature.start));
  }

  function makeRibbonGeometry(samples, width, y) {
    const vertices = [];
    const indices = [];
    samples.forEach((sample) => {
      const left = sample.point.clone().add(sample.normal.clone().multiplyScalar(-width / 2));
      const right = sample.point.clone().add(sample.normal.clone().multiplyScalar(width / 2));
      vertices.push(left.x, y, left.z, right.x, y, right.z);
    });
    for (let i = 0; i < samples.length - 1; i += 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function makeFeatureGeometry(curve, start, end, width, y) {
    const steps = 34;
    const samples = Array.from({ length: steps + 1 }, (_, index) => sampleCurve(curve, start + ((end - start) * index) / steps));
    return makeRibbonGeometry(samples, width, y);
  }

  function makeRail(samples, offset, color) {
    const points = samples.map((sample) => sample.point.clone().add(sample.normal.clone().multiplyScalar(offset)).setY(0.08));
    const curve = new THREE.CatmullRomCurve3(points, true, "centripetal", 0.7);
    return new THREE.Mesh(
      new THREE.TubeGeometry(curve, ROAD_SEGMENTS, 0.035, 8, true),
      new THREE.MeshStandardMaterial({ color, emissive: color === 0xffd36b ? 0x4a2a08 : 0x101719, roughness: 0.42 })
    );
  }

  function resetRace() {
    running = false;
    raceTime = 0;
    cameraShake = 0;
    clearParticles();
    if (playerMachine) scene.remove(playerMachine.group);
    if (rivalMachine) scene.remove(rivalMachine.group);
    playerMachine = createMachine(playerBuild, 0, -0.32);
    rivalMachine = createMachine(rivalBuild, 1, 0.32);
    scene.add(playerMachine.group, rivalMachine.group);
    syncMachineMesh(playerMachine, 0);
    syncMachineMesh(rivalMachine, 0);
    updateHud();
    els.raceState.textContent = "READY";
  }

  function createMachine(build, team, lane) {
    const stats = calcStats(build);
    const group = buildMachineMesh(build, team);
    return {
      team,
      build: clone(build),
      stats,
      group,
      flames: [],
      state: {
        lane,
        progress: 0,
        speed: 0,
        time: 0,
        finished: false,
        finishTime: null,
        outCount: 0,
        crash: 0,
        boostTimer: 0,
        boostCooldown: team === 0 ? 0.15 : 0.35,
        airHeight: 0
      }
    };
  }

  function buildMachineMesh(build, team) {
    const group = new THREE.Group();
    const baseColor = team === 0 ? 0x55d8f0 : 0xff6461;
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.42,
      metalness: 0.22,
      emissive: team === 0 ? 0x0a3540 : 0x401010
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.28, 1.18), bodyMaterial);
    body.position.y = 0.25;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.28), bodyMaterial);
    nose.position.set(0, 0.27, 0.72);
    nose.castShadow = true;
    group.add(nose);

    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x101417, roughness: 0.6, metalness: 0.08 });
    [-0.48, 0.48].forEach((x) => {
      [-0.34, 0.38].forEach((z) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.13, 18), wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.12, z);
        wheel.castShadow = true;
        group.add(wheel);
      });
    });

    slotDefs.forEach((slot) => {
      const partId = build.slots[slot.id] || "empty";
      if (partId === "empty") return;
      const partGroup = createPartMesh(partId, slot);
      group.add(partGroup);
    });

    group.traverse((child) => {
      if (child.userData.flame) {
        child.visible = false;
        group.userData.flames = group.userData.flames || [];
        group.userData.flames.push(child);
      }
    });
    return group;
  }

  function createPartMesh(partId, slot) {
    const part = parts[partId];
    const group = new THREE.Group();
    const mount = new THREE.Vector3(...slot.mount);
    group.position.copy(mount);
    group.scale.setScalar(slot.scale || 1);

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(part.color),
      roughness: 0.4,
      metalness: 0.22,
      emissive: new THREE.Color(part.color).multiplyScalar(0.14)
    });

    if (partId === "booster") {
      const booster = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.4, 18), material);
      booster.rotation.x = Math.PI / 2;
      booster.castShadow = true;
      group.add(booster);

      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.42, 18),
        new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.85 })
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.z = -0.34;
      flame.userData.flame = true;
      group.add(flame);
    }

    if (partId === "roller") {
      const roller = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 24), material);
      roller.rotation.y = Math.PI / 2;
      roller.castShadow = true;
      group.add(roller);
    }

    if (partId === "grip") {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.18, 20), material);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      group.add(tire);
    }

    if (partId === "weight") {
      const weight = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), material);
      weight.castShadow = true;
      group.add(weight);
    }

    if (partId === "wing") {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.055, 0.22), material);
      wing.position.y = 0.08;
      wing.castShadow = true;
      group.add(wing);
    }

    if (partId === "bumper") {
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.14), material);
      bumper.castShadow = true;
      group.add(bumper);
    }

    return group;
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTick) / 1000 || 0.016);
    lastTick = now;
    cameraShake = Math.max(0, cameraShake - dt * 2.6);

    if (running) updateRace(dt);
    syncMachineMesh(playerMachine, dt);
    syncMachineMesh(rivalMachine, dt);
    updateParticles(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function updateRace(dt) {
    raceTime += dt;
    updateMachine(playerMachine, dt);
    updateMachine(rivalMachine, dt);
    updateHud();

    if ((playerMachine.state.finished && rivalMachine.state.finished) || raceTime >= MAX_RACE_TIME) {
      running = false;
      const result = compareMachines();
      els.raceState.textContent = result === 0 ? "DRAW" : result < 0 ? "WIN" : "LOSE";
      updateHud();
    }
  }

  function updateMachine(machine, dt) {
    const state = machine.state;
    if (state.finished) return;
    state.time += dt;
    state.boostCooldown = Math.max(0, state.boostCooldown - dt);
    state.boostTimer = Math.max(0, state.boostTimer - dt);

    const sample = sampleTrack(state.progress);
    const feature = sample.feature;
    let top = machine.stats.topSpeed;

    if (feature?.type === "rough") {
      top -= Math.max(0.12, 0.95 - machine.stats.mass * 0.1 - machine.stats.toughness * 0.24);
      state.speed *= 1 - dt * Math.max(0.04, 0.32 - machine.stats.toughness * 0.08);
    }

    if (feature?.type === "wall") {
      top -= Math.max(0, 0.42 - machine.stats.wall * 0.12);
    }

    if (feature?.type === "boost" && machine.stats.boost > 0.05 && state.boostCooldown <= 0 && state.crash <= 0) {
      state.boostTimer = 0.72;
      state.boostCooldown = 2.5;
      spawnTrackSparks(machine, 0xffb84e, 10);
    }

    if (state.boostTimer > 0) {
      top += machine.stats.boost * 0.92;
      state.speed += machine.stats.boost * 2.05 * dt;
    }

    if (state.crash > 0) {
      state.crash = Math.max(0, state.crash - dt);
      state.speed = Math.max(0.6, state.speed - (2.4 - machine.stats.toughness * 0.35) * dt);
    } else {
      state.speed += (top - state.speed) * Math.min(1, dt * machine.stats.accel * 0.38);
      applyCornering(machine, sample, dt);
      applyJump(machine, sample, dt);
    }

    state.progress += Math.max(0, state.speed) * dt;
    if (state.progress >= track.length * LAPS) {
      state.finished = true;
      state.finishTime = state.time;
      state.speed = 0;
      spawnTrackSparks(machine, machine.team === 0 ? 0x55d8f0 : 0xff6461, 16);
    }
  }

  function applyCornering(machine, sample, dt) {
    const state = machine.state;
    const load = state.speed * state.speed * Math.abs(sample.curvature) * 0.062;
    const hold = machine.stats.grip * 0.58 + machine.stats.stability * 0.34 + machine.stats.wall * 0.12;
    const slide = Math.max(0, load - hold);
    state.lane += sample.curveSign * slide * dt * (0.42 + state.speed * 0.055);
    state.lane *= Math.max(0.1, 1 - dt * (1.15 + machine.stats.grip * 0.62 + machine.stats.wall * 0.7));

    if (Math.abs(state.lane) > TRACK_WIDTH * 0.52) {
      courseOut(machine, sample, 0.75 + slide * 0.35);
    }
  }

  function applyJump(machine, sample, dt) {
    const state = machine.state;
    const feature = sample.feature;
    if (feature?.type !== "jump") {
      state.airHeight += (0 - state.airHeight) * Math.min(1, dt * 8);
      return;
    }
    const phase = featurePhase(sample.u, feature);
    state.airHeight = Math.sin(phase * Math.PI) * Math.min(0.68, state.speed * 0.085);
    const safeSpeed = 4.55 + machine.stats.air * 0.64 + machine.stats.stability * 0.24;
    const jumpRisk = state.speed - safeSpeed;
    if (jumpRisk > 0.88 && phase > 0.35 && phase < 0.68) {
      courseOut(machine, sample, 0.84 + jumpRisk * 0.12);
    }
  }

  function courseOut(machine, sample, power) {
    const state = machine.state;
    if (state.crash > 0.15) return;
    state.outCount += 1;
    state.crash = 0.92;
    state.speed *= clamp(0.3, 0.62, 0.48 + machine.stats.toughness * 0.05);
    state.lane = clamp(-TRACK_WIDTH * 0.28, TRACK_WIDTH * 0.28, state.lane * 0.36);
    cameraShake = Math.max(cameraShake, 0.28 + power * 0.52);
    spawnWorldSparks(sample.point.clone().add(sample.normal.clone().multiplyScalar(state.lane)), machine.team === 0 ? 0x55d8f0 : 0xff6461, 10 + Math.round(power * 8));
  }

  function syncMachineMesh(machine, dt) {
    if (!machine) return;
    const state = machine.state;
    const sample = sampleTrack(Math.min(state.progress, track.length * LAPS - 0.001));
    const position = sample.point.clone().add(sample.normal.clone().multiplyScalar(state.lane));
    position.y = 0.16 + state.airHeight;
    machine.group.position.copy(position);
    const yaw = Math.atan2(sample.tangent.x, sample.tangent.z);
    machine.group.rotation.set(0, yaw, -state.lane * 0.08 - sample.curveSign * Math.min(0.22, Math.abs(sample.curvature) * 0.012));

    machine.group.userData.flames?.forEach((flame) => {
      flame.visible = state.boostTimer > 0.02;
      flame.scale.setScalar(0.85 + Math.sin(state.time * 28) * 0.12);
    });

    machine.group.traverse((child) => {
      if (child.geometry?.type === "CylinderGeometry") child.rotation.x += state.speed * dt * 2.4;
    });
  }

  function updateHud() {
    const targetDistance = track.length * LAPS;
    const p = Math.min(1, playerMachine.state.progress / targetDistance);
    const r = Math.min(1, rivalMachine.state.progress / targetDistance);
    els.playerMeter.style.width = `${p * 100}%`;
    els.rivalMeter.style.width = `${r * 100}%`;
    els.clock.textContent = raceTime.toFixed(1);
    els.resultLine.textContent = `${formatTime(playerMachine.state.finishTime || playerMachine.state.time)} / ${formatTime(rivalMachine.state.finishTime || rivalMachine.state.time)}`;

    window.AsyncRacerDebug = {
      time: raceTime,
      trackLength: track.length,
      player: machineDebug(playerMachine),
      rival: machineDebug(rivalMachine)
    };
  }

  function machineDebug(machine) {
    return {
      progress: machine.state.progress,
      speed: machine.state.speed,
      outCount: machine.state.outCount,
      finished: machine.state.finished,
      finishTime: machine.state.finishTime,
      stats: machine.stats
    };
  }

  function compareMachines() {
    const p = raceScore(playerMachine);
    const r = raceScore(rivalMachine);
    if (Math.abs(p - r) < 0.03) return 0;
    return p - r;
  }

  function raceScore(machine) {
    if (machine.state.finishTime != null) return machine.state.finishTime + machine.state.outCount * 0.24;
    const remaining = track.length * LAPS - machine.state.progress;
    return MAX_RACE_TIME + remaining * 0.18 + machine.state.outCount * 0.6;
  }

  function spawnTrackSparks(machine, color, count) {
    const sample = sampleTrack(machine.state.progress);
    spawnWorldSparks(sample.point.clone().add(sample.normal.clone().multiplyScalar(machine.state.lane)), color, count);
  }

  function spawnWorldSparks(origin, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = (TAU * i) / count;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })
      );
      mesh.position.copy(origin);
      mesh.position.y += 0.24;
      mesh.userData.velocity = new THREE.Vector3(Math.cos(angle) * (0.45 + i * 0.015), 0.45 + (i % 3) * 0.09, Math.sin(angle) * (0.45 + i * 0.015));
      mesh.userData.life = 0;
      mesh.userData.duration = 0.45;
      scene.add(mesh);
      particles.push(mesh);
    }
  }

  function updateParticles(dt) {
    particles.forEach((particle) => {
      particle.userData.life += dt;
      particle.position.addScaledVector(particle.userData.velocity, dt);
      particle.userData.velocity.y -= 2.6 * dt;
      const t = particle.userData.life / particle.userData.duration;
      particle.material.opacity = Math.max(0, 1 - t);
      particle.scale.setScalar(1 + t * 0.8);
    });
    particles = particles.filter((particle) => {
      if (particle.userData.life < particle.userData.duration) return true;
      scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
      return false;
    });
  }

  function clearParticles() {
    particles.forEach((particle) => {
      scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
    });
    particles = [];
  }

  function updateCamera(dt) {
    const compact = window.innerWidth < 760;
    const leader = playerMachine.state.progress >= rivalMachine.state.progress ? playerMachine : rivalMachine;
    const sample = sampleTrack(leader.state.progress);
    target.x += (sample.point.x - target.x) * Math.min(1, dt * 2.6);
    target.z += (sample.point.z - target.z) * Math.min(1, dt * 2.6);
    const height = compact ? 8.8 : 7.4;
    const distance = compact ? 6.7 : 6.0;
    const desired = new THREE.Vector3(target.x, height, target.z + distance);
    const shake = cameraShake * (compact ? 0.08 : 0.1);
    desired.x += Math.sin(raceTime * 48) * shake;
    desired.y += Math.cos(raceTime * 37) * shake * 0.35;
    desired.z += Math.cos(raceTime * 42) * shake;
    camera.position.lerp(desired, Math.min(1, dt * 2.2));
    camera.lookAt(target.x, 0.1, target.z);
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 760 ? 50 : 44;
    camera.updateProjectionMatrix();
  }

  function encodeBuild(build) {
    const payload = JSON.stringify(sanitizeBuild(build));
    return `MR1.${btoa(unescape(encodeURIComponent(payload)))}`;
  }

  function decodeBuild(source) {
    const text = source.trim();
    if (!text) throw new Error("empty");
    if (text.startsWith("MR1.")) {
      return sanitizeBuild(JSON.parse(decodeURIComponent(escape(atob(text.slice(4))))));
    }
    return sanitizeBuild(JSON.parse(text));
  }

  function sanitizeBuild(value) {
    const clean = makeBuild(String(value.name || "Loaded Mini").slice(0, 18), {});
    slotDefs.forEach((slot) => {
      const partId = value.slots && parts[value.slots[slot.id]] ? value.slots[slot.id] : "empty";
      clean.slots[slot.id] = partId;
    });
    return clean;
  }

  function formatTime(value) {
    return value == null ? "--.--" : value.toFixed(2);
  }

  function normalize(value, min, max) {
    return clamp01((value - min) / (max - min));
  }

  function clamp(min, max, value) {
    return Math.min(max, Math.max(min, value));
  }

  function clamp01(value) {
    return clamp(0, 1, value);
  }

  function wrap01(value) {
    let wrapped = value % 1;
    if (wrapped < 0) wrapped += 1;
    return wrapped;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
})().catch((error) => {
  const target = document.querySelector("#scene") || document.body;
  target.innerHTML = `<div style="padding:24px;color:#f4efe6;font-family:sans-serif">3D runtime failed: ${String(error.message || error)}</div>`;
});

(async function boot() {
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js");

  const TAU = Math.PI * 2;
  const COLS = 5;
  const ROWS = 4;
  const CORE_SLOT = "s2_2";
  const MAX_BATTLE_TIME = 45;
  const ARENA_LIMIT = 5.45;
  const CONTACT_DISTANCE = 1.05;

  const slotDefs = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const id = `s${col}_${row}`;
      slotDefs.push({
        id,
        col,
        row,
        label: `${String.fromCharCode(65 + col)}${row + 1}`,
        fixed: id === CORE_SLOT,
        uiX: 10 + col * 20,
        uiY: 13 + row * 22,
        local: new THREE.Vector3(0.52, 1.28 - row * 0.36, (col - 2) * 0.46)
      });
    }
  }

  const parts = {
    empty: { mark: "·", name: "EMPTY", color: "#68737a", role: "clear", stats: {} },
    core: { mark: "◎", name: "CORE", color: "#f4efe6", role: "core", stats: { hp: 130, mass: 1.4 } },
    cannon: { mark: "●", name: "CANNON", color: "#f4df62", role: "attack", stats: { attack: 1.12, range: 0.72, mass: 0.42 } },
    missile: { mark: "◆", name: "MISSILE", color: "#ffb84e", role: "attack", stats: { attack: 0.88, range: 1.05, mass: 0.32 } },
    shield: { mark: "▰", name: "SHIELD", color: "#55d8f0", role: "guard", stats: { defense: 1.18, mass: 0.48 } },
    ram: { mark: "▲", name: "RAM", color: "#ff6461", role: "push", stats: { push: 1.12, attack: 0.34, mass: 0.36 } },
    engine: { mark: "↯", name: "ENGINE", color: "#7ee081", role: "move", stats: { speed: 1.12, push: 0.28, mass: 0.28 } },
    armor: { mark: "■", name: "ARMOR", color: "#9b8cff", role: "guard", stats: { hp: 24, defense: 0.48, mass: 0.62 } }
  };

  const paletteGroups = [
    { label: "FIRE", ids: ["cannon", "missile"] },
    { label: "WALL", ids: ["shield", "armor"] },
    { label: "MOVE", ids: ["ram", "engine"] },
    { label: "CLEAR", ids: ["empty"] }
  ];

  const playerPresets = [
    makeFortress("Frontline Box", {
      s2_0: "cannon",
      s1_1: "shield",
      s3_1: "shield",
      s0_2: "engine",
      s4_2: "engine",
      s1_3: "ram",
      s3_3: "ram"
    }),
    makeFortress("Cannon Wall", {
      s1_0: "cannon",
      s2_0: "cannon",
      s3_0: "cannon",
      s0_1: "shield",
      s4_1: "shield",
      s1_2: "armor",
      s3_2: "armor",
      s2_3: "engine"
    }),
    makeFortress("Rocket Rain", {
      s0_0: "missile",
      s2_0: "missile",
      s4_0: "missile",
      s1_1: "cannon",
      s3_1: "cannon",
      s0_3: "engine",
      s4_3: "engine"
    }),
    makeFortress("Ram Runner", {
      s1_0: "ram",
      s2_0: "ram",
      s3_0: "ram",
      s0_1: "shield",
      s4_1: "shield",
      s1_3: "engine",
      s2_3: "engine",
      s3_3: "engine"
    })
  ];

  const rivalPresets = [
    makeFortress("Red Bastion", {
      s2_0: "cannon",
      s0_1: "shield",
      s4_1: "shield",
      s1_2: "armor",
      s3_2: "armor",
      s2_3: "engine"
    }),
    makeFortress("Spear Gate", {
      s0_0: "ram",
      s2_0: "ram",
      s4_0: "ram",
      s1_1: "shield",
      s3_1: "shield",
      s0_3: "engine",
      s4_3: "engine"
    }),
    makeFortress("Missile Keep", {
      s1_0: "missile",
      s3_0: "missile",
      s2_1: "cannon",
      s0_2: "shield",
      s4_2: "shield",
      s1_3: "engine",
      s3_3: "engine"
    })
  ];

  const els = {
    scene: document.querySelector("#scene"),
    fortressGrid: document.querySelector("#fortressGrid"),
    selectionReadout: document.querySelector("#selectionReadout"),
    builderTelemetry: document.querySelector("#builderTelemetry"),
    palette: document.querySelector("#palette"),
    presets: document.querySelector("#presets"),
    rivalSelect: document.querySelector("#rivalSelect"),
    fightBtn: document.querySelector("#fightBtn"),
    resetBtn: document.querySelector("#resetBtn"),
    exportBtn: document.querySelector("#exportBtn"),
    importBtn: document.querySelector("#importBtn"),
    codeBox: document.querySelector("#codeBox"),
    fortressName: document.querySelector("#fortressName"),
    battleState: document.querySelector("#battleState"),
    playerCore: document.querySelector("#playerCore"),
    rivalCore: document.querySelector("#rivalCore"),
    clock: document.querySelector("#clock"),
    resultLine: document.querySelector("#resultLine")
  };

  let playerBuild = clone(playerPresets[0]);
  let importedRival = null;
  let rivalBuild = clone(rivalPresets[0]);
  let selectedSlot = "s2_0";
  let playerFort = null;
  let rivalFort = null;
  let projectiles = [];
  let effects = [];
  let running = false;
  let battleTime = 0;
  let lastTick = performance.now();
  let cameraShake = 0;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  els.scene.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x101417, 11, 24);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 80);
  const target = new THREE.Vector3(0, 0.75, 0);

  const hemi = new THREE.HemisphereLight(0xe8fbff, 0x15191b, 2.5);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(-4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 24;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  scene.add(key);

  const arena = createArena();
  scene.add(arena);

  initUi();
  resetBattle();
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);

  function makeFortress(name, slotMap) {
    const slots = {};
    slotDefs.forEach((slot) => {
      slots[slot.id] = slot.fixed ? "core" : slotMap[slot.id] || "empty";
    });
    return { version: 1, name, slots };
  }

  function initUi() {
    renderGrid();
    renderPalette();
    renderPresets();
    renderRivals();

    els.fortressGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-slot]");
      if (!button) return;
      selectedSlot = button.dataset.slot;
      renderGrid();
    });

    els.palette.addEventListener("click", (event) => {
      const button = event.target.closest("[data-part]");
      if (!button) return;
      attachPart(selectedSlot, button.dataset.part);
    });

    els.palette.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("[data-part]");
      if (!button) return;
      button.setPointerCapture?.(event.pointerId);
    });

    els.presets.addEventListener("click", (event) => {
      const button = event.target.closest("[data-preset]");
      if (!button) return;
      playerBuild = clone(playerPresets[Number(button.dataset.preset)]);
      selectedSlot = "s2_0";
      syncBuildUi();
      resetBattle();
    });

    els.rivalSelect.addEventListener("change", () => {
      const value = els.rivalSelect.value;
      rivalBuild = value === "imported" && importedRival ? clone(importedRival) : clone(rivalPresets[Number(value) || 0]);
      resetBattle();
    });

    els.fightBtn.addEventListener("click", () => {
      resetBattle();
      running = true;
      els.battleState.textContent = "FIGHT";
    });

    els.resetBtn.addEventListener("click", resetBattle);

    els.exportBtn.addEventListener("click", () => {
      els.codeBox.value = encodeFortress(playerBuild);
      navigator.clipboard?.writeText(els.codeBox.value);
    });

    els.importBtn.addEventListener("click", () => {
      try {
        importedRival = decodeFortress(els.codeBox.value);
        rivalBuild = clone(importedRival);
        renderRivals();
        els.rivalSelect.value = "imported";
        resetBattle();
      } catch (error) {
        els.battleState.textContent = "BAD CODE";
      }
    });

    els.codeBox.value = encodeFortress(playerBuild);
  }

  function syncBuildUi() {
    els.codeBox.value = encodeFortress(playerBuild);
    renderGrid();
    renderPresets();
  }

  function renderGrid() {
    const stats = calcStats(playerBuild);
    els.fortressName.textContent = playerBuild.name;
    els.fortressGrid.innerHTML = "";

    slotDefs.forEach((slot) => {
      const partId = playerBuild.slots[slot.id] || "empty";
      const part = parts[partId];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `grid-slot ${slot.id === selectedSlot ? "active" : ""} ${slot.fixed ? "fixed" : ""} ${partId === "empty" ? "empty" : ""}`;
      button.dataset.slot = slot.id;
      button.dataset.part = partId;
      button.dataset.role = part.role;
      button.title = `${slot.label} ${part.name}`;
      button.style.gridColumn = `${slot.col + 1}`;
      button.style.gridRow = `${slot.row + 1}`;
      button.style.color = part.color;
      button.textContent = part.mark;
      els.fortressGrid.append(button);
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
    label.textContent = `${slot.label}${slot.fixed ? " LOCK" : ""}`;
    const name = document.createElement("strong");
    name.textContent = part.name;
    text.append(label, name);

    const rating = document.createElement("span");
    rating.className = "rating-chip";
    rating.textContent = `${Math.round(stats.rating)}`;

    els.selectionReadout.append(mark, text, rating);
  }

  function renderTelemetry(stats) {
    els.builderTelemetry.innerHTML = "";
    [
      { mark: "●", label: "ATK", value: stats.bars.attack, color: "#f4df62" },
      { mark: "▰", label: "DEF", value: stats.bars.defense, color: "#55d8f0" },
      { mark: "▲", label: "PUSH", value: stats.bars.push, color: "#ff6461" },
      { mark: "↯", label: "SPD", value: stats.bars.speed, color: "#7ee081" },
      { mark: "◆", label: "RNG", value: stats.bars.range, color: "#ffb84e" },
      { mark: "◎", label: "CORE", value: stats.bars.hp, color: "#f4efe6" }
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
    const slot = slotDefs.find((item) => item.id === selectedSlot);
    const selectedPart = playerBuild.slots[selectedSlot] || "empty";
    els.palette.querySelectorAll("[data-part]").forEach((button) => {
      button.disabled = Boolean(slot?.fixed);
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

  function attachPart(slotId, partId) {
    const slot = slotDefs.find((item) => item.id === slotId);
    if (!slot || slot.fixed || !parts[partId] || partId === "core") return;
    playerBuild.slots[slotId] = partId;
    playerBuild.name = "Custom Fortress";
    selectedSlot = slotId;
    syncBuildUi();
    resetBattle();
  }

  function calcStats(build) {
    const raw = {
      hp: 130,
      attack: 0,
      defense: 0.35,
      push: 0.35,
      speed: 0.35,
      range: 0,
      mass: 4.6
    };
    slotDefs.forEach((slot) => {
      const part = parts[build.slots[slot.id] || "empty"] || parts.empty;
      const mul = slotMultiplier(part.role, slot);
      Object.entries(part.stats).forEach(([key, value]) => {
        raw[key] += value * mul;
      });
    });

    const mass = clamp(3.6, 13.0, raw.mass);
    const hp = clamp(90, 250, raw.hp + raw.defense * 10);
    const attack = clamp(0, 8, raw.attack);
    const defense = clamp(0.2, 7, raw.defense);
    const push = clamp(0.2, 8, raw.push + raw.speed * 0.25);
    const speed = clamp(0.15, 4.2, raw.speed - Math.max(0, mass - 6.2) * 0.08);
    const range = clamp(0, 7, raw.range + raw.attack * 0.16);
    const rating = clamp(0, 99, 34 + attack * 7 + defense * 7 + push * 5.6 + speed * 6 + range * 3 + hp * 0.08 - mass * 1.2);

    return {
      hp,
      attack,
      defense,
      push,
      speed,
      range,
      mass,
      rating,
      bars: {
        hp: normalize(hp, 90, 250),
        attack: normalize(attack, 0, 8),
        defense: normalize(defense, 0.2, 7),
        push: normalize(push, 0.2, 8),
        speed: normalize(speed, 0.15, 4.2),
        range: normalize(range, 0, 7)
      }
    };
  }

  function slotMultiplier(role, slot) {
    if (role === "attack" && slot.row === 0) return 1.22;
    if (role === "guard" && (slot.col === 0 || slot.col === COLS - 1 || slot.row <= 1)) return 1.16;
    if (role === "push" && slot.row === 0) return 1.34;
    if (role === "move" && slot.row >= 2) return 1.24;
    return 1;
  }

  function createArena() {
    const group = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(12.2, 0.12, 4.9),
      new THREE.MeshStandardMaterial({ color: 0x20282b, roughness: 0.78, metalness: 0.08 })
    );
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    group.add(floor);

    const center = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.035, 4.72),
      new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0x4a2a08, roughness: 0.45 })
    );
    center.position.y = 0.02;
    group.add(center);

    [-ARENA_LIMIT, ARENA_LIMIT].forEach((x, index) => {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.045, 4.72),
        new THREE.MeshStandardMaterial({ color: index === 0 ? 0x55d8f0 : 0xff6461, emissive: index === 0 ? 0x0f3a44 : 0x401010 })
      );
      line.position.set(x, 0.03, 0);
      group.add(line);
    });

    for (let i = 0; i < 18; i += 1) {
      const x = -5.55 + i * 0.65;
      const postA = makePost(x, -2.22);
      const postB = makePost(x, 2.22);
      group.add(postA, postB);
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 11),
      new THREE.MeshStandardMaterial({ color: 0x101417, roughness: 0.92 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    group.add(ground);
    return group;
  }

  function makePost(x, z) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.42, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x657078, emissive: 0x101719 })
    );
    post.position.set(x, 0.17, z);
    post.castShadow = true;
    return post;
  }

  function resetBattle() {
    running = false;
    battleTime = 0;
    cameraShake = 0;
    clearProjectiles();
    clearEffects();
    if (playerFort) scene.remove(playerFort.group);
    if (rivalFort) scene.remove(rivalFort.group);
    playerFort = createFortress(playerBuild, 0);
    rivalFort = createFortress(rivalBuild, 1);
    scene.add(playerFort.group, rivalFort.group);
    syncFortressMesh(playerFort, 0);
    syncFortressMesh(rivalFort, 0);
    updateHud();
    els.battleState.textContent = "READY";
  }

  function createFortress(build, team) {
    const stats = calcStats(build);
    const group = buildFortressMesh(build, team);
    const fort = {
      team,
      build: clone(build),
      stats,
      group,
      x: team === 0 ? -3.8 : 3.8,
      vel: team === 0 ? 0.2 : -0.2,
      coreHp: stats.hp,
      cooldowns: {},
      active: new Set(),
      hitFlash: 0,
      out: false
    };
    return fort;
  }

  function buildFortressMesh(build, team) {
    const group = new THREE.Group();
    group.rotation.y = team === 0 ? 0 : Math.PI;
    const baseColor = team === 0 ? 0x55d8f0 : 0xff6461;
    const baseMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.46,
      metalness: 0.18,
      emissive: team === 0 ? 0x0b3037 : 0x3c1010
    });

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.26, 2.55), baseMat);
    base.position.set(-0.05, 0.12, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.72, 2.55),
      new THREE.MeshStandardMaterial({ color: 0x192125, roughness: 0.58, metalness: 0.14 })
    );
    panel.position.set(0.18, 0.86, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    group.add(panel);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x101417, roughness: 0.65 });
    [-0.8, 0.8].forEach((z) => {
      [-0.18, 0.24].forEach((x) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.13, 18), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.03, z);
        wheel.castShadow = true;
        group.add(wheel);
      });
    });

    group.userData.slotGroups = {};
    slotDefs.forEach((slot) => {
      const partId = build.slots[slot.id] || "empty";
      if (partId === "empty") return;
      const partGroup = createPartMesh(partId, slot);
      group.userData.slotGroups[slot.id] = partGroup;
      group.add(partGroup);
    });

    return group;
  }

  function createPartMesh(partId, slot) {
    const part = parts[partId];
    const group = new THREE.Group();
    group.position.copy(slot.local);
    group.userData.partId = partId;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(part.color),
      roughness: 0.42,
      metalness: 0.22,
      emissive: new THREE.Color(part.color).multiplyScalar(0.14)
    });

    if (partId === "core") {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.19, 22, 16), material);
      core.castShadow = true;
      group.add(core);
    }

    if (partId === "cannon") {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.52, 18), material);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.x = 0.16;
      barrel.castShadow = true;
      group.add(barrel);
    }

    if (partId === "missile") {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.38, 16), material);
      body.rotation.z = Math.PI / 2;
      body.position.x = 0.12;
      body.castShadow = true;
      group.add(body);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 16), material);
      cone.rotation.z = -Math.PI / 2;
      cone.position.x = 0.38;
      cone.castShadow = true;
      group.add(cone);
    }

    if (partId === "shield") {
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.38), material);
      shield.position.x = 0.08;
      shield.castShadow = true;
      group.add(shield);
    }

    if (partId === "ram") {
      const ram = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 20), material);
      ram.rotation.z = -Math.PI / 2;
      ram.position.x = 0.2;
      ram.castShadow = true;
      group.add(ram);
    }

    if (partId === "engine") {
      const engine = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 18), material);
      engine.rotation.z = Math.PI / 2;
      engine.position.x = -0.1;
      engine.castShadow = true;
      group.add(engine);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.36, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.82 })
      );
      flame.rotation.z = -Math.PI / 2;
      flame.position.x = -0.34;
      flame.userData.flame = true;
      group.add(flame);
    }

    if (partId === "armor") {
      const armor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.28), material);
      armor.castShadow = true;
      group.add(armor);
    }

    return group;
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTick) / 1000 || 0.016);
    lastTick = now;
    cameraShake = Math.max(0, cameraShake - dt * 2.4);
    if (running) updateBattle(dt);
    syncFortressMesh(playerFort, dt);
    syncFortressMesh(rivalFort, dt);
    updateProjectiles(dt);
    updateEffects(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function updateBattle(dt) {
    battleTime += dt;
    playerFort.active.clear();
    rivalFort.active.clear();
    updateFortress(playerFort, rivalFort, dt);
    updateFortress(rivalFort, playerFort, dt);
    handleContact(dt);
    updateHud();

    const result = battleResult();
    if (result || battleTime >= MAX_BATTLE_TIME) {
      running = false;
      els.battleState.textContent = result || scoreResult();
      updateHud();
    }
  }

  function updateFortress(fort, opponent, dt) {
    if (fort.out || fort.coreHp <= 0) return;
    Object.keys(fort.cooldowns).forEach((key) => {
      fort.cooldowns[key] = Math.max(0, fort.cooldowns[key] - dt);
    });

    const direction = fort.team === 0 ? 1 : -1;
    const desiredSpeed = direction * (0.18 + fort.stats.speed * 0.16);
    fort.vel += (desiredSpeed - fort.vel) * Math.min(1, dt * (1.5 + fort.stats.speed * 0.35));
    fort.x += fort.vel * dt;

    slotDefs.forEach((slot) => {
      const partId = fort.build.slots[slot.id];
      if (partId !== "cannon" && partId !== "missile") return;
      const cooldownKey = slot.id;
      if ((fort.cooldowns[cooldownKey] || 0) > 0) return;
      const distance = Math.abs(opponent.x - fort.x);
      const rangeBonus = partId === "missile" ? 1.6 : 0.8;
      if (distance > 2.1 + fort.stats.range * 0.35 + rangeBonus) return;
      fireProjectile(fort, opponent, slot, partId);
      fort.active.add(slot.id);
      fort.cooldowns[cooldownKey] = partId === "missile" ? 1.55 : 0.95;
    });

    if ((fort.team === 0 && fort.x < -ARENA_LIMIT) || (fort.team === 1 && fort.x > ARENA_LIMIT)) {
      fort.out = true;
      fort.coreHp = 0;
    }
  }

  function handleContact(dt) {
    const dx = rivalFort.x - playerFort.x;
    if (Math.abs(dx) > CONTACT_DISTANCE) return;
    const pPower = contactPower(playerFort);
    const rPower = contactPower(rivalFort);
    const total = Math.max(0.1, pPower + rPower);
    const push = (pPower - rPower) / total;
    playerFort.vel -= (0.5 + rPower * 0.09 - push * 0.2) * dt;
    rivalFort.vel += (0.5 + pPower * 0.09 + push * 0.2) * dt;
    playerFort.coreHp -= Math.max(0.8, rPower * 0.9 - playerFort.stats.defense * 0.35) * dt;
    rivalFort.coreHp -= Math.max(0.8, pPower * 0.9 - rivalFort.stats.defense * 0.35) * dt;
    activateRole(playerFort, "push");
    activateRole(rivalFort, "push");

    if (Math.floor(battleTime * 8) !== Math.floor((battleTime - dt) * 8)) {
      spawnImpact(new THREE.Vector3((playerFort.x + rivalFort.x) * 0.5, 0.82, 0), 0xffd36b, 0.46);
      cameraShake = Math.max(cameraShake, 0.34);
    }
  }

  function contactPower(fort) {
    const ramCount = countPart(fort.build, "ram");
    return fort.stats.push + ramCount * 0.9 + Math.abs(fort.vel) * fort.stats.mass * 0.45;
  }

  function fireProjectile(fort, opponent, slot, partId) {
    const origin = slotWorldPosition(fort, slot);
    const target = coreWorldPosition(opponent);
    const direction = target.clone().sub(origin).normalize();
    const speed = partId === "missile" ? 3.2 : 5.4;
    const mesh = createProjectileMesh(partId, fort.team);
    mesh.position.copy(origin);
    scene.add(mesh);
    projectiles.push({
      owner: fort.team,
      targetTeam: opponent.team,
      kind: partId,
      pos: origin,
      vel: direction.multiplyScalar(speed),
      life: partId === "missile" ? 3.0 : 1.8,
      damage: partId === "missile" ? 16 : 10,
      mesh
    });
  }

  function createProjectileMesh(kind, team) {
    const color = team === 0 ? 0x55d8f0 : 0xff6461;
    if (kind === "missile") {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 10), new THREE.MeshBasicMaterial({ color }));
      body.rotation.z = Math.PI / 2;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 10), new THREE.MeshBasicMaterial({ color: 0xffb84e }));
      nose.rotation.z = -Math.PI / 2;
      nose.position.x = 0.18;
      group.add(body, nose);
      return group;
    }
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.94 })
    );
  }

  function updateProjectiles(dt) {
    projectiles.forEach((shot) => {
      const defender = shot.targetTeam === 0 ? playerFort : rivalFort;
      if (shot.kind === "missile" && defender.coreHp > 0) {
        const desired = coreWorldPosition(defender).sub(shot.pos).normalize().multiplyScalar(3.2);
        shot.vel.lerp(desired, Math.min(1, dt * 2.1));
      }
      shot.pos.addScaledVector(shot.vel, dt);
      shot.life -= dt;
      shot.mesh.position.copy(shot.pos);
      shot.mesh.rotation.y = Math.atan2(shot.vel.x, shot.vel.z);
      if (defender.coreHp > 0 && projectileHitsFortress(shot, defender)) {
        applyProjectileHit(shot, defender);
        shot.life = 0;
      }
    });

    projectiles = projectiles.filter((shot) => {
      if (shot.life > 0) return true;
      disposeObject(shot.mesh);
      return false;
    });
  }

  function projectileHitsFortress(shot, defender) {
    const localXDistance = Math.abs(shot.pos.x - defender.x);
    return localXDistance < 0.52 && shot.pos.y > 0.1 && shot.pos.y < 1.78 && Math.abs(shot.pos.z) < 1.42;
  }

  function applyProjectileHit(shot, defender) {
    const hitSlot = nearestSlotByWorld(defender, shot.pos);
    const partId = defender.build.slots[hitSlot.id] || "empty";
    const part = parts[partId];
    let damage = shot.damage;
    if (partId === "shield") damage *= 0.28;
    if (partId === "armor") damage *= 0.48;
    if (partId === "ram") damage *= 0.74;
    if (partId === "core") damage *= 1.22;
    damage = Math.max(2.2, damage - defender.stats.defense * 0.38);
    defender.coreHp -= damage;
    defender.hitFlash = 0.18;
    defender.active.add(hitSlot.id);
    spawnImpact(shot.pos, part?.color || 0xffd36b, shot.kind === "missile" ? 0.58 : 0.38);
    cameraShake = Math.max(cameraShake, shot.kind === "missile" ? 0.4 : 0.22);
  }

  function activateRole(fort, role) {
    slotDefs.forEach((slot) => {
      const partId = fort.build.slots[slot.id];
      if (parts[partId]?.role === role) fort.active.add(slot.id);
    });
  }

  function battleResult() {
    if (playerFort.coreHp <= 0 && rivalFort.coreHp <= 0) return "DRAW";
    if (rivalFort.coreHp <= 0 || rivalFort.out) return "WIN";
    if (playerFort.coreHp <= 0 || playerFort.out) return "LOSE";
    return "";
  }

  function scoreResult() {
    const p = playerFort.coreHp + playerFort.x * 3;
    const r = rivalFort.coreHp - rivalFort.x * 3;
    if (Math.abs(p - r) < 2) return "DRAW";
    return p > r ? "WIN" : "LOSE";
  }

  function syncFortressMesh(fort, dt) {
    if (!fort) return;
    fort.hitFlash = Math.max(0, fort.hitFlash - dt);
    fort.group.position.set(fort.x, 0, fort.team === 0 ? -0.18 : 0.18);
    fort.group.userData.slotGroups && Object.entries(fort.group.userData.slotGroups).forEach(([slotId, group]) => {
      const active = fort.active.has(slotId);
      const pulse = active ? 1.12 + Math.sin(battleTime * 24) * 0.05 : 1;
      group.scale.setScalar(pulse);
      group.traverse((child) => {
        if (child.userData.flame) child.visible = active || running;
      });
    });
    fort.group.traverse((child) => {
      if (child.material?.emissive && child.userData.partId !== "core") {
        const amount = fort.hitFlash > 0 ? 0.16 : 0;
        child.material.emissiveIntensity = amount;
      }
    });
  }

  function updateHud() {
    const playerPct = clamp01(playerFort.coreHp / playerFort.stats.hp);
    const rivalPct = clamp01(rivalFort.coreHp / rivalFort.stats.hp);
    els.playerCore.style.width = `${playerPct * 100}%`;
    els.rivalCore.style.width = `${rivalPct * 100}%`;
    els.clock.textContent = battleTime.toFixed(1);
    els.resultLine.textContent = `CORE ${Math.ceil(Math.max(0, playerFort.coreHp))} / ${Math.ceil(Math.max(0, rivalFort.coreHp))}`;
    window.AsyncFortressDebug = {
      time: battleTime,
      player: fortressDebug(playerFort),
      rival: fortressDebug(rivalFort),
      projectiles: projectiles.length
    };
  }

  function fortressDebug(fort) {
    return {
      x: fort.x,
      hp: fort.coreHp,
      maxHp: fort.stats.hp,
      out: fort.out,
      stats: fort.stats
    };
  }

  function slotWorldPosition(fort, slot) {
    const local = slot.local.clone();
    const pos = local.applyAxisAngle(new THREE.Vector3(0, 1, 0), fort.team === 0 ? 0 : Math.PI);
    pos.x += fort.x;
    pos.z += fort.team === 0 ? -0.18 : 0.18;
    return pos;
  }

  function coreWorldPosition(fort) {
    const slot = slotDefs.find((item) => item.id === CORE_SLOT);
    return slotWorldPosition(fort, slot);
  }

  function nearestSlotByWorld(fort, pos) {
    let best = slotDefs[0];
    let bestDistance = Infinity;
    slotDefs.forEach((slot) => {
      const slotPos = slotWorldPosition(fort, slot);
      const distance = Math.hypot(slotPos.y - pos.y, slotPos.z - pos.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = slot;
      }
    });
    return best;
  }

  function spawnImpact(origin, color, power) {
    const group = new THREE.Group();
    group.position.copy(origin);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.08 + power * 0.08, 0.008, 6, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.76, depthWrite: false })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const sparks = [];
    const count = 8 + Math.round(power * 12);
    for (let i = 0; i < count; i += 1) {
      const angle = (TAU * i) / count;
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 6, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })
      );
      spark.userData.velocity = new THREE.Vector3(Math.cos(angle) * (0.6 + power), 0.3 + Math.random() * 0.8, Math.sin(angle) * (0.6 + power));
      group.add(spark);
      sparks.push(spark);
    }
    scene.add(group);
    effects.push({ group, ring, sparks, life: 0, duration: 0.34 + power * 0.2, power });
  }

  function updateEffects(dt) {
    effects.forEach((effect) => {
      effect.life += dt;
      const t = Math.min(1, effect.life / effect.duration);
      effect.ring.scale.setScalar(1 + t * (2.2 + effect.power));
      effect.ring.material.opacity = (1 - t) * 0.76;
      effect.sparks.forEach((spark) => {
        spark.position.addScaledVector(spark.userData.velocity, dt);
        spark.userData.velocity.y -= 2.6 * dt;
        spark.material.opacity = (1 - t) * 0.9;
      });
    });
    effects = effects.filter((effect) => {
      if (effect.life < effect.duration) return true;
      disposeObject(effect.group);
      return false;
    });
  }

  function clearProjectiles() {
    projectiles.forEach((shot) => disposeObject(shot.mesh));
    projectiles = [];
  }

  function clearEffects() {
    effects.forEach((effect) => disposeObject(effect.group));
    effects = [];
  }

  function disposeObject(object) {
    if (object.parent) object.parent.remove(object);
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else if (child.material) child.material.dispose();
    });
  }

  function updateCamera(dt) {
    const compact = window.innerWidth < 760;
    const midpoint = (playerFort.x + rivalFort.x) * 0.5;
    target.x += (midpoint * 0.25 - target.x) * Math.min(1, dt * 2.4);
    target.y += (0.78 - target.y) * Math.min(1, dt * 2.4);
    target.z += (0 - target.z) * Math.min(1, dt * 2.4);
    const height = compact ? 5.9 : 4.9;
    const distance = compact ? 8.4 : 7.0;
    const desired = new THREE.Vector3(target.x, height, distance);
    const shake = cameraShake * (compact ? 0.08 : 0.1);
    desired.x += Math.sin(battleTime * 52) * shake;
    desired.y += Math.cos(battleTime * 41) * shake * 0.35;
    desired.z += Math.cos(battleTime * 47) * shake;
    camera.position.lerp(desired, Math.min(1, dt * 2.2));
    camera.lookAt(target.x, target.y, target.z);
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 760 ? 52 : 44;
    camera.updateProjectionMatrix();
  }

  function encodeFortress(build) {
    const payload = JSON.stringify(sanitizeFortress(build));
    return `AF1.${btoa(unescape(encodeURIComponent(payload)))}`;
  }

  function decodeFortress(source) {
    const text = source.trim();
    if (!text) throw new Error("empty");
    if (text.startsWith("AF1.")) {
      return sanitizeFortress(JSON.parse(decodeURIComponent(escape(atob(text.slice(4))))));
    }
    return sanitizeFortress(JSON.parse(text));
  }

  function sanitizeFortress(value) {
    const clean = makeFortress(String(value.name || "Loaded Fortress").slice(0, 18), {});
    slotDefs.forEach((slot) => {
      if (slot.fixed) {
        clean.slots[slot.id] = "core";
        return;
      }
      const partId = value.slots && parts[value.slots[slot.id]] && value.slots[slot.id] !== "core" ? value.slots[slot.id] : "empty";
      clean.slots[slot.id] = partId;
    });
    return clean;
  }

  function countPart(build, partId) {
    return slotDefs.reduce((sum, slot) => sum + (build.slots[slot.id] === partId ? 1 : 0), 0);
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
})().catch((error) => {
  const target = document.querySelector("#scene") || document.body;
  target.innerHTML = `<div style="padding:24px;color:#f4efe6;font-family:sans-serif">3D runtime failed: ${String(error.message || error)}</div>`;
});

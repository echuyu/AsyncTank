(async function boot() {
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js");
  const RAPIER = await import("https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js");
  await RAPIER.init();

  const TAU = Math.PI * 2;
  const ARENA_RADIUS = 5.18;
  const RIM_RADIUS = 3.2;
  const KO_RADIUS = 4.7;

  const slotDefs = [
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `ring${index}`,
      angle: (TAU * index) / 12,
      label: `R${index + 1}`,
      vertical: 0,
      mapRadius: 42
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `cap${index}`,
      angle: (TAU * index) / 6 + TAU / 12,
      label: `C${index + 1}`,
      vertical: 0.48,
      mapRadius: 23
    }))
  ].map((slot) => ({
    ...slot,
    mapX: 50 + Math.sin(slot.angle) * slot.mapRadius,
    mapY: 50 - Math.cos(slot.angle) * slot.mapRadius
  }));

  const parts = {
    empty: { mark: "·", name: "EMPTY", color: "#687176", mass: 0 },
    eye: { mark: "◉", name: "EYE", color: "#55d8f0", mass: 0.12 },
    jet: { mark: "↯", name: "JET", color: "#ffb84e", mass: 0.22 },
    spike: { mark: "▲", name: "SPIKE", color: "#ff6461", mass: 0.3 },
    cannon: { mark: "●", name: "GUN", color: "#f4df62", mass: 0.36 },
    shield: { mark: "▰", name: "SHIELD", color: "#7ee081", mass: 0.32 },
    weight: { mark: "◆", name: "WEIGHT", color: "#9b8cff", mass: 0.55 }
  };

  const playerPresets = [
    makeBlueprint("Mono Core", {
      ring0: "eye",
      ring1: "spike",
      ring11: "cannon",
      ring3: "shield",
      ring5: "jet",
      ring6: "jet",
      ring8: "weight",
      cap0: "eye",
      cap3: "weight"
    }),
    makeBlueprint("Needle", {
      ring0: "spike",
      ring1: "spike",
      ring11: "spike",
      ring2: "eye",
      ring5: "jet",
      ring6: "jet",
      ring7: "jet",
      cap0: "spike",
      cap2: "weight"
    }),
    makeBlueprint("Orbit", {
      ring0: "eye",
      ring2: "jet",
      ring3: "cannon",
      ring5: "shield",
      ring6: "weight",
      ring8: "jet",
      ring9: "cannon",
      cap1: "eye",
      cap4: "shield"
    }),
    makeBlueprint("Shell", {
      ring0: "cannon",
      ring1: "shield",
      ring2: "shield",
      ring3: "shield",
      ring5: "weight",
      ring6: "jet",
      ring8: "weight",
      ring9: "shield",
      ring10: "shield",
      ring11: "shield",
      cap0: "eye",
      cap3: "weight"
    })
  ];

  const enemyPresets = [
    makeBlueprint("Red Ram", {
      ring0: "eye",
      ring1: "spike",
      ring11: "spike",
      ring5: "jet",
      ring6: "jet",
      ring7: "weight",
      ring9: "shield",
      cap0: "spike"
    }),
    makeBlueprint("Sidewinder", {
      ring2: "eye",
      ring3: "cannon",
      ring4: "jet",
      ring8: "jet",
      ring10: "shield",
      ring6: "weight",
      cap2: "cannon"
    }),
    makeBlueprint("Citadel", {
      ring0: "cannon",
      ring1: "shield",
      ring2: "weight",
      ring3: "shield",
      ring5: "shield",
      ring6: "eye",
      ring7: "shield",
      ring9: "shield",
      ring10: "weight",
      ring11: "shield",
      cap1: "shield",
      cap4: "shield"
    })
  ];

  const els = {
    scene: document.querySelector("#scene"),
    bodyMap: document.querySelector("#bodyMap"),
    palette: document.querySelector("#palette"),
    presets: document.querySelector("#presets"),
    enemySelect: document.querySelector("#enemySelect"),
    battleBtn: document.querySelector("#battleBtn"),
    resetBtn: document.querySelector("#resetBtn"),
    exportBtn: document.querySelector("#exportBtn"),
    importBtn: document.querySelector("#importBtn"),
    codeBox: document.querySelector("#codeBox"),
    botName: document.querySelector("#botName"),
    battleState: document.querySelector("#battleState"),
    playerHp: document.querySelector("#playerHp"),
    enemyHp: document.querySelector("#enemyHp"),
    clock: document.querySelector("#clock")
  };

  let playerBlueprint = clone(playerPresets[0]);
  let enemyBlueprint = clone(enemyPresets[0]);
  let selectedSlot = "ring0";
  let playerBot;
  let enemyBot;
  let projectiles = [];
  let running = false;
  let battleTime = 0;
  let lastTick = performance.now();
  let idleSpin = 0;
  let physicsWorld;
  let arenaWallColliders = [];

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  els.scene.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d1012, 9, 18);

  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 80);
  const target = new THREE.Vector3(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xdffaff, 0x1f1512, 2.8);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  scene.add(key);

  const arena = makeArena();
  scene.add(arena);

  initUi();
  resetBattle();
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);

  function makeBlueprint(name, slotMap) {
    const slots = {};
    slotDefs.forEach((slot) => {
      slots[slot.id] = slotMap[slot.id] || "empty";
    });
    return { version: 3, name, slots };
  }

  function initUi() {
    renderBodyMap();
    renderPalette();
    renderPresets();
    enemyPresets.forEach((preset, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = preset.name;
      els.enemySelect.append(option);
    });

    els.bodyMap.addEventListener("click", (event) => {
      const button = event.target.closest("[data-slot]");
      if (!button) return;
      selectedSlot = button.dataset.slot;
      renderBodyMap();
    });

    els.palette.addEventListener("click", (event) => {
      const button = event.target.closest("[data-part]");
      if (!button) return;
      playerBlueprint.slots[selectedSlot] = button.dataset.part;
      els.codeBox.value = encodeBlueprint(playerBlueprint);
      renderBodyMap();
      resetBattle();
    });

    els.presets.addEventListener("click", (event) => {
      const button = event.target.closest("[data-preset]");
      if (!button) return;
      playerBlueprint = clone(playerPresets[Number(button.dataset.preset)]);
      selectedSlot = "ring0";
      els.codeBox.value = encodeBlueprint(playerBlueprint);
      renderBodyMap();
      renderPresets();
      resetBattle();
    });

    els.enemySelect.addEventListener("change", () => {
      enemyBlueprint = clone(enemyPresets[Number(els.enemySelect.value)]);
      resetBattle();
    });

    els.battleBtn.addEventListener("click", () => {
      resetBattle();
      running = true;
      els.battleState.textContent = "FIGHT";
    });

    els.resetBtn.addEventListener("click", resetBattle);

    els.exportBtn.addEventListener("click", () => {
      els.codeBox.value = encodeBlueprint(playerBlueprint);
      navigator.clipboard?.writeText(els.codeBox.value);
    });

    els.importBtn.addEventListener("click", () => {
      try {
        playerBlueprint = decodeBlueprint(els.codeBox.value);
        selectedSlot = "ring0";
        renderBodyMap();
        renderPresets();
        resetBattle();
      } catch (error) {
        els.battleState.textContent = "BAD CODE";
      }
    });

    els.codeBox.value = encodeBlueprint(playerBlueprint);
  }

  function renderBodyMap() {
    els.botName.textContent = playerBlueprint.name;
    els.bodyMap.innerHTML = '<div class="body-core">CORE</div>';
    slotDefs.forEach((slot) => {
      const partId = playerBlueprint.slots[slot.id] || "empty";
      const part = parts[partId];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `slot-node ${slot.id === selectedSlot ? "active" : ""} ${partId === "empty" ? "empty" : ""}`;
      button.dataset.slot = slot.id;
      button.title = `${slot.label} ${part.name}`;
      button.style.left = `${slot.mapX}%`;
      button.style.top = `${slot.mapY}%`;
      button.style.color = part.color;
      button.textContent = part.mark;
      els.bodyMap.append(button);
    });
  }

  function renderPalette() {
    els.palette.innerHTML = "";
    Object.entries(parts).forEach(([id, part]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "part-button";
      button.dataset.part = id;
      button.title = part.name;
      button.style.color = part.color;
      button.textContent = part.mark;
      els.palette.append(button);
    });
  }

  function renderPresets() {
    els.presets.innerHTML = "";
    playerPresets.forEach((preset, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.preset = String(index);
      button.textContent = preset.name.toUpperCase();
      if (preset.name === playerBlueprint.name) button.classList.add("active");
      els.presets.append(button);
    });
  }

  function makeArena() {
    const group = new THREE.Group();
    const bowl = new THREE.Mesh(
      makeBowlGeometry(ARENA_RADIUS, 20, 144),
      new THREE.MeshStandardMaterial({
        color: 0x1a2326,
        metalness: 0.16,
        roughness: 0.68,
        side: THREE.DoubleSide
      })
    );
    bowl.receiveShadow = true;
    group.add(bowl);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA_RADIUS, 0.055, 14, 144),
      new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0x5a3107, roughness: 0.4 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = bowlHeight(ARENA_RADIUS) + 0.03;
    group.add(ring);

    for (let r = 1; r <= 4; r += 1) {
      const radius = (ARENA_RADIUS * r) / 5;
      const guide = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.012, 8, 96),
        new THREE.MeshStandardMaterial({ color: 0x35545b, emissive: 0x071215, roughness: 0.7 })
      );
      guide.rotation.x = Math.PI / 2;
      guide.position.y = bowlHeight(radius) + 0.014;
      group.add(guide);
    }

    for (let i = 0; i < 24; i += 1) {
      const angle = (Math.PI * 2 * i) / 24;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.72, 0.055),
        new THREE.MeshStandardMaterial({ color: 0x435157, emissive: 0x10191c })
      );
      post.position.set(Math.cos(angle) * ARENA_RADIUS, bowlHeight(ARENA_RADIUS) + 0.35, Math.sin(angle) * ARENA_RADIUS);
      post.rotation.y = -angle;
      group.add(post);
    }

    return group;
  }

  function makeBowlGeometry(radius, rings, segments) {
    const vertices = [];
    const indices = [];
    for (let r = 0; r <= rings; r += 1) {
      const ringRadius = (radius * r) / rings;
      const y = bowlHeight(ringRadius);
      for (let s = 0; s < segments; s += 1) {
        const angle = (TAU * s) / segments;
        vertices.push(Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius);
      }
    }
    for (let r = 0; r < rings; r += 1) {
      for (let s = 0; s < segments; s += 1) {
        const a = r * segments + s;
        const b = r * segments + ((s + 1) % segments);
        const c = (r + 1) * segments + s;
        const d = (r + 1) * segments + ((s + 1) % segments);
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function resetBattle() {
    running = false;
    battleTime = 0;
    clearProjectiles();
    if (playerBot) scene.remove(playerBot.group);
    if (enemyBot) scene.remove(enemyBot.group);
    resetPhysicsWorld();
    playerBot = createBot(playerBlueprint, 0);
    enemyBot = createBot(enemyBlueprint, 1);
    scene.add(playerBot.group, enemyBot.group);
    updateHud();
    els.battleState.textContent = "READY";
  }

  function resetPhysicsWorld() {
    physicsWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
    physicsWorld.timestep = 1 / 90;
    physicsWorld.numSolverIterations = 12;
    physicsWorld.numAdditionalFrictionIterations = 8;
    arenaWallColliders = createArenaWallColliders();
  }

  function createArenaWallColliders() {
    const colliders = [];
    for (let i = 0; i < 32; i += 1) {
      const angle = (TAU * i) / 32;
      const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const rotation = quaternionFromTo(new THREE.Vector3(1, 0, 0), normal);
      const desc = RAPIER.ColliderDesc.cuboid(0.08, 0.78, 0.5)
        .setTranslation(normal.x * 4.98, 0, normal.z * 4.98)
        .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
        .setFriction(0.08)
        .setRestitution(0.82);
      colliders.push(physicsWorld.createCollider(desc));
    }
    return colliders;
  }

  function createBot(blueprint, team) {
    const stats = calcStats(blueprint);
    const bot = {
      team,
      blueprint: clone(blueprint),
      stats,
      hp: stats.maxHp,
      pos: new THREE.Vector2(team === 0 ? -2.1 : 2.1, team === 0 ? -0.42 : 0.42),
      vel: new THREE.Vector2(team === 0 ? 1.15 : -1.15, team === 0 ? 0.24 : -0.24),
      yaw: team === 0 ? 0 : Math.PI,
      omega: team === 0 ? 1.1 : -1.1,
      cooldowns: {},
      active: new Set(),
      out: false,
      outScore: 0,
      outTime: null,
      rimTime: 0,
      body: null,
      colliders: [],
      group: new THREE.Group(),
      core: null,
      partGroups: {}
    };
    bot.group.userData.bot = bot;
    buildBotMesh(bot);
    bot.body = createBotBody(bot);
    syncBotMesh(bot, 0);
    return bot;
  }

  function createBotBody(bot) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(bot.pos.x, 0, bot.pos.y)
      .setLinvel(bot.vel.x, 0, bot.vel.y)
      .setAngvel({ x: 0, y: bot.omega, z: 0 })
      .enabledTranslations(true, false, true)
      .enabledRotations(false, true, false)
      .setLinearDamping(0.2)
      .setAngularDamping(0.42)
      .setCcdEnabled(true)
      .setCanSleep(false);
    const body = physicsWorld.createRigidBody(bodyDesc);
    body.setAdditionalSolverIterations(8);

    bot.colliders.push(
      physicsWorld.createCollider(
        RAPIER.ColliderDesc.ball(0.72).setMass(1.25).setFriction(0.16).setRestitution(0.58).setContactSkin(0.012),
        body
      )
    );

    slotDefs.forEach((slot) => {
      const partId = bot.blueprint.slots[slot.id] || "empty";
      if (partId === "empty") return;
      const colliderDesc = createPartColliderDesc(partId, slot);
      if (colliderDesc) bot.colliders.push(physicsWorld.createCollider(colliderDesc, body));
    });

    body.recomputeMassPropertiesFromColliders();
    return body;
  }

  function createPartColliderDesc(partId, slot) {
    const part = parts[partId];
    const normal = slotNormal(slot);
    const colliderMass = Math.max(0.02, part.mass * (partId === "weight" ? 2.4 : 1.45));
    let desc;
    let offsetScale = 0.96;
    let rotation = quaternionFromTo(new THREE.Vector3(0, 1, 0), normal);

    if (partId === "eye") {
      desc = RAPIER.ColliderDesc.ball(0.18).setRestitution(0.72).setFriction(0.1);
      offsetScale = 0.9;
    } else if (partId === "jet") {
      desc = RAPIER.ColliderDesc.cone(0.24, 0.18).setRestitution(0.68).setFriction(0.08);
      offsetScale = 0.98;
      rotation = quaternionFromTo(new THREE.Vector3(0, 1, 0), normal.clone().negate());
    } else if (partId === "spike") {
      desc = RAPIER.ColliderDesc.cone(0.36, 0.19).setRestitution(0.92).setFriction(0.05);
      offsetScale = 1.08;
    } else if (partId === "cannon") {
      desc = RAPIER.ColliderDesc.capsule(0.32, 0.1).setRestitution(0.72).setFriction(0.08);
      offsetScale = 1.06;
    } else if (partId === "shield") {
      desc = RAPIER.ColliderDesc.cuboid(0.05, 0.36, 0.48).setRestitution(0.28).setFriction(0.54);
      offsetScale = 0.93;
      rotation = quaternionFromTo(new THREE.Vector3(1, 0, 0), normal);
    } else if (partId === "weight") {
      desc = RAPIER.ColliderDesc.ball(0.31).setRestitution(0.38).setFriction(0.32);
      offsetScale = 0.85;
    }

    if (!desc) return null;
    const offset = normal.clone().multiplyScalar(offsetScale);
    desc.setTranslation(offset.x, offset.y * 0.82, offset.z);
    desc.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    desc.setMass(colliderMass);
    desc.setContactSkin(0.01);
    return desc;
  }

  function calcStats(blueprint) {
    let mass = 1.25;
    let armor = 1;
    let maxHp = 150;
    slotDefs.forEach((slot) => {
      const partId = blueprint.slots[slot.id] || "empty";
      mass += parts[partId].mass;
      if (partId === "shield") maxHp += 13;
      if (partId === "weight") {
        maxHp += 8;
        armor += 0.04;
      }
    });
    return { mass, inertia: mass * 0.92, maxHp, armor };
  }

  function buildBotMesh(bot) {
    const teamColor = bot.team === 0 ? 0x55d8f0 : 0xff6461;
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: teamColor,
      metalness: 0.2,
      roughness: 0.45,
      emissive: bot.team === 0 ? 0x10343d : 0x3d1010
    });
    bot.core = new THREE.Mesh(new THREE.SphereGeometry(0.72, 40, 24), coreMaterial);
    bot.core.castShadow = true;
    bot.core.receiveShadow = true;
    bot.group.add(bot.core);

    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.73, 0.012, 8, 80),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 })
    );
    seam.rotation.x = Math.PI / 2;
    bot.group.add(seam);

    slotDefs.forEach((slot) => {
      const partId = bot.blueprint.slots[slot.id] || "empty";
      if (partId === "empty") return;
      const partGroup = createPartGroup(partId, slot);
      bot.partGroups[slot.id] = partGroup;
      bot.group.add(partGroup);
    });
  }

  function createPartGroup(partId, slot) {
    const part = parts[partId];
    const group = new THREE.Group();
    group.userData.partId = partId;
    const normal = slotNormal(slot);
    group.position.copy(normal.clone().multiplyScalar(0.72));

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(part.color),
      roughness: 0.45,
      metalness: 0.22,
      emissive: new THREE.Color(part.color).multiplyScalar(0.18)
    });

    if (partId === "eye") {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), material);
      lens.position.copy(normal.clone().multiplyScalar(0.16));
      lens.castShadow = true;
      group.add(lens);
    }

    if (partId === "jet") {
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.46, 18), material);
      alignY(nozzle, normal.clone().negate());
      nozzle.position.copy(normal.clone().multiplyScalar(0.08));
      nozzle.castShadow = true;
      group.add(nozzle);

      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.54, 16),
        new THREE.MeshStandardMaterial({ color: 0xfff2a0, emissive: 0xff7a1a, transparent: true, opacity: 0.82 })
      );
      alignY(flame, normal);
      flame.position.copy(normal.clone().multiplyScalar(0.42));
      flame.visible = false;
      flame.userData.flame = true;
      group.add(flame);
    }

    if (partId === "spike") {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.64, 22), material);
      alignY(spike, normal);
      spike.position.copy(normal.clone().multiplyScalar(0.28));
      spike.castShadow = true;
      group.add(spike);
    }

    if (partId === "cannon") {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.72, 18), material);
      alignY(barrel, normal);
      barrel.position.copy(normal.clone().multiplyScalar(0.28));
      barrel.castShadow = true;
      group.add(barrel);
    }

    if (partId === "shield") {
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.68), material);
      alignX(shield, normal);
      shield.position.copy(normal.clone().multiplyScalar(0.22));
      shield.castShadow = true;
      group.add(shield);
    }

    if (partId === "weight") {
      const weight = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), material);
      weight.position.copy(normal.clone().multiplyScalar(0.16));
      weight.castShadow = true;
      group.add(weight);
    }

    return group;
  }

  function alignY(mesh, direction) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  }

  function alignX(mesh, direction) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTick) / 1000 || 0.016);
    lastTick = now;
    idleSpin += dt;

    if (running) updateBattle(dt);
    else {
      playerBot.yaw += dt * 0.18;
      enemyBot.yaw -= dt * 0.18;
    }

    syncBotMesh(playerBot, dt);
    syncBotMesh(enemyBot, dt);
    updateProjectilesVisuals();
    updateCamera(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function updateBattle(dt) {
    battleTime += dt;
    updateArenaWalls();
    playerBot.active.clear();
    enemyBot.active.clear();
    updateBot(playerBot, enemyBot, dt);
    updateBot(enemyBot, playerBot, dt);
    applyArenaForces(playerBot, dt);
    applyArenaForces(enemyBot, dt);
    stepPhysics(dt);
    updateProjectiles(dt);
    handleBotCollision(dt);
    updateHud();

    if (playerBot.out || enemyBot.out || playerBot.hp <= 0 || enemyBot.hp <= 0 || battleTime >= 45) {
      running = false;
      const p = scoreBot(playerBot);
      const e = scoreBot(enemyBot);
      els.battleState.textContent = p === e ? "DRAW" : p > e ? "WIN" : "LOSE";
    }
  }

  function updateArenaWalls() {
    const enabled = battleTime < 13.5;
    arenaWallColliders.forEach((collider) => {
      if (collider.isEnabled() !== enabled) collider.setEnabled(enabled);
    });
  }

  function updateBot(bot, opponent, dt) {
    slotDefs.forEach((slot) => {
      bot.cooldowns[slot.id] = Math.max(0, (bot.cooldowns[slot.id] || 0) - dt);
    });

    const toEnemy = angleTo(bot.pos, opponent.pos);
    const distance = bot.pos.distanceTo(opponent.pos);
    const eyeCount = countPart(bot.blueprint, "eye");

    slotDefs.forEach((slot) => {
      const partId = bot.blueprint.slots[slot.id];
      const mountAngle = bot.yaw + slot.angle;
      const aimDiff = wrapAngle(toEnemy - mountAngle);

      if (partId === "eye") {
        addBotSpin(bot, aimDiff * 4.2 * dt / bot.stats.inertia);
        if (Math.abs(aimDiff) < 0.42) bot.active.add(slot.id);
      }

      if (partId === "jet") {
        const pulse = 0.85 + Math.sin(battleTime * 7.5 + slot.angle * 2) * 0.16;
        const mountPower = 1 - Math.abs(slot.vertical || 0) * 0.3;
        const forceAngle = mountAngle + Math.PI;
        applyForce(bot, forceAngle, 3.35 * pulse * mountPower, mountAngle, dt);
        bot.active.add(slot.id);
      }

      if (partId === "shield" && Math.abs(aimDiff) < 0.9) {
        bot.active.add(slot.id);
      }

      if (partId === "cannon") {
        const cone = eyeCount > 0 ? 0.4 : 0.28;
        if (distance < 6.0 && Math.abs(aimDiff) < cone && bot.cooldowns[slot.id] <= 0) {
          fireProjectile(bot, slot, mountAngle);
          bot.cooldowns[slot.id] = 1.05;
          bot.active.add(slot.id);
        }
      }
    });

    if (eyeCount === 0) {
      addBotSpin(bot, wrapAngle(toEnemy - bot.yaw) * 0.22 * dt);
    } else {
      const seek = vectorFromAngle(toEnemy).multiplyScalar((0.18 + eyeCount * 0.04) * dt);
      addBotVelocity(bot, seek);
    }
  }

  function applyForce(bot, forceAngle, power, mountAngle, dt) {
    const force = vectorFromAngle(forceAngle).multiplyScalar(power);
    const r = vectorFromAngle(mountAngle).multiplyScalar(0.72);
    if (bot.body && !bot.out) {
      bot.body.addForceAtPoint(
        { x: force.x, y: 0, z: force.y },
        { x: bot.pos.x + r.x, y: 0, z: bot.pos.y + r.y },
        true
      );
      return;
    }
    bot.vel.add(force.clone().multiplyScalar(dt / bot.stats.mass));
    addBotSpin(bot, ((r.x * force.y - r.y * force.x) * dt) / bot.stats.inertia);
  }

  function applyArenaForces(bot, dt) {
    if (bot.out || !bot.body) return;

    const radius = bot.pos.length();
    if (radius > 0.02) {
      const towardCenter = bot.pos.clone().normalize().multiplyScalar(-(0.24 + radius * 0.12) * bot.stats.mass);
      bot.body.addForce({ x: towardCenter.x, y: 0, z: towardCenter.y }, true);
    }

    const tilt = Math.min(1.55, Math.max(0, battleTime - 10) * 0.055);
    if (tilt > 0) {
      const tiltAngle = battleTime * 0.72;
      const tiltForce = { x: Math.cos(tiltAngle) * tilt * bot.stats.mass, y: 0, z: Math.sin(tiltAngle) * tilt * bot.stats.mass };
      bot.body.addForce(tiltForce, true);
    }

    const dangerRadius = RIM_RADIUS - Math.min(0.65, Math.max(0, battleTime - 16) * 0.035);
    const wallsActive = battleTime < 13.5;
    if (radius > dangerRadius) {
      const normal = bot.pos.clone().normalize();
      const outward = bot.vel.dot(normal);
      const slip = Math.max(0, radius - dangerRadius);
      if (!wallsActive) {
        bot.rimTime += (1 + slip * 2.2 + Math.max(0, outward) * 0.5) * dt;
      }
      bot.hp -= (3.6 + slip * 6 + Math.max(0, outward) * 4.1) * dt;
      if (outward > 0.05) {
        const rimForce = normal.multiplyScalar((0.18 + slip * 1.0) * bot.stats.mass);
        bot.body.addForce({ x: rimForce.x, y: 0, z: rimForce.y }, true);
      }
      addBotSpin(bot, (bot.team === 0 ? -1 : 1) * 0.35 * dt);
    } else {
      bot.rimTime = Math.max(0, bot.rimTime - dt * 2.2);
    }

    if ((wallsActive && radius > ARENA_RADIUS + 0.65) || (!wallsActive && (radius > KO_RADIUS || bot.rimTime > 1.8))) {
      knockOutBot(bot);
    }
  }

  function stepPhysics(dt) {
    const steps = Math.min(5, Math.max(1, Math.ceil(dt / (1 / 90))));
    const stepDt = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      physicsWorld.timestep = stepDt;
      physicsWorld.step();
    }
    syncBotStateFromBody(playerBot, dt);
    syncBotStateFromBody(enemyBot, dt);
  }

  function syncBotStateFromBody(bot, dt) {
    if (!bot.body) return;
    const translation = bot.body.translation();
    const velocity = bot.body.linvel();
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed > 7.4) {
      const scale = 7.4 / speed;
      bot.body.setLinvel({ x: velocity.x * scale, y: 0, z: velocity.z * scale }, true);
      velocity.x *= scale;
      velocity.z *= scale;
    } else if (Math.abs(velocity.y) > 0.0001) {
      bot.body.setLinvel({ x: velocity.x, y: 0, z: velocity.z }, true);
    }

    if (Math.abs(translation.y) > 0.0001) {
      bot.body.setTranslation({ x: translation.x, y: 0, z: translation.z }, true);
    }

    bot.pos.set(translation.x, translation.z);
    bot.vel.set(velocity.x, velocity.z);
    bot.omega = bot.body.angvel().y;
    bot.yaw = yawFromQuaternion(bot.body.rotation());
    bot.hp = Math.max(0, bot.hp);
  }

  function addBotVelocity(bot, delta) {
    bot.vel.add(delta);
    if (bot.body && !bot.out) {
      const velocity = bot.body.linvel();
      bot.body.setLinvel({ x: velocity.x + delta.x, y: 0, z: velocity.z + delta.y }, true);
    }
  }

  function addBotSpin(bot, delta) {
    bot.omega += delta;
    if (bot.body && !bot.out) {
      const angular = bot.body.angvel();
      bot.body.setAngvel({ x: 0, y: angular.y + delta, z: 0 }, true);
    }
  }

  function knockOutBot(bot) {
    if (bot.out) return;
    bot.out = true;
    bot.outTime = battleTime;
    bot.outScore = Math.max(0, bot.hp) - bot.pos.length() * 3 - bot.rimTime * 8;
    bot.hp = 0;
    const exitNormal = bot.pos.length() > 0.01 ? bot.pos.clone().normalize() : new THREE.Vector2(bot.team === 0 ? -1 : 1, 0);
    bot.pos.copy(exitNormal.clone().multiplyScalar(ARENA_RADIUS + 0.28));
    bot.vel.add(exitNormal.clone().multiplyScalar(1.7));
    bot.omega += bot.team === 0 ? -2.6 : 2.6;
    if (bot.body) {
      bot.colliders.forEach((collider) => collider.setEnabled(false));
      bot.body.setTranslation({ x: bot.pos.x, y: 0, z: bot.pos.y }, true);
      bot.body.setLinvel({ x: bot.vel.x, y: 0, z: bot.vel.y }, true);
      bot.body.setAngvel({ x: 0, y: bot.omega, z: 0 }, true);
    }
  }

  function fireProjectile(bot, slot, mountAngle) {
    const normal = vectorFromAngle(mountAngle);
    const pos = bot.pos.clone().add(normal.clone().multiplyScalar(0.95));
    const vel = normal.clone().multiplyScalar(6.2).add(bot.vel.clone().multiplyScalar(0.45));
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 8),
      new THREE.MeshStandardMaterial({
        color: bot.team === 0 ? 0x55d8f0 : 0xff6461,
        emissive: bot.team === 0 ? 0x1bc7ee : 0xff2525
      })
    );
    mesh.castShadow = true;
    scene.add(mesh);
    projectiles.push({ team: bot.team, pos, vel, life: 1.35, damage: 13, mesh });
  }

  function updateProjectiles(dt) {
    projectiles.forEach((shot) => {
      shot.pos.add(shot.vel.clone().multiplyScalar(dt));
      shot.life -= dt;
      const targetBot = shot.team === 0 ? enemyBot : playerBot;
      if (shot.pos.distanceTo(targetBot.pos) < 0.76 && targetBot.hp > 0) {
        damageBot(targetBot, shot.damage, angleTo(targetBot.pos, shot.pos));
        addBotVelocity(targetBot, shot.vel.clone().normalize().multiplyScalar(0.55));
        shot.life = 0;
      }
      if (shot.pos.length() > 5.7) shot.life = 0;
    });

    projectiles = projectiles.filter((shot) => {
      if (shot.life > 0) return true;
      scene.remove(shot.mesh);
      shot.mesh.geometry.dispose();
      shot.mesh.material.dispose();
      return false;
    });
  }

  function handleBotCollision(dt) {
    const delta = enemyBot.pos.clone().sub(playerBot.pos);
    const distance = Math.max(delta.length(), 0.0001);
    if (distance >= 1.46) return;

    const normal = delta.multiplyScalar(1 / distance);
    contactDamage(playerBot, enemyBot, normal, dt);
    contactDamage(enemyBot, playerBot, normal.clone().multiplyScalar(-1), dt);
  }

  function contactDamage(attacker, defender, directionToDefender, dt) {
    const hitAngle = Math.atan2(directionToDefender.y, directionToDefender.x);
    let damage = 2.2 * dt;
    slotDefs.forEach((slot) => {
      const partId = attacker.blueprint.slots[slot.id];
      const diff = Math.abs(wrapAngle(hitAngle - (attacker.yaw + slot.angle)));
      if (partId === "spike" && diff < 0.72) {
        damage += 18 * dt;
        addBotVelocity(defender, directionToDefender.clone().multiplyScalar(0.5 * dt));
        attacker.active.add(slot.id);
      }
      if (partId === "weight" && diff < 0.95) {
        damage += 4 * dt;
        addBotVelocity(defender, directionToDefender.clone().multiplyScalar(0.25 * dt));
        attacker.active.add(slot.id);
      }
    });
    damageBot(defender, damage, hitAngle + Math.PI);
  }

  function damageBot(bot, amount, sourceAngle) {
    let multiplier = 1 / bot.stats.armor;
    slotDefs.forEach((slot) => {
      const partId = bot.blueprint.slots[slot.id];
      if (partId !== "shield") return;
      const diff = Math.abs(wrapAngle(sourceAngle - (bot.yaw + slot.angle)));
      if (diff < 0.82) {
        multiplier *= 0.38;
        bot.active.add(slot.id);
      }
    });
    bot.hp -= amount * multiplier;
  }

  function syncBotMesh(bot, dt) {
    const radius = bot.pos.length();
    const y = bowlHeight(Math.min(radius, ARENA_RADIUS)) + 0.64 - (bot.out ? Math.max(0, radius - ARENA_RADIUS) * 0.55 : 0);
    bot.group.position.set(bot.pos.x, y, bot.pos.y);
    bot.group.rotation.y = -bot.yaw;
    bot.core.rotation.x += bot.vel.y * dt * 1.6;
    bot.core.rotation.z -= bot.vel.x * dt * 1.6;
    Object.entries(bot.partGroups).forEach(([slotId, group]) => {
      const active = bot.active.has(slotId);
      const scale = active ? 1.12 + Math.sin(idleSpin * 18) * 0.04 : 1;
      group.scale.setScalar(scale);
      group.traverse((child) => {
        if (child.userData.flame) child.visible = active;
      });
    });
  }

  function updateProjectilesVisuals() {
    projectiles.forEach((shot) => {
      shot.mesh.position.set(shot.pos.x, bowlHeight(Math.min(shot.pos.length(), ARENA_RADIUS)) + 0.7, shot.pos.y);
    });
  }

  function updateCamera(dt) {
    const compact = window.innerWidth < 760;
    const midpoint = playerBot.pos.clone().add(enemyBot.pos).multiplyScalar(0.5);
    target.x += (midpoint.x * 0.25 - target.x) * Math.min(1, dt * 3.2);
    target.z += (midpoint.y * 0.25 - target.z) * Math.min(1, dt * 3.2);
    const distance = compact ? 9.8 : 8.5;
    const height = compact ? 8.3 : 7.0;
    camera.position.x += (target.x - camera.position.x) * Math.min(1, dt * 2);
    camera.position.y += (height - camera.position.y) * Math.min(1, dt * 2);
    camera.position.z += (distance + target.z - camera.position.z) * Math.min(1, dt * 2);
    camera.lookAt(target.x, -0.15, target.z);
  }

  function updateHud() {
    els.playerHp.style.width = `${Math.max(0, (playerBot.hp / playerBot.stats.maxHp) * 100)}%`;
    els.enemyHp.style.width = `${Math.max(0, (enemyBot.hp / enemyBot.stats.maxHp) * 100)}%`;
    els.clock.textContent = battleTime.toFixed(1);
    const dangerRadius = RIM_RADIUS - Math.min(0.65, Math.max(0, battleTime - 16) * 0.035);
    window.AsyncTankDebug = {
      time: battleTime,
      dangerRadius,
      player: {
        radius: playerBot.pos.length(),
        hp: playerBot.hp,
        out: playerBot.out,
        rimTime: playerBot.rimTime
      },
      enemy: {
        radius: enemyBot.pos.length(),
        hp: enemyBot.hp,
        out: enemyBot.out,
        rimTime: enemyBot.rimTime
      }
    };
    document.body.dataset.playerRadius = playerBot.pos.length().toFixed(3);
    document.body.dataset.enemyRadius = enemyBot.pos.length().toFixed(3);
    document.body.dataset.playerRim = playerBot.rimTime.toFixed(3);
    document.body.dataset.enemyRim = enemyBot.rimTime.toFixed(3);
    document.body.dataset.dangerRadius = dangerRadius.toFixed(3);
  }

  function scoreBot(bot) {
    if (bot.out) return -1000 + (bot.outTime || 0) + bot.outScore * 0.01;
    return Math.max(0, bot.hp) - bot.pos.length() * 4;
  }

  function clearProjectiles() {
    projectiles.forEach((shot) => {
      scene.remove(shot.mesh);
      shot.mesh.geometry.dispose();
      shot.mesh.material.dispose();
    });
    projectiles = [];
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 760 ? 50 : 43;
    camera.updateProjectionMatrix();
  }

  function countPart(blueprint, partId) {
    return slotDefs.reduce((sum, slot) => sum + (blueprint.slots[slot.id] === partId ? 1 : 0), 0);
  }

  function encodeBlueprint(blueprint) {
    const payload = JSON.stringify(sanitizeBlueprint(blueprint));
    return `KB1.${btoa(unescape(encodeURIComponent(payload)))}`;
  }

  function decodeBlueprint(source) {
    const text = source.trim();
    if (!text) throw new Error("empty");
    if (text.startsWith("KB1.")) {
      return sanitizeBlueprint(JSON.parse(decodeURIComponent(escape(atob(text.slice(4))))));
    }
    return sanitizeBlueprint(JSON.parse(text));
  }

  function sanitizeBlueprint(value) {
    const clean = makeBlueprint(String(value.name || "Custom Core").slice(0, 18), {});
    slotDefs.forEach((slot) => {
      const partId = value.slots && parts[value.slots[slot.id]] ? value.slots[slot.id] : "empty";
      clean.slots[slot.id] = partId;
    });
    return clean;
  }

  function bowlHeight(radius) {
    const t = Math.min(radius / ARENA_RADIUS, 1.25);
    return -0.78 + t * t * 0.62;
  }

  function slotNormal(slot) {
    const y = slot.vertical || 0;
    const horizontal = Math.sqrt(Math.max(0.001, 1 - y * y));
    return new THREE.Vector3(Math.cos(slot.angle) * horizontal, y, Math.sin(slot.angle) * horizontal).normalize();
  }

  function quaternionFromTo(from, to) {
    return new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()).normalize();
  }

  function yawFromQuaternion(q) {
    return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
  }

  function vectorFromAngle(angle) {
    return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  }

  function angleTo(from, to) {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  function wrapAngle(angle) {
    let value = angle;
    while (value > Math.PI) value -= Math.PI * 2;
    while (value < -Math.PI) value += Math.PI * 2;
    return value;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
})().catch((error) => {
  const target = document.querySelector("#scene") || document.body;
  target.innerHTML = `<div style="padding:24px;color:#f4efe6;font-family:sans-serif">3D runtime failed: ${String(error.message || error)}</div>`;
});

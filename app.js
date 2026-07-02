(async function boot() {
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js");

  const slotDefs = [
    ["front", 0, "F"],
    ["frontRight", Math.PI / 4, "FR"],
    ["right", Math.PI / 2, "R"],
    ["backRight", (Math.PI * 3) / 4, "BR"],
    ["back", Math.PI, "B"],
    ["backLeft", (-Math.PI * 3) / 4, "BL"],
    ["left", -Math.PI / 2, "L"],
    ["frontLeft", -Math.PI / 4, "FL"]
  ].map(([id, angle, label]) => ({ id, angle, label }));

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
      front: "eye",
      frontLeft: "cannon",
      frontRight: "spike",
      back: "jet",
      left: "weight",
      right: "shield"
    }),
    makeBlueprint("Needle", {
      front: "spike",
      frontLeft: "spike",
      frontRight: "spike",
      back: "jet",
      backLeft: "jet",
      backRight: "jet",
      left: "eye"
    }),
    makeBlueprint("Orbit", {
      front: "eye",
      left: "jet",
      right: "cannon",
      backLeft: "cannon",
      backRight: "shield",
      back: "weight"
    }),
    makeBlueprint("Shell", {
      front: "cannon",
      frontLeft: "shield",
      frontRight: "shield",
      left: "shield",
      right: "shield",
      back: "jet",
      backLeft: "weight",
      backRight: "weight"
    })
  ];

  const enemyPresets = [
    makeBlueprint("Red Ram", {
      front: "eye",
      frontLeft: "spike",
      frontRight: "spike",
      back: "jet",
      backLeft: "jet",
      backRight: "weight",
      left: "shield"
    }),
    makeBlueprint("Sidewinder", {
      left: "eye",
      right: "cannon",
      backRight: "jet",
      frontRight: "jet",
      front: "shield",
      back: "weight"
    }),
    makeBlueprint("Citadel", {
      front: "cannon",
      frontLeft: "shield",
      frontRight: "shield",
      left: "weight",
      right: "weight",
      backLeft: "shield",
      backRight: "shield",
      back: "eye"
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
  let selectedSlot = "front";
  let playerBot;
  let enemyBot;
  let projectiles = [];
  let running = false;
  let battleTime = 0;
  let lastTick = performance.now();
  let idleSpin = 0;

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
    return { version: 2, name, slots };
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
      selectedSlot = "front";
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
        selectedSlot = "front";
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
      const x = 50 + Math.sin(slot.angle) * 42;
      const y = 50 - Math.cos(slot.angle) * 42;
      button.type = "button";
      button.className = `slot-node ${slot.id === selectedSlot ? "active" : ""} ${partId === "empty" ? "empty" : ""}`;
      button.dataset.slot = slot.id;
      button.title = `${slot.label} ${part.name}`;
      button.style.left = `${x}%`;
      button.style.top = `${y}%`;
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
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(5.7, 5.7, 0.18, 96),
      new THREE.MeshStandardMaterial({ color: 0x1c2325, metalness: 0.15, roughness: 0.72 })
    );
    floor.receiveShadow = true;
    floor.position.y = -0.72;
    group.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.75, 0.045, 12, 120),
      new THREE.MeshStandardMaterial({ color: 0xffb84e, emissive: 0x4c2c08, roughness: 0.45 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.58;
    group.add(ring);

    const grid = new THREE.GridHelper(11, 22, 0x35545b, 0x263033);
    grid.position.y = -0.61;
    group.add(grid);

    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.6, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x435157, emissive: 0x10191c })
      );
      post.position.set(Math.cos(angle) * 5.72, -0.34, Math.sin(angle) * 5.72);
      post.rotation.y = -angle;
      group.add(post);
    }

    return group;
  }

  function resetBattle() {
    running = false;
    battleTime = 0;
    clearProjectiles();
    if (playerBot) scene.remove(playerBot.group);
    if (enemyBot) scene.remove(enemyBot.group);
    playerBot = createBot(playerBlueprint, 0);
    enemyBot = createBot(enemyBlueprint, 1);
    scene.add(playerBot.group, enemyBot.group);
    updateHud();
    els.battleState.textContent = "READY";
  }

  function createBot(blueprint, team) {
    const stats = calcStats(blueprint);
    const bot = {
      team,
      blueprint: clone(blueprint),
      stats,
      hp: stats.maxHp,
      pos: new THREE.Vector2(team === 0 ? -2.15 : 2.15, team === 0 ? -0.35 : 0.35),
      vel: new THREE.Vector2(0, 0),
      yaw: team === 0 ? 0 : Math.PI,
      omega: 0,
      cooldowns: {},
      active: new Set(),
      group: new THREE.Group(),
      core: null,
      partGroups: {}
    };
    bot.group.userData.bot = bot;
    buildBotMesh(bot);
    syncBotMesh(bot, 0);
    return bot;
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
      const partGroup = createPartGroup(partId, slot.angle);
      bot.partGroups[slot.id] = partGroup;
      bot.group.add(partGroup);
    });
  }

  function createPartGroup(partId, angle) {
    const part = parts[partId];
    const group = new THREE.Group();
    group.userData.partId = partId;
    const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
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
    playerBot.active.clear();
    enemyBot.active.clear();
    updateBot(playerBot, enemyBot, dt);
    updateBot(enemyBot, playerBot, dt);
    integrateBot(playerBot, dt);
    integrateBot(enemyBot, dt);
    updateProjectiles(dt);
    handleBotCollision(dt);
    updateHud();

    if (playerBot.hp <= 0 || enemyBot.hp <= 0 || battleTime >= 45) {
      running = false;
      const p = Math.max(0, playerBot.hp);
      const e = Math.max(0, enemyBot.hp);
      els.battleState.textContent = p === e ? "DRAW" : p > e ? "WIN" : "LOSE";
    }
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
        bot.omega += aimDiff * 4.2 * dt / bot.stats.inertia;
        if (Math.abs(aimDiff) < 0.42) bot.active.add(slot.id);
      }

      if (partId === "jet") {
        const pulse = 0.85 + Math.sin(battleTime * 7.5 + slot.angle * 2) * 0.16;
        const forceAngle = mountAngle + Math.PI;
        applyForce(bot, forceAngle, 3.2 * pulse, mountAngle, dt);
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
      bot.omega += wrapAngle(toEnemy - bot.yaw) * 0.22 * dt;
    }
  }

  function applyForce(bot, forceAngle, power, mountAngle, dt) {
    const force = vectorFromAngle(forceAngle).multiplyScalar(power);
    bot.vel.add(force.clone().multiplyScalar(dt / bot.stats.mass));
    const r = vectorFromAngle(mountAngle).multiplyScalar(0.72);
    const torque = r.x * force.y - r.y * force.x;
    bot.omega += (torque * dt) / bot.stats.inertia;
  }

  function integrateBot(bot, dt) {
    bot.pos.add(bot.vel.clone().multiplyScalar(dt));
    bot.yaw = wrapAngle(bot.yaw + bot.omega * dt);
    bot.vel.multiplyScalar(Math.exp(-1.15 * dt));
    bot.omega *= Math.exp(-1.85 * dt);

    const limit = 4.85;
    const radius = bot.pos.length();
    if (radius > limit) {
      const normal = bot.pos.clone().normalize();
      bot.pos.copy(normal.multiplyScalar(limit));
      const outward = bot.vel.dot(normal);
      if (outward > 0) bot.vel.add(normal.multiplyScalar(-outward * 1.55));
      bot.omega += (bot.team === 0 ? -1 : 1) * 0.2;
      bot.hp -= 1.5 * dt;
    }

    if (bot.vel.length() > 5.2) bot.vel.setLength(5.2);
    bot.hp = Math.max(0, bot.hp);
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
    const overlap = 1.46 - distance;
    playerBot.pos.add(normal.clone().multiplyScalar(-overlap * 0.5));
    enemyBot.pos.add(normal.clone().multiplyScalar(overlap * 0.5));

    const rel = playerBot.vel.clone().sub(enemyBot.vel);
    const impact = Math.max(0.8, Math.abs(rel.dot(normal)) + 0.4);
    playerBot.vel.add(normal.clone().multiplyScalar(-impact * 0.7));
    enemyBot.vel.add(normal.clone().multiplyScalar(impact * 0.7));

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
        damage += 24 * dt;
        attacker.active.add(slot.id);
      }
      if (partId === "weight" && diff < 0.95) {
        damage += 7 * dt;
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
    bot.group.position.set(bot.pos.x, 0, bot.pos.y);
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
      shot.mesh.position.set(shot.pos.x, -0.03, shot.pos.y);
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

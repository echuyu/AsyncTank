const OPTIONS = {
  body: {
    light: { label: "Light", hp: 78, speed: 1.55, armor: 0.9, cost: 2 },
    medium: { label: "Medium", hp: 105, speed: 1.18, armor: 1, cost: 3 },
    heavy: { label: "Heavy", hp: 140, speed: 0.86, armor: 1.18, cost: 4 }
  },
  weapon: {
    pulse: { label: "Pulse", range: 150, damage: 7, cooldown: 20, color: "#56c7d9", cost: 2 },
    missile: { label: "Missile", range: 230, damage: 14, cooldown: 45, color: "#f0b94d", cost: 4 },
    drill: { label: "Drill", range: 38, damage: 20, cooldown: 24, color: "#f05f57", cost: 3 },
    net: { label: "Net", range: 120, damage: 4, cooldown: 36, color: "#79c267", slow: 32, cost: 2 }
  },
  module: {
    dash: { label: "Dash", cost: 2 },
    shield: { label: "Shield", cost: 3 },
    radar: { label: "Radar", cost: 2 },
    repair: { label: "Repair", cost: 3 }
  },
  place: {
    front: { label: "Front" },
    mid: { label: "Mid" },
    back: { label: "Back" }
  },
  when: {
    "enemy.core.visible": "Enemy core visible",
    "hp < 40": "HP below 40%",
    "enemy.distance > 160": "Enemy far",
    "enemy.distance < 70": "Enemy near",
    "ally.hp < 50": "Ally hurt",
    "always": "Always"
  },
  then: {
    "attack.core": "Attack core",
    "attack.nearest": "Attack nearest",
    "move.forward": "Move forward",
    "kite": "Keep distance",
    "shield": "Shield",
    "repair": "Repair",
    "cover.ally": "Cover ally"
  }
};

const DEFAULT_TEAM = {
  version: 1,
  name: "Rush Seed",
  units: [
    unit("Breaker", "heavy", "drill", "shield", "front", [
      ["enemy.core.visible", "attack.core"],
      ["hp < 40", "shield"],
      ["enemy.distance > 160", "move.forward"]
    ]),
    unit("Catcher", "medium", "net", "radar", "mid", [
      ["enemy.distance < 70", "kite"],
      ["ally.hp < 50", "cover.ally"],
      ["always", "attack.nearest"]
    ]),
    unit("Needle", "light", "pulse", "dash", "back", [
      ["enemy.distance > 160", "move.forward"],
      ["hp < 40", "kite"],
      ["always", "attack.nearest"]
    ])
  ]
};

const SAMPLE_ENEMY = {
  version: 1,
  name: "Training Wall",
  units: [
    unit("Anchor", "heavy", "missile", "repair", "back", [
      ["hp < 40", "repair"],
      ["enemy.distance > 160", "attack.nearest"],
      ["always", "attack.core"]
    ]),
    unit("Guard", "medium", "pulse", "shield", "mid", [
      ["enemy.distance < 70", "shield"],
      ["ally.hp < 50", "cover.ally"],
      ["always", "attack.nearest"]
    ]),
    unit("Hook", "light", "net", "dash", "front", [
      ["enemy.distance > 160", "move.forward"],
      ["enemy.distance < 70", "kite"],
      ["always", "attack.nearest"]
    ])
  ]
};

let team = clone(DEFAULT_TEAM);
let enemyTeam = clone(SAMPLE_ENEMY);
let sim = null;
let lastFrame = 0;

const els = {
  canvas: document.querySelector("#arena"),
  status: document.querySelector("#battleStatus"),
  timer: document.querySelector("#battleTimer"),
  run: document.querySelector("#runBattle"),
  teamName: document.querySelector("#teamName"),
  unitEditors: document.querySelector("#unitEditors"),
  botCode: document.querySelector("#botCode"),
  enemyCode: document.querySelector("#enemyCode"),
  enemyName: document.querySelector("#enemyName"),
  enemySummary: document.querySelector("#enemySummary")
};

const ctx = els.canvas.getContext("2d");

function unit(name, body, weapon, module, place, rules) {
  return {
    name,
    body,
    weapon,
    module,
    place,
    rules: rules.map(([when, then]) => ({ when, then }))
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function optionTags(group, selected) {
  return Object.entries(OPTIONS[group])
    .map(([value, item]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${item.label || item}</option>`)
    .join("");
}

function renderEditors() {
  els.teamName.value = team.name;
  els.unitEditors.innerHTML = "";
  team.units.forEach((bot, index) => {
    const card = document.createElement("article");
    card.className = "unit-card";
    card.innerHTML = `
      <h2>Unit ${index + 1}</h2>
      <div class="unit-row">
        <label>Name<input data-unit="${index}" data-field="name" type="text" value="${escapeHtml(bot.name)}" maxlength="16"></label>
        <label>Body<select data-unit="${index}" data-field="body">${optionTags("body", bot.body)}</select></label>
        <label>Weapon<select data-unit="${index}" data-field="weapon">${optionTags("weapon", bot.weapon)}</select></label>
        <label>Module<select data-unit="${index}" data-field="module">${optionTags("module", bot.module)}</select></label>
        <label>Place<select data-unit="${index}" data-field="place">${optionTags("place", bot.place)}</select></label>
      </div>
      <div class="rules">
        ${bot.rules.map((rule, ruleIndex) => `
          <div class="rule-row">
            <label>When<select data-unit="${index}" data-rule="${ruleIndex}" data-kind="when">${conditionOptions(rule.when)}</select></label>
            <label>Then<select data-unit="${index}" data-rule="${ruleIndex}" data-kind="then">${actionOptions(rule.then)}</select></label>
          </div>
        `).join("")}
      </div>
    `;
    els.unitEditors.append(card);
  });
}

function conditionOptions(selected) {
  return Object.entries(OPTIONS.when)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`)
    .join("");
}

function actionOptions(selected) {
  return Object.entries(OPTIONS.then)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`)
    .join("");
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function teamToDsl(data) {
  const lines = [`bot "${data.name}" v${data.version || 1}`, ""];
  data.units.forEach((bot, index) => {
    lines.push(`unit ${index + 1} "${bot.name}"`);
    lines.push(`body ${bot.body}`);
    lines.push(`weapon ${bot.weapon}`);
    lines.push(`module ${bot.module}`);
    lines.push(`place ${bot.place}`);
    bot.rules.forEach((rule) => lines.push(`rule ${rule.when} -> ${rule.then}`));
    lines.push("");
  });
  return lines.join("\n").trim();
}

function dslToTeam(source) {
  const trimmed = source.trim();
  if (!trimmed) throw new Error("BOTコードが空です");
  if (trimmed.startsWith("{")) return sanitizeTeam(JSON.parse(trimmed));
  if (trimmed.startsWith("PB1.")) return decodeShare(trimmed);

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = lines.shift();
  const nameMatch = header.match(/^bot\s+"([^"]+)"\s+v(\d+)$/i);
  if (!nameMatch) throw new Error("1行目は bot \"Name\" v1 の形式にしてください");

  const parsed = { version: Number(nameMatch[2]), name: nameMatch[1], units: [] };
  let current = null;
  for (const line of lines) {
    const unitMatch = line.match(/^unit\s+\d+\s+"([^"]+)"$/i);
    if (unitMatch) {
      current = { name: unitMatch[1], body: "medium", weapon: "pulse", module: "dash", place: "mid", rules: [] };
      parsed.units.push(current);
      continue;
    }
    if (!current) throw new Error("unit定義の前に項目があります");
    const pair = line.match(/^(body|weapon|module|place)\s+([a-z.0-9_-]+)$/i);
    if (pair) {
      current[pair[1]] = pair[2];
      continue;
    }
    const rule = line.match(/^rule\s+(.+?)\s*->\s*([a-z.]+)$/i);
    if (rule) {
      current.rules.push({ when: rule[1], then: rule[2] });
      continue;
    }
    throw new Error(`読めない行があります: ${line}`);
  }
  return sanitizeTeam(parsed);
}

function sanitizeTeam(data) {
  const clean = {
    version: 1,
    name: String(data.name || "Nameless").slice(0, 24),
    units: []
  };
  const units = Array.isArray(data.units) ? data.units.slice(0, 3) : [];
  while (units.length < 3) units.push(clone(DEFAULT_TEAM.units[units.length]));
  clean.units = units.map((bot, index) => ({
    name: String(bot.name || `Unit ${index + 1}`).slice(0, 16),
    body: valid("body", bot.body, "medium"),
    weapon: valid("weapon", bot.weapon, "pulse"),
    module: valid("module", bot.module, "dash"),
    place: valid("place", bot.place, "mid"),
    rules: sanitizeRules(bot.rules)
  }));
  return clean;
}

function sanitizeRules(rules) {
  const list = Array.isArray(rules) ? rules.slice(0, 3) : [];
  while (list.length < 3) list.push({ when: "always", then: "attack.nearest" });
  return list.map((rule) => ({
    when: hasKey(OPTIONS.when, rule.when) ? rule.when : "always",
    then: hasKey(OPTIONS.then, rule.then) ? rule.then : "attack.nearest"
  }));
}

function valid(group, value, fallback) {
  return hasKey(OPTIONS[group], value) ? value : fallback;
}

function hasKey(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function encodeShare(data) {
  return `PB1.${btoa(unescape(encodeURIComponent(JSON.stringify(sanitizeTeam(data)))))}`;
}

function decodeShare(code) {
  return sanitizeTeam(JSON.parse(decodeURIComponent(escape(atob(code.trim().replace(/^PB1\./, ""))))));
}

function startBattle() {
  team = sanitizeTeam(team);
  enemyTeam = sanitizeTeam(enemyTeam);
  sim = createSim(team, enemyTeam);
  lastFrame = performance.now();
  els.status.textContent = `${team.name} vs ${enemyTeam.name}`;
  requestAnimationFrame(tick);
}

function createSim(left, right) {
  return {
    time: 0,
    ended: false,
    winner: null,
    bullets: [],
    cores: [
      { side: 0, x: 70, y: 270, hp: 360, maxHp: 360 },
      { side: 1, x: 890, y: 270, hp: 360, maxHp: 360 }
    ],
    bots: [
      ...makeBots(left, 0),
      ...makeBots(right, 1)
    ]
  };
}

function makeBots(data, side) {
  const ySlots = [170, 270, 370];
  return data.units.map((bot, index) => {
    const placeOffset = { front: 170, mid: 120, back: 80 }[bot.place];
    const x = side === 0 ? placeOffset : 960 - placeOffset;
    const body = OPTIONS.body[bot.body];
    return {
      id: `${side}-${index}`,
      side,
      name: bot.name,
      x,
      y: ySlots[index],
      vx: 0,
      hp: body.hp,
      maxHp: body.hp,
      cool: 8 + index * 8,
      shield: 0,
      slow: 0,
      def: bot
    };
  });
}

function tick(now) {
  if (!sim) return;
  const dt = Math.min(32, now - lastFrame) / 16.6667;
  lastFrame = now;
  if (!sim.ended) updateSim(dt);
  drawSim();
  els.timer.textContent = `${(sim.time / 60).toFixed(1)}s`;
  if (!sim.ended) requestAnimationFrame(tick);
}

function updateSim(dt) {
  sim.time += dt;
  for (const bot of sim.bots) {
    if (bot.hp <= 0) continue;
    bot.cool = Math.max(0, bot.cool - dt);
    bot.shield = Math.max(0, bot.shield - dt);
    bot.slow = Math.max(0, bot.slow - dt);
    const action = chooseAction(bot);
    act(bot, action, dt);
    bot.x = clamp(bot.x + bot.vx * dt, 45, 915);
  }

  for (const bullet of sim.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.life -= dt;
    const targets = sim.bots.filter((bot) => bot.side !== bullet.side && bot.hp > 0);
    const hit = targets.find((bot) => dist(bot, bullet) < 18);
    if (hit) {
      damage(hit, bullet.damage);
      if (bullet.slow) hit.slow = bullet.slow;
      bullet.life = 0;
    }
    const core = sim.cores[1 - bullet.side];
    if (Math.abs(bullet.x - core.x) < 24 && Math.abs(bullet.y - core.y) < 80) {
      core.hp -= bullet.damage;
      bullet.life = 0;
    }
  }
  sim.bullets = sim.bullets.filter((bullet) => bullet.life > 0 && bullet.x > -40 && bullet.x < 1000);

  const leftDead = sim.cores[0].hp <= 0 || sim.bots.filter((bot) => bot.side === 0 && bot.hp > 0).length === 0;
  const rightDead = sim.cores[1].hp <= 0 || sim.bots.filter((bot) => bot.side === 1 && bot.hp > 0).length === 0;
  if (leftDead || rightDead || sim.time >= 3600) {
    endBattle(leftDead, rightDead);
  }
}

function chooseAction(bot) {
  const context = getContext(bot);
  for (const rule of bot.def.rules) {
    if (testCondition(rule.when, context)) return rule.then;
  }
  return "attack.nearest";
}

function getContext(bot) {
  const enemies = sim.bots.filter((other) => other.side !== bot.side && other.hp > 0);
  const allies = sim.bots.filter((other) => other.side === bot.side && other.hp > 0);
  const nearest = enemies.slice().sort((a, b) => dist(a, bot) - dist(b, bot))[0];
  const enemyCore = sim.cores[1 - bot.side];
  return {
    nearest,
    enemyDistance: nearest ? dist(nearest, bot) : Math.abs(enemyCore.x - bot.x),
    hpPct: (bot.hp / bot.maxHp) * 100,
    allyHurt: allies.some((ally) => (ally.hp / ally.maxHp) * 100 < 50),
    coreVisible: Math.abs(enemyCore.x - bot.x) < 330
  };
}

function testCondition(condition, c) {
  if (condition === "always") return true;
  if (condition === "enemy.core.visible") return c.coreVisible;
  if (condition === "hp < 40") return c.hpPct < 40;
  if (condition === "enemy.distance > 160") return c.enemyDistance > 160;
  if (condition === "enemy.distance < 70") return c.enemyDistance < 70;
  if (condition === "ally.hp < 50") return c.allyHurt;
  return false;
}

function act(bot, action, dt) {
  const dir = bot.side === 0 ? 1 : -1;
  const body = OPTIONS.body[bot.def.body];
  const speed = body.speed * (bot.slow > 0 ? 0.48 : 1);
  bot.vx *= 0.75;

  if (action === "move.forward") bot.vx = speed * dir;
  if (action === "kite") bot.vx = -speed * dir;
  if (action === "shield" && bot.def.module === "shield") bot.shield = 26;
  if (action === "repair" && bot.def.module === "repair") bot.hp = Math.min(bot.maxHp, bot.hp + 0.18 * dt);
  if (action === "cover.ally") bot.vx = speed * 0.45 * dir;
  if (action.startsWith("attack")) fire(bot, action);
}

function fire(bot, action) {
  const weapon = OPTIONS.weapon[bot.def.weapon];
  if (bot.cool > 0) return;
  const target = action === "attack.core"
    ? sim.cores[1 - bot.side]
    : nearestEnemy(bot);
  if (!target) return;
  const distance = Math.abs(target.x - bot.x);
  if (distance > weapon.range) {
    bot.vx = OPTIONS.body[bot.def.body].speed * (bot.side === 0 ? 1 : -1);
    return;
  }
  bot.cool = weapon.cooldown;
  if (bot.def.weapon === "drill") {
    if (target.hp !== undefined) target.hp -= weapon.damage;
    else target.hp -= weapon.damage;
    return;
  }
  const dir = bot.side === 0 ? 1 : -1;
  sim.bullets.push({
    side: bot.side,
    x: bot.x + dir * 18,
    y: bot.y,
    vx: dir * (bot.def.weapon === "missile" ? 5.1 : 8.3),
    damage: weapon.damage,
    slow: weapon.slow || 0,
    color: weapon.color,
    life: 100
  });
}

function nearestEnemy(bot) {
  return sim.bots
    .filter((other) => other.side !== bot.side && other.hp > 0)
    .sort((a, b) => dist(a, bot) - dist(b, bot))[0] || sim.cores[1 - bot.side];
}

function damage(bot, amount) {
  const body = OPTIONS.body[bot.def.body];
  const blocked = bot.shield > 0 ? 0.45 : 1;
  bot.hp -= amount * blocked / body.armor;
}

function endBattle(leftDead, rightDead) {
  sim.ended = true;
  let result = "Draw";
  if (leftDead && !rightDead) result = `${enemyTeam.name} wins`;
  if (rightDead && !leftDead) result = `${team.name} wins`;
  if (!leftDead && !rightDead) {
    const leftScore = sim.cores[0].hp + sim.bots.filter((bot) => bot.side === 0).reduce((sum, bot) => sum + Math.max(0, bot.hp), 0);
    const rightScore = sim.cores[1].hp + sim.bots.filter((bot) => bot.side === 1).reduce((sum, bot) => sum + Math.max(0, bot.hp), 0);
    result = leftScore === rightScore ? "Draw" : leftScore > rightScore ? `${team.name} wins` : `${enemyTeam.name} wins`;
  }
  els.status.textContent = result;
}

function drawSim() {
  ctx.clearRect(0, 0, 960, 540);
  ctx.fillStyle = "#111416";
  ctx.fillRect(0, 0, 960, 540);
  ctx.strokeStyle = "#263035";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 960; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 70);
    ctx.lineTo(x, 470);
    ctx.stroke();
  }
  ctx.fillStyle = "#1d2326";
  ctx.fillRect(0, 470, 960, 70);
  drawCore(sim.cores[0], "#56c7d9");
  drawCore(sim.cores[1], "#f05f57");
  sim.bots.forEach(drawBot);
  sim.bullets.forEach(drawBullet);
}

function drawCore(core, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(core.x - 28, core.y - 90, 56, 180);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillRect(core.x - 18, core.y - 66, 36, 132);
  hpBar(core.x - 42, core.y - 104, 84, 8, core.hp / core.maxHp, color);
}

function drawBot(bot) {
  if (bot.hp <= 0) {
    ctx.fillStyle = "#394147";
    ctx.fillRect(bot.x - 12, bot.y - 5, 24, 10);
    return;
  }
  const color = bot.side === 0 ? "#56c7d9" : "#f05f57";
  ctx.fillStyle = color;
  roundedRect(ctx, bot.x - 17, bot.y - 17, 34, 34, 7);
  ctx.fillStyle = "#101112";
  ctx.fillRect(bot.x - 5, bot.y - 6, 10, 12);
  if (bot.shield > 0) {
    ctx.strokeStyle = "#f0b94d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bot.x, bot.y, 27, 0, Math.PI * 2);
    ctx.stroke();
  }
  hpBar(bot.x - 22, bot.y - 29, 44, 5, bot.hp / bot.maxHp, color);
}

function drawBullet(bullet) {
  ctx.fillStyle = bullet.color;
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.damage > 10 ? 6 : 4, 0, Math.PI * 2);
  ctx.fill();
}

function hpBar(x, y, w, h, pct, color) {
  ctx.fillStyle = "#0a0c0d";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(pct, 0, 1), h);
}

function roundedRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.quadraticCurveTo(x + w, y, x + w, y + r);
  context.lineTo(x + w, y + h - r);
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  context.lineTo(x + r, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.fill();
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomizeTeam() {
  const bodies = Object.keys(OPTIONS.body);
  const weapons = Object.keys(OPTIONS.weapon);
  const modules = Object.keys(OPTIONS.module);
  const places = Object.keys(OPTIONS.place);
  const conditions = Object.keys(OPTIONS.when);
  const actions = Object.keys(OPTIONS.then);
  team.units = team.units.map((bot) => ({
    ...bot,
    body: pick(bodies),
    weapon: pick(weapons),
    module: pick(modules),
    place: pick(places),
    rules: [0, 1, 2].map(() => ({ when: pick(conditions), then: pick(actions) }))
  }));
  renderEditors();
  drawIdle();
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function drawIdle() {
  sim = createSim(team, enemyTeam);
  drawSim();
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}Tab`).classList.add("active");
  });
});

els.teamName.addEventListener("input", () => {
  team.name = els.teamName.value || "Nameless";
});

els.unitEditors.addEventListener("input", (event) => {
  const target = event.target;
  const index = Number(target.dataset.unit);
  if (!Number.isFinite(index)) return;
  if (target.dataset.field) team.units[index][target.dataset.field] = target.value;
  if (target.dataset.rule) {
    const ruleIndex = Number(target.dataset.rule);
    team.units[index].rules[ruleIndex][target.dataset.kind] = target.value;
  }
  drawIdle();
});

document.querySelector("#randomize").addEventListener("click", randomizeTeam);
document.querySelector("#exportDsl").addEventListener("click", () => {
  els.botCode.value = teamToDsl(sanitizeTeam(team));
});
document.querySelector("#importDsl").addEventListener("click", () => {
  try {
    team = dslToTeam(els.botCode.value);
    renderEditors();
    drawIdle();
    els.status.textContent = "BOTコードを読み込みました";
  } catch (error) {
    els.status.textContent = error.message;
  }
});
document.querySelector("#copyShare").addEventListener("click", () => {
  els.botCode.value = encodeShare(team);
  navigator.clipboard?.writeText(els.botCode.value);
  els.status.textContent = "Share Codeを生成しました";
});
document.querySelector("#loadSampleEnemy").addEventListener("click", () => {
  enemyTeam = clone(SAMPLE_ENEMY);
  els.enemyCode.value = teamToDsl(enemyTeam);
  updateEnemyReadout();
  drawIdle();
});
document.querySelector("#loadEnemyCode").addEventListener("click", () => {
  try {
    enemyTeam = dslToTeam(els.enemyCode.value);
    updateEnemyReadout();
    drawIdle();
    els.status.textContent = "相手BOTを読み込みました";
  } catch (error) {
    els.status.textContent = error.message;
  }
});
els.run.addEventListener("click", startBattle);

function updateEnemyReadout() {
  els.enemyName.textContent = enemyTeam.name;
  const weapons = enemyTeam.units.map((bot) => OPTIONS.weapon[bot.weapon].label).join(" / ");
  els.enemySummary.textContent = weapons;
}

renderEditors();
els.botCode.value = teamToDsl(team);
els.enemyCode.value = teamToDsl(enemyTeam);
updateEnemyReadout();
drawIdle();

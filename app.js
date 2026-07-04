(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");

  const INK = "#17202a";
  const PAPER = "#f2f5f8";
  const PANEL = "#ffffff";
  const PALE = "#d8e0e8";
  const GRID_LINE = "#dce5ed";
  const ACCENT = "#4c6fff";
  const SIGNAL = "#7ee787";
  const DANGER = "#ef596f";
  const GRID = 7;
  const CORE = 3;
  const MAX_BLOCKS = 16;
  const MAX_NODES = 50;
  const MAX_LOGIC = 12;
  const MAX_WIRES = 100;
  const TICK = 1 / 30;
  const MAX_FIGHT = 45;
  const PREFIX = "CBA3:";
  const OLD_PREFIXES = ["CBA1:", "CBA2:"];
  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  const BLOCKS = {
    core: { hp: 42, label: "CORE", mass: 4, energy: 50, regen: 5 },
    wheel: { hp: 14, label: "WHEEL", mass: 1, energy: 0, regen: 0 },
    gun: { hp: 22, label: "GUN", mass: 1.5, energy: 0, regen: 0 },
    radar: { hp: 12, label: "RADAR", mass: 1, energy: 0, regen: 0 },
    armor: { hp: 30, label: "ARMOR", mass: 3, energy: 0, regen: 0 },
    battery: { hp: 16, label: "BATT", mass: 1.4, energy: 34, regen: 5 },
  };
  const PALETTE = ["wheel", "gun", "radar", "armor", "battery"];
  const PART_INFO = {
    core: { name: "Core", role: "HEART", desc: "Protect this.", stats: ["HP"], color: "#f4b43c", dark: "#c46d1b" },
    wheel: { name: "Wheel", role: "MOVE", desc: "Speed and turning.", stats: ["SPD", "TURN"], color: "#4c6fff", dark: "#263b83" },
    gun: { name: "Gun", role: "SHOOT", desc: "Fires bullets.", stats: ["FIRE"], color: "#ef596f", dark: "#8d2330" },
    radar: { name: "Radar", role: "SEE", desc: "Finds enemies.", stats: ["RADAR"], color: "#48c6d9", dark: "#246a89" },
    armor: { name: "Armor", role: "BLOCK", desc: "Protects blocks.", stats: ["ARMOR"], color: "#7d91a8", dark: "#3c4b5e" },
    battery: { name: "Battery", role: "POWER", desc: "More energy.", stats: ["ENERGY"], color: "#55c878", dark: "#28783f" },
  };

  const SENSORS = [
    ["always", "Always"],
    ["enemySeen", "Enemy Seen"],
    ["enemyNear", "Enemy Near"],
    ["enemyLeft", "Enemy Left"],
    ["enemyRight", "Enemy Right"],
    ["enemyFront", "Enemy Front"],
    ["enemyFar", "Enemy Far"],
    ["gunAligned", "Gun Aligned"],
    ["gunReady", "Gun Ready"],
    ["wallAhead", "Wall Ahead"],
    ["bulletIncoming", "Bullet In"],
    ["hitWall", "Hit Wall"],
    ["hitByBullet", "Hit Bullet"],
    ["lowHp", "Low HP"],
    ["lowEnergy", "Low Energy"],
  ];
  const LOGIC_TYPES = {
    and: { label: "AND", inputs: 2 },
    or: { label: "OR", inputs: 2 },
    not: { label: "NOT", inputs: 1 },
    timer: { label: "TIMER", inputs: 0 },
    random: { label: "RND", inputs: 0 },
  };
  const ACTIONS = [
    ["radarSweep", "Radar Sweep"],
    ["aimAtEnemy", "Aim Enemy"],
    ["fire", "Fire"],
    ["moveForward", "Forward"],
    ["moveBackward", "Back"],
    ["orbitLeft", "Orbit L"],
    ["orbitRight", "Orbit R"],
    ["stop", "Stop"],
    ["turnLeft", "Turn L"],
    ["turnRight", "Turn R"],
  ];
  const SENSOR_META = {
    always: { label: "Always", short: "Always", category: "BASIC" },
    enemySeen: { label: "Enemy Seen", short: "Seen", category: "SEE", need: "radar" },
    enemyFront: { label: "Enemy Front", short: "Front", category: "SEE", need: "radar" },
    enemyNear: { label: "Enemy Near", short: "Near", category: "SEE", need: "radar" },
    enemyFar: { label: "Enemy Far", short: "Far", category: "SEE", need: "radar" },
    enemyLeft: { label: "Enemy Left", short: "Left", category: "SEE", need: "radar" },
    enemyRight: { label: "Enemy Right", short: "Right", category: "SEE", need: "radar" },
    gunReady: { label: "Gun Ready", short: "Ready", category: "GUN", need: "gun" },
    gunAligned: { label: "Gun Aligned", short: "Lock", category: "GUN", need: "gun" },
    bulletIncoming: { label: "Bullet Incoming", short: "Bullet", category: "DANGER" },
    hitByBullet: { label: "Hit Bullet", short: "Hit", category: "DANGER" },
    lowHp: { label: "Low HP", short: "Low HP", category: "DANGER" },
    wallAhead: { label: "Wall Ahead", short: "Wall", category: "WALL" },
    hitWall: { label: "Hit Wall", short: "Bump", category: "WALL" },
    lowEnergy: { label: "Low Energy", short: "Low En", category: "POWER" },
  };
  const ACTION_META = {
    radarSweep: { label: "Radar Sweep", short: "Sweep", category: "RADAR", need: "radar" },
    aimAtEnemy: { label: "Aim Enemy", short: "Aim", category: "AIM", need: "gun" },
    fire: { label: "Fire", short: "Fire", category: "SHOOT", need: "gun" },
    moveForward: { label: "Forward", short: "Forward", category: "MOVE", need: "wheel" },
    moveBackward: { label: "Back", short: "Back", category: "MOVE", need: "wheel" },
    orbitLeft: { label: "Orbit L", short: "Orbit L", category: "MOVE", need: "wheel" },
    orbitRight: { label: "Orbit R", short: "Orbit R", category: "MOVE", need: "wheel" },
    stop: { label: "Stop", short: "Stop", category: "MOVE", need: "wheel" },
    turnLeft: { label: "Turn L", short: "Turn L", category: "MOVE", need: "wheel" },
    turnRight: { label: "Turn R", short: "Turn R", category: "MOVE", need: "wheel" },
  };
  const CONDITION_GROUPS = ["BASIC", "SEE", "GUN", "DANGER", "WALL", "POWER"];
  const ACTION_GROUPS = ["RADAR", "AIM", "SHOOT", "MOVE"];

  const LS = {
    design: "circuit-bot-arena.v3.program-ui.design",
    opponent: "circuit-bot-arena.v3.program-ui.opponent",
    enemyIndex: "circuit-bot-arena.v3.program-ui.enemyIndex",
  };

  const state = {
    w: 390,
    h: 760,
    dpr: 1,
    mode: "build",
    design: null,
    opponent: null,
    enemies: [],
    enemyIndex: 0,
    selectedBlockType: "wheel",
    selectedBlockId: null,
    undoBlocks: null,
    wireFrom: null,
    selectedWireIndex: null,
    selectedLogicId: null,
    editingRuleId: null,
    selectedNodeId: null,
    selectedProgramWireId: null,
    connectingPort: null,
    libraryOpen: false,
    libraryTab: "sensor",
    pointer: {
      down: false,
      id: null,
      mode: "",
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      worldX: 0,
      worldY: 0,
      moved: false,
      pinchDist: 0,
      pinchZoom: 1,
      pinchCenter: null,
    },
    touches: new Map(),
    hits: [],
    battle: null,
    fightOpponent: null,
    toast: "",
    toastT: 0,
    importText: "",
    exportText: "",
    lastSignals: {},
  };

  const shareLayer = makeShareLayer();
  state.enemies = makeEnemies();
  state.design = loadDesign() || defaultDesign();
  state.opponent = loadOpponent() || state.enemies[0];
  state.enemyIndex = Number(localStorage.getItem(LS.enemyIndex) || 0) || 0;
  state.enemyIndex = clamp(Math.round(state.enemyIndex), 0, state.enemies.length - 1);
  state.fightOpponent = state.enemies[state.enemyIndex];
  state.exportText = exportCode(state.design);

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function block(type, x, y, rot = 0, id = uid("b")) {
    return { id, type, x, y, rot };
  }

  function logic(type, x = 1, y = 1, id = uid("n")) {
    return { id, type, x, y, params: {} };
  }

  function rule(id, conditions, actions) {
    return {
      id,
      mode: "all",
      conditions: conditions.map((sensor) => ({ sensor })),
      actions: actions.map((action) => ({ action })),
    };
  }

  function defaultBrain() {
    return {
      rules: [
        rule("r_sweep", ["always"], ["radarSweep"]),
        rule("r_aim", ["enemySeen"], ["aimAtEnemy"]),
        rule("r_fire", ["enemySeen", "gunReady", "gunAligned"], ["fire"]),
        rule("r_far", ["enemyFar"], ["moveForward"]),
        rule("r_near", ["enemyNear"], ["moveBackward"]),
        rule("r_orbit", ["enemySeen"], ["orbitRight"]),
        rule("r_dodge", ["bulletIncoming"], ["orbitLeft"]),
        rule("r_wall", ["wallAhead"], ["turnRight"]),
      ],
    };
  }

  function brainFromPairs(pairs) {
    return { rules: pairs.map((p, i) => rule(p[0] || `r_${i}`, p[1] || [], p[2] || [])) };
  }

  function defaultSchematic() {
    return schematicFromBrain(defaultBrain());
  }

  function wire(from, to) {
    return { from, to };
  }

  function programNode(kind, type, x, y, id = uid(kind[0] || "n")) {
    return { id, kind, type, x, y };
  }

  function programWire(fromNode, fromPort, toNode, toPort, id = uid("w")) {
    return { id, fromNode, fromPort, toNode, toPort };
  }

  function defaultProgram() {
    const nodes = [
      programNode("sensor", "always", -220, -220, "s_always"),
      programNode("sensor", "enemySeen", -220, -125, "s_seen"),
      programNode("sensor", "enemyFar", -220, -30, "s_far"),
      programNode("sensor", "enemyNear", -220, 65, "s_near"),
      programNode("sensor", "gunReady", -220, 160, "s_ready"),
      programNode("sensor", "gunAligned", -220, 255, "s_lock"),
      programNode("sensor", "bulletIncoming", -220, 350, "s_bullet"),
      programNode("sensor", "wallAhead", -220, 445, "s_wall"),
      programNode("logic", "and", 10, 160, "l_seen_ready"),
      programNode("logic", "and", 125, 255, "l_fire_lock"),
      programNode("action", "radarSweep", 270, -220, "a_sweep"),
      programNode("action", "aimAtEnemy", 270, -125, "a_aim"),
      programNode("action", "moveForward", 270, -30, "a_forward"),
      programNode("action", "moveBackward", 270, 65, "a_back"),
      programNode("action", "fire", 270, 255, "a_fire"),
      programNode("action", "orbitLeft", 270, 350, "a_orbit"),
      programNode("action", "turnRight", 270, 445, "a_turn"),
    ];
    const wires = [
      programWire("s_always", "out", "a_sweep", "in", "w_sweep"),
      programWire("s_seen", "out", "a_aim", "in", "w_aim"),
      programWire("s_far", "out", "a_forward", "in", "w_forward"),
      programWire("s_near", "out", "a_back", "in", "w_back"),
      programWire("s_seen", "out", "l_seen_ready", "in0", "w_seen_and"),
      programWire("s_ready", "out", "l_seen_ready", "in1", "w_ready_and"),
      programWire("l_seen_ready", "out", "l_fire_lock", "in0", "w_fire_a"),
      programWire("s_lock", "out", "l_fire_lock", "in1", "w_fire_b"),
      programWire("l_fire_lock", "out", "a_fire", "in", "w_fire"),
      programWire("s_bullet", "out", "a_orbit", "in", "w_dodge"),
      programWire("s_wall", "out", "a_turn", "in", "w_wall"),
    ];
    return { nodes, wires, view: { x: -20, y: -110, zoom: 0.54 } };
  }

  function normalizeProgram(raw) {
    const src = raw && Array.isArray(raw.nodes) ? raw : defaultProgram();
    const nodes = [];
    const ids = new Set();
    for (const n of src.nodes || []) {
      if (nodes.length >= MAX_NODES) break;
      const kind = String(n.kind || "");
      const type = String(n.type || "");
      if (!nodeTypeValid(kind, type)) continue;
      const id = String(n.id || uid(kind[0] || "n")).replace(/[^\w-]/g, "").slice(0, 32) || uid("n");
      if (ids.has(id)) continue;
      ids.add(id);
      nodes.push(programNode(kind, type, clamp(Number(n.x) || 0, -3000, 3000), clamp(Number(n.y) || 0, -3000, 3000), id));
    }
    const wires = [];
    for (const w of src.wires || []) {
      if (wires.length >= MAX_WIRES) break;
      const wireCandidate = {
        id: String(w.id || uid("w")).replace(/[^\w-]/g, "").slice(0, 32) || uid("w"),
        fromNode: String(w.fromNode || ""),
        fromPort: String(w.fromPort || "out"),
        toNode: String(w.toNode || ""),
        toPort: String(w.toPort || "in"),
      };
      if (!canConnectProgramWire(wireCandidate, nodes, wires)) continue;
      wires.push(wireCandidate);
    }
    const view = {
      x: clamp(Number(src.view?.x) || 0, -4000, 4000),
      y: clamp(Number(src.view?.y) || 0, -4000, 4000),
      zoom: clamp(Number(src.view?.zoom) || 0.82, 0.4, 2.5),
    };
    return { nodes: nodes.length ? nodes : defaultProgram().nodes, wires, view };
  }

  function nodeTypeValid(kind, type) {
    if (kind === "sensor") return !!SENSOR_META[type];
    if (kind === "action") return !!ACTION_META[type];
    if (kind === "logic") return !!LOGIC_TYPES[type];
    return false;
  }

  function canConnectProgramWire(w, nodes, existing = []) {
    const from = nodes.find((n) => n.id === w.fromNode);
    const to = nodes.find((n) => n.id === w.toNode);
    if (!from || !to || from.id === to.id) return false;
    if (from.kind === "action" || to.kind === "sensor") return false;
    if (w.fromPort !== "out") return false;
    const ports = programInputPorts(to);
    if (!ports.includes(w.toPort)) return false;
    if (existing.some((x) => x.fromNode === w.fromNode && x.fromPort === w.fromPort && x.toNode === w.toNode && x.toPort === w.toPort)) return false;
    if (wouldCreateProgramCycle(w.fromNode, w.toNode, nodes, existing)) return false;
    return true;
  }

  function wouldCreateProgramCycle(fromNode, toNode, nodes, wires) {
    const seen = new Set([fromNode]);
    const stack = [toNode];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) return true;
      seen.add(id);
      for (const w of wires) if (w.fromNode === id) stack.push(w.toNode);
    }
    return false;
  }

  function programInputPorts(node) {
    if (!node) return [];
    if (node.kind === "action") return ["in"];
    if (node.kind === "logic") {
      const count = LOGIC_TYPES[node.type]?.inputs || 0;
      return Array.from({ length: count }, (_, i) => `in${i}`);
    }
    return [];
  }

  function defaultDesign() {
    return normalizeDesign({
      version: 3,
      name: "My Bot",
      blocks: [
        block("core", CORE, CORE, 0, "core"),
        block("gun", CORE, CORE - 1, 1),
        block("armor", CORE + 1, CORE, 1),
        block("radar", CORE - 1, CORE, 3),
        block("wheel", CORE - 1, CORE + 1, 0),
        block("wheel", CORE + 1, CORE + 1, 0),
        block("battery", CORE, CORE + 1, 0),
      ],
      program: defaultProgram(),
    });
  }

  function normalizeBrain(raw) {
    const explicit = Array.isArray(raw?.rules);
    const src = explicit ? raw.rules : defaultBrain().rules;
    const rules = [];
    const seen = new Set();
    for (const r of src) {
      if (rules.length >= 12) break;
      const id = String(r.id || uid("r")).replace(/[^\w-]/g, "").slice(0, 24) || uid("r");
      if (seen.has(id)) continue;
      const conditions = [];
      const actions = [];
      for (const c of r.conditions || []) {
        const sensor = String(c.sensor || "");
        if (SENSOR_META[sensor] && !conditions.some((x) => x.sensor === sensor)) conditions.push({ sensor, not: !!c.not });
      }
      for (const a of r.actions || []) {
        const action = String(a.action || "");
        if (ACTION_META[action] && !actions.some((x) => x.action === action)) actions.push({ action });
      }
      if (!conditions.length && !actions.length) continue;
      seen.add(id);
      rules.push({ id, mode: r.mode === "any" ? "any" : "all", conditions: conditions.slice(0, 5), actions: actions.slice(0, 4) });
    }
    return { rules: rules.length || explicit ? rules : defaultBrain().rules };
  }

  function schematicFromBrain(brain) {
    const logicNodes = [];
    const wires = [];
    const add = (from, to) => {
      if (wires.length < MAX_WIRES && !wires.some((w) => w.from === from && w.to === to)) wires.push(wire(from, to));
    };
    for (const r of brain.rules || []) {
      const conds = (r.conditions || []).filter((c) => SENSOR_META[c.sensor] && !c.not).map((c) => `sensor.${c.sensor}`);
      const outs = (r.actions || []).filter((a) => ACTION_META[a.action]).map((a) => `action.${a.action}`);
      if (!conds.length || !outs.length) continue;
      let output = conds[0];
      for (let i = 1; i < conds.length; i += 1) {
        if (logicNodes.length >= MAX_LOGIC) break;
        const id = `${r.id}_and_${i}`.replace(/[^\w-]/g, "").slice(0, 24);
        logicNodes.push(logic("and", 1, logicNodes.length, id));
        add(output, `${id}.in0`);
        add(conds[i], `${id}.in1`);
        output = `${id}.out`;
      }
      for (const out of outs) add(output, out);
    }
    return { logicNodes, wires };
  }

  function normalizeDesign(raw) {
    const blocks = [];
    const seen = new Set();
    for (const b of raw?.blocks || []) {
      if (!BLOCKS[b.type]) continue;
      const x = clamp(Math.round(b.x), 0, GRID - 1);
      const y = clamp(Math.round(b.y), 0, GRID - 1);
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push(block(b.type, x, y, clamp(Math.round(b.rot || 0), 0, 3), String(b.id || uid("b")).slice(0, 24)));
    }
    let core = blocks.find((b) => b.type === "core");
    if (!core) {
      core = block("core", CORE, CORE, 0, "core");
      blocks.unshift(core);
    }
    core.type = "core";
    core.x = CORE;
    core.y = CORE;
    core.rot = 0;
    core.id = "core";

    const connected = pruneDisconnected(blocks).slice(0, MAX_BLOCKS);
    const program = normalizeProgram(raw?.program || raw?.schematicV3 || null);
    const brain = normalizeBrain(raw?.brain);
    const schematicSource = raw?.schematic || schematicFromBrain(brain);
    const schematic = normalizeSchematic(schematicSource);
    return {
      version: 3,
      name: String(raw?.name || "Bot").slice(0, 24),
      blocks: connected,
      schematic,
      brain,
      program,
    };
  }

  function normalizeSchematic(raw) {
    const logicNodes = [];
    const logicIds = new Set();
    for (const n of raw?.logicNodes || []) {
      if (!LOGIC_TYPES[n.type] || logicNodes.length >= MAX_LOGIC) continue;
      const id = String(n.id || uid("n")).replace(/[^\w-]/g, "").slice(0, 24) || uid("n");
      if (logicIds.has(id)) continue;
      logicIds.add(id);
      logicNodes.push({ id, type: n.type, x: clamp(Number(n.x) || 1, 0, 2), y: clamp(Number(n.y) || logicNodes.length, 0, 20), params: {} });
    }
    const wires = [];
    for (const w of raw?.wires || []) {
      if (wires.length >= MAX_WIRES) break;
      const from = String(w.from || "");
      const to = String(w.to || "");
      if (!isOutputEndpoint(from, logicIds) || !isInputEndpoint(to, logicIds)) continue;
      if (!canConnectEndpoints(from, to, logicNodes)) continue;
      if (wires.some((x) => x.from === from && x.to === to)) continue;
      wires.push({ from, to });
    }
    return { logicNodes, wires };
  }

  function isOutputEndpoint(ep, logicIds) {
    if (ep.startsWith("sensor.")) return SENSORS.some(([id]) => ep === `sensor.${id}`);
    const [id, port] = ep.split(".");
    return logicIds.has(id) && port === "out";
  }

  function isInputEndpoint(ep, logicIds) {
    if (ep.startsWith("action.")) return ACTIONS.some(([id]) => ep === `action.${id}`);
    const [id, input] = ep.split(".");
    if (!logicIds.has(id) || !/^in\d+$/.test(input || "")) return false;
    return true;
  }

  function canConnectEndpoints(from, to, logicNodes) {
    if (from.startsWith("sensor.")) return to.startsWith("action.") || isLogicEndpoint(to);
    if (!isLogicEndpoint(from)) return false;
    if (to.startsWith("action.")) return true;
    if (!isLogicEndpoint(to)) return false;
    const fromId = from.split(".")[0];
    const toId = to.split(".")[0];
    if (fromId === toId) return false;
    const fromIndex = logicNodes.findIndex((n) => n.id === fromId);
    const toIndex = logicNodes.findIndex((n) => n.id === toId);
    return fromIndex >= 0 && toIndex >= 0 && fromIndex < toIndex;
  }

  function isLogicEndpoint(ep) {
    return !ep.startsWith("sensor.") && !ep.startsWith("action.");
  }

  function pruneDisconnected(blocks) {
    const map = new Map(blocks.map((b) => [`${b.x},${b.y}`, b]));
    if (!map.has(`${CORE},${CORE}`)) return [block("core", CORE, CORE, 0, "core")];
    const keep = new Set([`${CORE},${CORE}`]);
    const open = [{ x: CORE, y: CORE }];
    while (open.length) {
      const c = open.pop();
      for (const d of DIRS) {
        const nx = c.x + d.x;
        const ny = c.y + d.y;
        const key = `${nx},${ny}`;
        if (!map.has(key) || keep.has(key)) continue;
        keep.add(key);
        open.push({ x: nx, y: ny });
      }
    }
    return blocks.filter((b) => keep.has(`${b.x},${b.y}`));
  }

  function canPlace(x, y) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return false;
    if (state.design.blocks.some((b) => b.x === x && b.y === y)) return false;
    if (state.design.blocks.length >= MAX_BLOCKS) return false;
    if (!placementNatural(state.selectedBlockType, x, y)) return false;
    return DIRS.some((d) => state.design.blocks.some((b) => b.x === x + d.x && b.y === y + d.y));
  }

  function placementNatural(type, x, y) {
    if (type === "wheel") return y >= CORE;
    if (type === "gun") return x === 0 || y === 0 || x === GRID - 1 || y === GRID - 1 || Math.abs(x - CORE) + Math.abs(y - CORE) >= 2;
    if (type === "radar") return y <= CORE || x === 0 || x === GRID - 1;
    if (type === "armor") return Math.abs(x - CORE) + Math.abs(y - CORE) >= 1;
    if (type === "battery") return Math.abs(x - CORE) + Math.abs(y - CORE) <= 3;
    return true;
  }

  function saveDesign() {
    state.design = normalizeDesign(state.design);
    state.exportText = exportCode(state.design);
    try {
      localStorage.setItem(LS.design, JSON.stringify(state.design));
    } catch {}
  }

  function loadDesign() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS.design) || "null");
      return raw ? normalizeDesign(raw) : null;
    } catch {
      return null;
    }
  }

  function saveOpponent(design) {
    state.opponent = normalizeDesign(design);
    try {
      localStorage.setItem(LS.opponent, JSON.stringify(state.opponent));
    } catch {}
  }

  function loadOpponent() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS.opponent) || "null");
      return raw ? normalizeDesign(raw) : null;
    } catch {
      return null;
    }
  }

  function makeEnemies() {
    const targetDummy = normalizeDesign({
      version: 1,
      name: "Target Dummy",
      blocks: [
        block("core", 3, 3, 0, "core"), block("armor", 4, 3, 1), block("battery", 3, 4),
      ],
      brain: { rules: [] },
    });
    const hunter = normalizeDesign({
      version: 1,
      name: "Basic Hunter",
      blocks: [
        block("core", 3, 3, 0, "core"), block("gun", 3, 2, 1), block("armor", 4, 3, 1),
        block("radar", 2, 3, 3), block("wheel", 2, 4), block("wheel", 4, 4), block("battery", 3, 4),
      ],
      brain: defaultBrain(),
    });
    const charger = normalizeDesign({
      version: 1,
      name: "Charger",
      blocks: [
        block("core", 3, 3, 0, "core"), block("armor", 4, 3, 1), block("armor", 5, 3, 1),
        block("gun", 3, 2, 1), block("radar", 2, 3), block("wheel", 3, 4), block("wheel", 2, 4), block("wheel", 4, 4),
      ],
      brain: brainFromPairs([
        ["ch_sweep", ["always"], ["radarSweep"]],
        ["ch_charge", ["always"], ["moveForward"]],
        ["ch_aim", ["enemySeen"], ["aimAtEnemy"]],
        ["ch_fire", ["enemySeen", "gunReady", "gunAligned"], ["fire"]],
        ["ch_wall", ["wallAhead"], ["turnRight"]],
      ]),
    });
    const sniper = normalizeDesign({
      version: 1,
      name: "Sniper",
      blocks: [
        block("core", 3, 3, 0, "core"), block("radar", 3, 2), block("gun", 4, 3, 1),
        block("gun", 4, 2, 1), block("battery", 2, 3), block("battery", 3, 4), block("armor", 2, 4),
      ],
      brain: brainFromPairs([
        ["s_sweep", ["always"], ["radarSweep"]],
        ["s_aim", ["enemySeen"], ["aimAtEnemy"]],
        ["s_fire", ["enemySeen", "gunReady", "gunAligned"], ["fire"]],
        ["s_back", ["enemyNear"], ["moveBackward"]],
        ["s_hold", ["enemyFar"], ["stop"]],
        ["s_wall", ["wallAhead"], ["turnRight"]],
      ]),
    });
    const wallRunner = normalizeDesign({
      version: 1,
      name: "Wall Runner",
      blocks: [
        block("core", 3, 3, 0, "core"), block("radar", 3, 2), block("gun", 4, 3, 1),
        block("wheel", 3, 4), block("wheel", 4, 4), block("armor", 4, 2, 1), block("battery", 2, 3),
      ],
      brain: brainFromPairs([
        ["w_sweep", ["always"], ["radarSweep"]],
        ["w_run", ["always"], ["moveForward"]],
        ["w_wall", ["wallAhead"], ["turnRight"]],
        ["w_aim", ["enemySeen"], ["aimAtEnemy"]],
        ["w_fire", ["enemySeen", "gunReady", "gunAligned"], ["fire"]],
      ]),
    });
    const dodger = normalizeDesign({
      version: 1,
      name: "Dodger",
      blocks: [
        block("core", 3, 3, 0, "core"), block("radar", 3, 2), block("gun", 2, 3, 3),
        block("battery", 3, 4), block("wheel", 2, 4), block("wheel", 4, 4), block("wheel", 3, 5), block("armor", 3, 1),
      ],
      brain: brainFromPairs([
        ["d_sweep", ["always"], ["radarSweep"]],
        ["d_aim", ["enemySeen"], ["aimAtEnemy"]],
        ["d_fire", ["enemySeen", "gunReady", "gunAligned"], ["fire"]],
        ["d_orbit", ["enemySeen"], ["orbitLeft"]],
        ["d_dodge", ["bulletIncoming"], ["orbitRight"]],
        ["d_wall", ["wallAhead"], ["turnRight"]],
      ]),
    });
    const armored = normalizeDesign({
      version: 1,
      name: "Armored Core",
      blocks: [
        block("core", 3, 3, 0, "core"), block("armor", 4, 3, 1), block("armor", 5, 3, 1),
        block("armor", 4, 2, 1), block("armor", 4, 4, 1), block("gun", 3, 2, 1),
        block("radar", 2, 3, 3), block("wheel", 2, 4), block("battery", 3, 4),
      ],
      brain: defaultBrain(),
    });
    return [targetDummy, hunter, charger, sniper, wallRunner, dodger, armored];
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.w = Math.max(320, Math.round(rect.width || 390));
    state.h = Math.max(560, Math.round(rect.height || 760));
    state.dpr = Math.max(1, Math.min(2, Math.round(window.devicePixelRatio || 1)));
    canvas.width = state.w * state.dpr;
    canvas.height = state.h * state.dpr;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    positionShareLayer();
  }

  window.addEventListener("resize", resize);
  resize();

  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (state.w / rect.width);
    const y = (event.clientY - rect.top) * (state.h / rect.height);
    if (state.mode === "program") programPointerDown(event, x, y);
    else handlePointer(x, y);
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (state.mode !== "program") return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (state.w / rect.width);
    const y = (event.clientY - rect.top) * (state.h / rect.height);
    programPointerMove(event, x, y);
    event.preventDefault();
  });

  canvas.addEventListener("pointerup", (event) => {
    if (state.mode !== "program") return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (state.w / rect.width);
    const y = (event.clientY - rect.top) * (state.h / rect.height);
    programPointerUp(event, x, y);
    event.preventDefault();
  });

  canvas.addEventListener("pointercancel", (event) => {
    state.touches.delete(event.pointerId);
    state.pointer.down = false;
  });

  canvas.addEventListener("wheel", (event) => {
    if (state.mode !== "program") return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (state.w / rect.width);
    const y = (event.clientY - rect.top) * (state.h / rect.height);
    zoomProgramAt(x, y, event.deltaY < 0 ? 1.12 : 0.88);
    saveDesign();
    event.preventDefault();
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      if (state.mode === "build") deleteSelectedBlock();
      if (state.mode === "program") deleteSelectedProgram();
      event.preventDefault();
    } else if (event.key.toLowerCase() === "r" && state.mode === "build") {
      rotateSelectedBlock();
    }
  });

  function handlePointer(x, y) {
    const hit = [...state.hits].reverse().find((h) => x >= h.x && y >= h.y && x <= h.x + h.w && y <= h.y + h.h);
    if (!hit) return;
    if (hit.kind === "tab") {
      setMode(hit.mode);
    } else if (state.mode === "build") {
      handleBuildHit(hit);
    } else if (state.mode === "program") {
      handleProgramHit(hit);
    } else if (state.mode === "fight") {
      handleFightHit(hit);
    } else if (state.mode === "share") {
      handleShareHit(hit);
    }
  }

  function handleBuildHit(hit) {
    if (hit.kind === "palette") {
      state.selectedBlockType = hit.type;
      state.selectedBlockId = null;
    } else if (hit.kind === "cell") {
      const found = state.design.blocks.find((b) => b.x === hit.gx && b.y === hit.gy);
      if (found) {
        state.selectedBlockId = found.id;
        state.selectedBlockType = found.type === "core" ? state.selectedBlockType : found.type;
      } else if (canPlace(hit.gx, hit.gy)) {
        state.design.blocks.push(block(state.selectedBlockType, hit.gx, hit.gy, defaultRot(state.selectedBlockType)));
        state.selectedBlockId = state.design.blocks[state.design.blocks.length - 1].id;
        saveDesign();
      } else {
        toast("CONNECT");
      }
    } else if (hit.kind === "delete") deleteSelectedBlock();
    else if (hit.kind === "rotate") rotateSelectedBlock();
    else if (hit.kind === "random") randomDesign();
    else if (hit.kind === "program") setMode("program");
    else if (hit.kind === "fight") startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
  }

  function handleBrainHit(hit) {
    if (hit.kind === "rule") state.editingRuleId = hit.id;
    else if (hit.kind === "addRule") addRule();
    else if (hit.kind === "toggleCondition") toggleRuleChip("conditions", hit.id);
    else if (hit.kind === "toggleAction") toggleRuleChip("actions", hit.id);
    else if (hit.kind === "deleteRule") deleteEditingRule();
    else if (hit.kind === "doneRule") state.editingRuleId = null;
    else if (hit.kind === "fight") startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
    else if (hit.kind === "build") setMode("build");
  }

  function handleProgramHit(hit) {
    if (hit.kind === "programTool") {
      if (hit.tool === "library") state.libraryOpen = !state.libraryOpen;
      else if (hit.tool === "fit") fitProgramView();
      else if (hit.tool === "reset") {
        state.design.program.view = { x: 0, y: 0, zoom: 0.72 };
        saveDesign();
      } else if (hit.tool === "delete") deleteSelectedProgram();
    } else if (hit.kind === "libraryTab") {
      state.libraryTab = hit.tab;
    } else if (hit.kind === "libraryNode") {
      addProgramNode(hit.kindType, hit.type);
    } else if (hit.kind === "fight") startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
    else if (hit.kind === "build") setMode("build");
  }

  function programPointerDown(event, x, y) {
    state.touches.set(event.pointerId, { x, y });
    state.pointer.down = true;
    state.pointer.id = event.pointerId;
    state.pointer.startX = state.pointer.lastX = x;
    state.pointer.startY = state.pointer.lastY = y;
    state.pointer.lastScreenX = x;
    state.pointer.lastScreenY = y;
    state.pointer.moved = false;
    const hit = [...state.hits].reverse().find((h) => x >= h.x && y >= h.y && x <= h.x + h.w && y <= h.y + h.h);
    if (hit?.kind === "tab") {
      setMode(hit.mode);
      return;
    }
    if (state.touches.size >= 2) {
      beginProgramPinch();
      return;
    }
    if (hit && ["programTool", "libraryTab", "libraryNode", "fight", "build"].includes(hit.kind)) {
      handleProgramHit(hit);
      return;
    }
    if (hit?.kind === "programPort") {
      handleProgramPortTap(hit);
      return;
    }
    if (hit?.kind === "programNode") {
      const n = state.design.program.nodes.find((node) => node.id === hit.nodeId);
      if (!n) return;
      const w = screenToWorld(x, y);
      state.selectedNodeId = n.id;
      state.selectedProgramWireId = null;
      state.pointer.mode = "node";
      state.pointer.worldX = w.x;
      state.pointer.worldY = w.y;
      state.pointer.nodeStart = { x: n.x, y: n.y };
      return;
    }
    if (hit?.kind === "programWire") {
      state.selectedProgramWireId = hit.wireId;
      state.selectedNodeId = null;
      state.connectingPort = null;
      return;
    }
    state.pointer.mode = "pan";
    state.connectingPort = null;
  }

  function programPointerMove(event, x, y) {
    if (state.touches.has(event.pointerId)) state.touches.set(event.pointerId, { x, y });
    state.pointer.lastX = x;
    state.pointer.lastY = y;
    const moved = Math.hypot(x - state.pointer.startX, y - state.pointer.startY) > 4;
    state.pointer.moved = state.pointer.moved || moved;
    if (state.touches.size >= 2 && state.pointer.mode === "pinch") {
      updateProgramPinch();
      return;
    }
    if (!state.pointer.down || event.pointerId !== state.pointer.id) return;
    if (state.pointer.mode === "node") {
      const n = state.design.program.nodes.find((node) => node.id === state.selectedNodeId);
      if (!n) return;
      const w = screenToWorld(x, y);
      n.x = state.pointer.nodeStart.x + (w.x - state.pointer.worldX);
      n.y = state.pointer.nodeStart.y + (w.y - state.pointer.worldY);
    } else if (state.pointer.mode === "pan") {
      const v = state.design.program.view;
      v.x += (x - state.pointer.lastScreenX) / v.zoom;
      v.y += (y - state.pointer.lastScreenY) / v.zoom;
    }
    state.pointer.lastScreenX = x;
    state.pointer.lastScreenY = y;
  }

  function programPointerUp(event, x, y) {
    if (state.connectingPort) {
      const hit = [...state.hits].reverse().find((h) => x >= h.x && y >= h.y && x <= h.x + h.w && y <= h.y + h.h);
      if (hit?.kind === "programPort" && hit.dir === "in") handleProgramPortTap(hit);
    }
    state.touches.delete(event.pointerId);
    if (state.pointer.mode === "node" || state.pointer.mode === "pan" || state.pointer.mode === "pinch") saveDesign();
    if (state.touches.size >= 2) beginProgramPinch();
    else {
      state.pointer.down = false;
      state.pointer.mode = "";
    }
  }

  function beginProgramPinch() {
    const pts = [...state.touches.values()];
    if (pts.length < 2) return;
    const a = pts[0];
    const b = pts[1];
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    state.pointer.mode = "pinch";
    state.pointer.pinchDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    state.pointer.pinchZoom = state.design.program.view.zoom;
    state.pointer.pinchCenter = { screenX: cx, screenY: cy, world: screenToWorld(cx, cy) };
  }

  function updateProgramPinch() {
    const pts = [...state.touches.values()];
    if (pts.length < 2 || !state.pointer.pinchCenter) return;
    const a = pts[0];
    const b = pts[1];
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const z = clamp(state.pointer.pinchZoom * (dist / state.pointer.pinchDist), 0.4, 2.5);
    setProgramZoomAt(state.pointer.pinchCenter.screenX, state.pointer.pinchCenter.screenY, z, state.pointer.pinchCenter.world);
  }

  function zoomProgramAt(x, y, factor) {
    const before = screenToWorld(x, y);
    const z = clamp(state.design.program.view.zoom * factor, 0.4, 2.5);
    setProgramZoomAt(x, y, z, before);
  }

  function setProgramZoomAt(x, y, z, worldBefore) {
    const v = state.design.program.view;
    const area = programArea();
    v.zoom = z;
    v.x = (x - area.x - area.w / 2) / z - worldBefore.x;
    v.y = (y - area.y - area.h / 2) / z - worldBefore.y;
  }

  function handleProgramPortTap(hit) {
    if (hit.dir === "out") {
      state.connectingPort = { nodeId: hit.nodeId, port: hit.port };
      state.selectedNodeId = null;
      state.selectedProgramWireId = null;
      return;
    }
    if (!state.connectingPort) return;
    const candidate = programWire(state.connectingPort.nodeId, state.connectingPort.port, hit.nodeId, hit.port);
    if (canConnectProgramWire(candidate, state.design.program.nodes, state.design.program.wires)) {
      state.design.program.wires.push(candidate);
      saveDesign();
    } else {
      toast("BAD LINK");
    }
    state.connectingPort = null;
  }

  function addProgramNode(kind, type) {
    if (state.design.program.nodes.length >= MAX_NODES) {
      toast("MAX NODES");
      return;
    }
    const center = screenToWorld(state.w / 2, state.h / 2);
    const n = programNode(kind, type, center.x, center.y);
    state.design.program.nodes.push(n);
    state.selectedNodeId = n.id;
    state.selectedProgramWireId = null;
    state.libraryOpen = false;
    saveDesign();
  }

  function deleteSelectedProgram() {
    if (state.selectedProgramWireId) {
      state.design.program.wires = state.design.program.wires.filter((w) => w.id !== state.selectedProgramWireId);
      state.selectedProgramWireId = null;
      saveDesign();
      return;
    }
    if (state.selectedNodeId) {
      state.design.program.nodes = state.design.program.nodes.filter((n) => n.id !== state.selectedNodeId);
      state.design.program.wires = state.design.program.wires.filter((w) => w.fromNode !== state.selectedNodeId && w.toNode !== state.selectedNodeId);
      state.selectedNodeId = null;
      saveDesign();
    }
  }

  function fitProgramView() {
    const nodes = state.design.program.nodes;
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const s = programNodeSize(n);
      minX = Math.min(minX, n.x - s.w / 2);
      minY = Math.min(minY, n.y - s.h / 2);
      maxX = Math.max(maxX, n.x + s.w / 2);
      maxY = Math.max(maxY, n.y + s.h / 2);
    }
    const area = programArea();
    const z = clamp(Math.min(area.w / (maxX - minX + 180), area.h / (maxY - minY + 180)), 0.4, 2.5);
    state.design.program.view.zoom = z;
    state.design.program.view.x = -((minX + maxX) / 2);
    state.design.program.view.y = -((minY + maxY) / 2);
    saveDesign();
  }

  function handleWireHit(hit) {
    if (hit.kind === "portOut") {
      state.wireFrom = hit.endpoint;
    } else if (hit.kind === "portIn") {
      if (state.wireFrom) addWire(state.wireFrom, hit.endpoint);
    } else if (hit.kind === "wireLine") {
      if (state.selectedWireIndex === hit.index) {
        state.design.schematic.wires.splice(hit.index, 1);
        saveDesign();
      }
      state.selectedWireIndex = state.selectedWireIndex === hit.index ? null : hit.index;
      state.wireFrom = null;
    } else if (hit.kind === "logic") {
      state.selectedLogicId = hit.id;
    } else if (hit.kind === "addLogic") {
      addLogic(hit.type);
    } else if (hit.kind === "deleteLogic") deleteSelectedLogic();
    else if (hit.kind === "fight") startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
  }

  function handleFightHit(hit) {
    if (hit.kind === "restart") startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
    else if (hit.kind === "nextEnemy") {
      state.enemyIndex = (state.enemyIndex + 1) % state.enemies.length;
      localStorage.setItem(LS.enemyIndex, String(state.enemyIndex));
      state.fightOpponent = state.enemies[state.enemyIndex];
      startFight(state.fightOpponent);
    } else if (hit.kind === "build") setMode("build");
    else if (hit.kind === "program") setMode("program");
    else if (hit.kind === "share") setMode("share");
  }

  function handleShareHit(hit) {
    if (hit.kind === "fightImported" && state.opponent) {
      state.fightOpponent = state.opponent;
      startFight(state.fightOpponent);
    }
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === "fight" && !state.battle) startFight(state.fightOpponent || state.enemies[state.enemyIndex]);
    if (mode === "share") state.exportText = exportCode(state.design);
    syncShareLayer();
  }

  function defaultRot(type) {
    if (type === "gun") return 1;
    if (type === "radar") return 0;
    if (type === "armor") return 1;
    return 0;
  }

  function deleteSelectedBlock() {
    const id = state.selectedBlockId;
    const b = state.design.blocks.find((x) => x.id === id);
    if (!b || b.type === "core") return;
    state.design.blocks = pruneDisconnected(state.design.blocks.filter((x) => x.id !== id));
    state.selectedBlockId = null;
    saveDesign();
  }

  function rotateSelectedBlock() {
    const b = state.design.blocks.find((x) => x.id === state.selectedBlockId);
    if (b && b.type !== "core") {
      b.rot = (b.rot + 1) % 4;
      saveDesign();
    }
  }

  function randomDesign() {
    const blocks = [block("core", CORE, CORE, 0, "core")];
    let guard = 0;
    while (blocks.length < MAX_BLOCKS && guard < 200) {
      guard += 1;
      const a = blocks[Math.floor(rand01(guard) * blocks.length)];
      const d = DIRS[Math.floor(rand01(guard * 7) * 4)];
      const x = a.x + d.x;
      const y = a.y + d.y;
      if (x < 0 || y < 0 || x >= GRID || y >= GRID || blocks.some((b) => b.x === x && b.y === y)) continue;
      const type = PALETTE[Math.floor(rand01(guard * 13) * PALETTE.length)];
      blocks.push(block(type, x, y, defaultRot(type)));
    }
    state.design = normalizeDesign({ version: 3, name: "Random Bot", blocks, program: defaultProgram() });
    state.selectedBlockId = null;
    saveDesign();
  }

  function addRule() {
    const rules = state.design.brain.rules;
    if (rules.length >= 12) {
      toast("MAX RULES");
      return;
    }
    const r = rule(uid("r"), ["enemySeen"], ["aimAtEnemy"]);
    rules.push(r);
    state.editingRuleId = r.id;
    saveDesign();
  }

  function editingRule() {
    return state.design.brain.rules.find((r) => r.id === state.editingRuleId) || null;
  }

  function toggleRuleChip(kind, id) {
    const r = editingRule();
    if (!r) return;
    const available = kind === "conditions" ? chipAvailable("sensor", id, state.design) : chipAvailable("action", id, state.design);
    if (!available.ok) {
      toast(available.need);
      return;
    }
    const key = kind === "conditions" ? "sensor" : "action";
    const list = r[kind];
    const i = list.findIndex((x) => x[key] === id);
    if (i >= 0) list.splice(i, 1);
    else if (list.length < (kind === "conditions" ? 5 : 4)) list.push({ [key]: id });
    saveDesign();
  }

  function deleteEditingRule() {
    const id = state.editingRuleId;
    if (!id) return;
    state.design.brain.rules = state.design.brain.rules.filter((r) => r.id !== id);
    state.editingRuleId = null;
    saveDesign();
  }

  function addLogic(type) {
    if (state.design.schematic.logicNodes.length >= MAX_LOGIC) {
      toast("MAX");
      return;
    }
    const n = logic(type, 1, state.design.schematic.logicNodes.length + 1);
    state.design.schematic.logicNodes.push(n);
    state.selectedLogicId = n.id;
    saveDesign();
  }

  function deleteSelectedLogic() {
    const id = state.selectedLogicId;
    if (!id) return;
    state.design.schematic.logicNodes = state.design.schematic.logicNodes.filter((n) => n.id !== id);
    state.design.schematic.wires = state.design.schematic.wires.filter((w) => !w.from.startsWith(`${id}.`) && !w.to.startsWith(`${id}.`));
    state.selectedLogicId = null;
    state.wireFrom = null;
    saveDesign();
  }

  function addWire(from, to) {
    const nodes = state.design.schematic.logicNodes;
    const logicIds = new Set(nodes.map((n) => n.id));
    if (!isOutputEndpoint(from, logicIds) || !isInputEndpoint(to, logicIds)) {
      state.wireFrom = null;
      return;
    }
    if (!canConnectEndpoints(from, to, nodes)) {
      toast("LEFT > RIGHT");
      state.wireFrom = null;
      return;
    }
    const wires = state.design.schematic.wires;
    const existing = wires.findIndex((w) => w.from === from && w.to === to);
    if (existing >= 0) wires.splice(existing, 1);
    else if (wires.length < MAX_WIRES) wires.push({ from, to });
    state.wireFrom = null;
    state.selectedWireIndex = null;
    saveDesign();
  }

  function startFight(opponent) {
    state.fightOpponent = normalizeDesign(opponent || state.enemies[state.enemyIndex]);
    const arena = fightArena();
    const seed = hashString(JSON.stringify(state.design) + JSON.stringify(state.fightOpponent));
    const rng = mulberry32(seed);
    const obstacles = makeObstacles(arena, rng);
    const playerPos = startSpot(arena, obstacles, 0.2, rng);
    const enemyPos = startSpot(arena, obstacles, 0.8, rng);
    const playerAngle = Math.atan2(enemyPos.y - playerPos.y, enemyPos.x - playerPos.x) + (rng() - 0.5) * 0.7;
    const enemyAngle = Math.atan2(playerPos.y - enemyPos.y, playerPos.x - enemyPos.x) + (rng() - 0.5) * 0.7;
    state.battle = {
      t: 0,
      acc: 0,
      seed,
      rng,
      result: "",
      reason: "",
      arena,
      obstacles,
      bullets: [],
      particles: [],
      player: makeBattleBot(state.design, "P", playerPos.x, playerPos.y, playerAngle, seed ^ 0x1234),
      enemy: makeBattleBot(state.fightOpponent, "E", enemyPos.x, enemyPos.y, enemyAngle, seed ^ 0xabcd),
    };
    state.mode = "fight";
    syncShareLayer();
  }

  function makeBattleBot(design, side, x, y, angle, seed) {
    const blocks = design.blocks.map((b) => ({
      ...b,
      hp: BLOCKS[b.type].hp,
      maxHp: BLOCKS[b.type].hp,
      alive: true,
      flash: 0,
      localX: b.x - CORE,
      localY: b.y - CORE,
    }));
    const bot = {
      id: side,
      side,
      design,
      blocks,
      x,
      y,
      bodyAngle: angle,
      turretAngle: angle,
      radarAngle: angle,
      radarDir: 1,
      energy: 0,
      maxEnergy: 1,
      regen: 1,
      gunCooldown: 0,
      hitWallT: 0,
      hitBulletT: 0,
      wallAheadT: 0,
      lastSeenT: 0,
      lastSeenAngle: angle,
      lastSeenDist: 9999,
      sensors: {},
      prevSensors: {},
      actions: {},
      programValues: {},
      activeProgramNodes: [],
      ruleStates: {},
      activeRules: [],
      logicMemory: {},
      rand: mulberry32(seed),
      pulse: {},
      report: {
        shots: 0,
        hits: 0,
        damageDealt: 0,
        damageTaken: 0,
        blocksLost: 0,
        coreHits: 0,
        wastedShots: 0,
        lockShots: 0,
        enemySeenTicks: 0,
        nearTicks: 0,
        wallTicks: 0,
        bulletIncomingTicks: 0,
        dodgeTicks: 0,
      },
      defeated: false,
    };
    recalcBotStats(bot);
    bot.energy = bot.maxEnergy;
    return bot;
  }

  function recalcBotStats(bot) {
    const live = (type) => bot.blocks.filter((b) => b.alive && b.type === type).length;
    bot.stats = {
      wheels: live("wheel"),
      guns: live("gun"),
      radars: live("radar"),
      batteries: live("battery"),
      armor: live("armor"),
    };
    bot.maxEnergy = BLOCKS.core.energy + bot.stats.batteries * BLOCKS.battery.energy;
    bot.regen = BLOCKS.core.regen + bot.stats.batteries * BLOCKS.battery.regen;
    bot.speed = 20 + bot.stats.wheels * 34;
    bot.turn = 0.9 + bot.stats.wheels * 0.36;
    bot.radarRange = bot.stats.radars ? 285 + bot.stats.radars * 55 : 0;
    bot.radarFov = bot.stats.radars ? 0.38 + bot.stats.radars * 0.055 : 0;
    bot.gunCooldownMax = Math.max(0.34, 0.82 - bot.stats.guns * 0.08);
  }

  function updateFight(dt) {
    const b = state.battle;
    if (!b) return;
    updateParticles(b, dt);
    if (b.result) return;
    b.acc += Math.min(dt, 0.08);
    let loops = 0;
    while (b.acc >= TICK && loops < 4) {
      stepBattle(b, TICK);
      b.acc -= TICK;
      loops += 1;
    }
  }

  function stepBattle(b, dt) {
    b.t += dt;
    updateBotSignals(b.player, b.enemy, b, dt);
    updateBotSignals(b.enemy, b.player, b, dt);
    evaluateSchematic(b.player, b, dt);
    evaluateSchematic(b.enemy, b, dt);
    applyActions(b.player, b, dt);
    applyActions(b.enemy, b, dt);
    updateBullets(b, dt);
    for (const bot of [b.player, b.enemy]) {
      bot.energy = clamp(bot.energy + bot.regen * dt, 0, bot.maxEnergy);
      bot.gunCooldown = Math.max(0, bot.gunCooldown - dt);
      bot.hitWallT = Math.max(0, bot.hitWallT - dt);
      bot.hitBulletT = Math.max(0, bot.hitBulletT - dt);
      bot.wallAheadT = Math.max(0, bot.wallAheadT - dt);
      bot.lastSeenT = Math.max(0, bot.lastSeenT - dt);
      for (const key of Object.keys(bot.pulse)) bot.pulse[key] = Math.max(0, bot.pulse[key] - dt);
      for (const bl of bot.blocks) bl.flash = Math.max(0, bl.flash - dt * 5);
      recalcBotStats(bot);
    }
    const pc = coreHp(b.player);
    const ec = coreHp(b.enemy);
    if (pc <= 0 && ec <= 0) finishFight("DRAW", "CORES");
    else if (ec <= 0) finishFight("WIN", "CORE");
    else if (pc <= 0) finishFight("LOSE", "CORE");
    else if (b.t >= MAX_FIGHT) {
      const pm = totalHp(b.player);
      const em = totalHp(b.enemy);
      finishFight(pm >= em ? "WIN" : "LOSE", "TIME");
    }
  }

  function updateBotSignals(bot, foe, battle) {
    const core = bot.blocks.find((x) => x.type === "core" && x.alive);
    const foeCore = foe.blocks.find((x) => x.type === "core" && x.alive);
    const dist = foeCore ? Math.hypot(foe.x - bot.x, foe.y - bot.y) : 9999;
    let seen = false;
    if (bot.stats?.radars > 0 && foeCore) {
      const target = nearestLiveBlockWorld(bot, foe, battle);
      const a = Math.atan2(target.y - bot.y, target.x - bot.x);
      const d = Math.hypot(target.x - bot.x, target.y - bot.y);
      seen = d < bot.radarRange && Math.abs(angleDiff(a, bot.radarAngle)) < bot.radarFov;
      if (seen) {
        bot.lastSeenAngle = a;
        bot.lastSeenDist = d;
        bot.lastSeenT = 1.35;
      }
    }
    const seenOrMemory = seen || bot.lastSeenT > 0;
    const side = angleDiff(bot.lastSeenAngle, bot.bodyAngle);
    const turretDiff = Math.abs(angleDiff(bot.turretAngle, bot.lastSeenAngle));
    const hp = totalHp(bot);
    const maxHp = bot.blocks.reduce((sum, bl) => sum + bl.maxHp, 0);
    const incoming = bulletIncoming(bot, battle);
    const wallAhead = wallAheadCheck(bot, battle);
    const nextSensors = {
      always: true,
      enemySeen: seen,
      enemyNear: seenOrMemory && bot.lastSeenDist < 145,
      enemyFar: seenOrMemory && bot.lastSeenDist > 190,
      enemyLeft: seenOrMemory && side < -0.12,
      enemyRight: seenOrMemory && side > 0.12,
      enemyFront: seenOrMemory && Math.abs(side) < 0.35,
      gunAligned: seenOrMemory && turretDiff < 0.18,
      gunReady: bot.stats.guns > 0 && bot.gunCooldown <= 0 && bot.energy >= fireCost(bot),
      wallAhead,
      bulletIncoming: incoming,
      hitWall: bot.hitWallT > 0,
      hitByBullet: bot.hitBulletT > 0,
      lowHp: coreHp(bot) < BLOCKS.core.hp * 0.45 || hp < maxHp * 0.45,
      lowEnergy: bot.energy < bot.maxEnergy * 0.28,
    };
    for (const key of ["enemySeen", "gunAligned", "bulletIncoming", "wallAhead"]) {
      if (nextSensors[key] && !bot.prevSensors[key]) bot.pulse[key] = 0.42;
    }
    bot.sensors = nextSensors;
    bot.prevSensors = { ...nextSensors };
    if (seen) bot.report.enemySeenTicks += 1;
    if (nextSensors.enemyNear) bot.report.nearTicks += 1;
    if (nextSensors.wallAhead || nextSensors.hitWall) bot.report.wallTicks += 1;
    if (nextSensors.bulletIncoming) bot.report.bulletIncomingTicks += 1;
  }

  function bulletIncoming(bot, battle) {
    for (const bullet of battle.bullets) {
      if (bullet.owner === bot.id) continue;
      const dx = bot.x - bullet.x;
      const dy = bot.y - bullet.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 95) continue;
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
      const toward = (dx * bullet.vx + dy * bullet.vy) / (dist * speed || 1);
      if (toward > 0.55) return true;
    }
    return false;
  }

  function wallAheadCheck(bot, battle) {
    const r = botRadius(bot, battle) * 0.55;
    const look = 44 + bot.stats.wheels * 10;
    const x = bot.x + Math.cos(bot.bodyAngle) * look;
    const y = bot.y + Math.sin(bot.bodyAngle) * look;
    const ar = battle.arena;
    if (x - r < ar.x || y - r < ar.y || x + r > ar.x + ar.w || y + r > ar.y + ar.h) return true;
    return battle.obstacles.some((o) => circleRectOverlap(x, y, r, o));
  }

  function evaluateSchematic(bot, battle, dt) {
    if (bot.design.program?.nodes?.length) {
      evaluateProgram(bot, battle, dt);
      return;
    }
    const s = bot.design.schematic;
    const values = {};
    for (const [id] of SENSORS) values[`sensor.${id}`] = !!bot.sensors[id];
    const rules = bot.design.brain?.rules || [];
    if (rules.length) {
      const actions = {};
      for (const [id] of ACTIONS) actions[id] = false;
      bot.ruleStates = {};
      bot.activeRules = [];
      for (const r of rules) {
        const conditions = r.conditions || [];
        const ready = conditions.length > 0 && conditions.every((c) => {
          const value = !!bot.sensors[c.sensor];
          return c.not ? !value : value;
        });
        bot.ruleStates[r.id] = ready;
        if (ready) {
          bot.activeRules.push(r.id);
          for (const a of r.actions || []) if (ACTION_META[a.action]) actions[a.action] = true;
        }
      }
      bot.actions = actions;
      if (bot.side === "P") state.lastSignals = values;
      return;
    }
    const inputValue = (endpoint) => s.wires.some((w) => w.to === endpoint && values[w.from]);
    const hasInput = (endpoint) => s.wires.some((w) => w.to === endpoint);
    for (const node of s.logicNodes) {
      const key = node.id;
      const info = LOGIC_TYPES[node.type];
      let value = false;
      if (node.type === "and") {
        value = inputValue(`${key}.in0`) && inputValue(`${key}.in1`);
      } else if (node.type === "or") {
        value = inputValue(`${key}.in0`) || inputValue(`${key}.in1`);
      } else if (node.type === "not") {
        value = hasInput(`${key}.in0`) && !inputValue(`${key}.in0`);
      } else if (node.type === "timer") {
        const period = 1.05;
        value = (battle.t % period) < 0.18;
      } else if (node.type === "random") {
        const mem = bot.logicMemory[key] || { next: 0, value: false };
        if (battle.t >= mem.next) {
          mem.value = bot.rand() < 0.38;
          mem.next = battle.t + 0.45;
          bot.logicMemory[key] = mem;
        }
        value = mem.value;
      }
      if (!info.inputs && (node.type === "timer" || node.type === "random")) value = !!value;
      values[`${key}.out`] = value;
    }
    bot.actions = {};
    for (const [id] of ACTIONS) bot.actions[id] = inputValue(`action.${id}`);
    if (bot.side === "P") state.lastSignals = values;
  }

  function evaluateProgram(bot, battle, dt) {
    const program = bot.design.program;
    const nodes = [...program.nodes].sort((a, b) => a.x - b.x || a.y - b.y);
    const values = {};
    const inputConnected = (node, port) => program.wires.some((w) => w.toNode === node.id && w.toPort === port);
    const inputValue = (node, port) => program.wires.some((w) => w.toNode === node.id && w.toPort === port && values[w.fromNode]);
    for (const node of nodes) {
      const available = programNodeAvailable(node, bot.design).ok;
      let value = false;
      if (node.kind === "sensor") {
        value = available && !!bot.sensors[node.type];
      } else if (node.kind === "logic") {
        if (node.type === "and") {
          const ports = programInputPorts(node);
          value = ports.length > 0 && ports.every((p) => inputConnected(node, p) && inputValue(node, p));
        } else if (node.type === "or") {
          value = programInputPorts(node).some((p) => inputConnected(node, p) && inputValue(node, p));
        } else if (node.type === "not") {
          value = inputConnected(node, "in0") && !inputValue(node, "in0");
        } else if (node.type === "timer") {
          value = (battle.t % 1.05) < 0.18;
        } else if (node.type === "random") {
          const mem = bot.logicMemory[node.id] || { next: 0, value: false };
          if (battle.t >= mem.next) {
            mem.value = bot.rand() < 0.38;
            mem.next = battle.t + 0.45;
            bot.logicMemory[node.id] = mem;
          }
          value = mem.value;
        }
      } else if (node.kind === "action") {
        value = available && inputConnected(node, "in") && inputValue(node, "in");
      }
      values[node.id] = !!value;
    }
    const actions = {};
    for (const [id] of ACTIONS) actions[id] = false;
    for (const node of program.nodes) {
      if (node.kind === "action" && values[node.id]) actions[node.type] = true;
    }
    bot.actions = actions;
    bot.programValues = values;
    bot.activeProgramNodes = Object.keys(values).filter((id) => values[id]);
    if (bot.side === "P") state.lastSignals = values;
  }

  function applyActions(bot, battle, dt) {
    const a = bot.actions;
    const turn = (a.turnRight ? 1 : 0) - (a.turnLeft ? 1 : 0);
    bot.bodyAngle = normAngle(bot.bodyAngle + turn * bot.turn * dt);
    let moveAngle = null;
    let speedScale = 1;
    if (a.stop) {
      moveAngle = null;
    } else if (a.moveBackward) {
      moveAngle = bot.bodyAngle + Math.PI;
      speedScale = 0.72;
    } else if ((a.orbitLeft || a.orbitRight) && bot.lastSeenT > 0) {
      moveAngle = bot.lastSeenAngle + (a.orbitLeft ? -Math.PI / 2 : Math.PI / 2);
      speedScale = 0.82;
      if (bot.sensors.bulletIncoming) bot.report.dodgeTicks += 1;
      bot.bodyAngle = approachAngle(bot.bodyAngle, moveAngle, bot.turn * dt * 0.55);
    } else if (a.moveForward) {
      moveAngle = bot.bodyAngle;
    }
    const ox = bot.x;
    const oy = bot.y;
    if (moveAngle != null) {
      bot.x += Math.cos(moveAngle) * bot.speed * speedScale * dt;
      bot.y += Math.sin(moveAngle) * bot.speed * speedScale * dt;
    }
    const ar = battle.arena;
    const margin = botRadius(bot, battle);
    const tx = bot.x;
    const ty = bot.y;
    bot.x = clamp(bot.x, ar.x + margin, ar.x + ar.w - margin);
    bot.y = clamp(bot.y, ar.y + margin, ar.y + ar.h - margin);
    let blocked = Math.abs(bot.x - tx) > 0.01 || Math.abs(bot.y - ty) > 0.01;
    if (!blocked) {
      const r = margin * 0.58;
      for (const o of battle.obstacles) {
        if (circleRectOverlap(bot.x, bot.y, r, o)) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) {
      bot.x = ox;
      bot.y = oy;
      bot.hitWallT = 0.42;
      bot.wallAheadT = 0.42;
    }

    if (bot.stats.radars > 0) {
      if (a.radarSweep) {
        if (bot.sensors.enemySeen || bot.lastSeenT > 0) {
          bot.radarAngle = approachAngle(bot.radarAngle, bot.lastSeenAngle, 5.2 * dt);
        } else {
          bot.radarAngle = normAngle(bot.radarAngle + bot.radarDir * 4.1 * dt);
        }
      } else {
        bot.radarAngle = approachAngle(bot.radarAngle, bot.bodyAngle, 2 * dt);
      }
    }
    if (a.aimAtEnemy && bot.lastSeenT > 0) bot.turretAngle = approachAngle(bot.turretAngle, bot.lastSeenAngle, 5.8 * dt);
    else bot.turretAngle = approachAngle(bot.turretAngle, bot.bodyAngle, 1.2 * dt);
    const aimed = bot.lastSeenT > 0 && Math.abs(angleDiff(bot.turretAngle, bot.lastSeenAngle)) < 0.18;
    if (a.fire && bot.sensors.gunReady) fireBullet(bot, battle, aimed);
  }

  function fireBullet(bot, battle, aimed) {
    const gun = bot.blocks.find((bl) => bl.alive && bl.type === "gun");
    if (!gun) return;
    const pos = blockWorld(bot, gun, battleScale(battle));
    const speed = 360;
    const dmg = 10 + Math.max(0, bot.stats.guns - 1) * 2;
    const cost = fireCost(bot);
    const spread = aimed ? (bot.rand() - 0.5) * 0.05 : (bot.rand() - 0.5) * 0.9;
    const angle = normAngle(bot.turretAngle + spread);
    bot.energy -= cost;
    bot.gunCooldown = bot.gunCooldownMax;
    bot.pulse.fire = 0.28;
    bot.report.shots += 1;
    if (aimed) bot.report.lockShots += 1;
    else bot.report.wastedShots += 1;
    battle.bullets.push({
      x: pos.x + Math.cos(angle) * 16,
      y: pos.y + Math.sin(angle) * 16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      owner: bot.id,
      damage: dmg,
      ttl: 2.8,
      trail: [{ x: pos.x, y: pos.y }],
      aimed,
    });
    spawnSpark(pos.x, pos.y, battle, 4);
  }

  function fireCost(bot) {
    return Math.max(6, 9 - Math.max(0, bot.stats.guns - 1));
  }

  function updateBullets(battle, dt) {
    const next = [];
    for (const bullet of battle.bullets) {
      bullet.ttl -= dt;
      bullet.trail.push({ x: bullet.x, y: bullet.y });
      if (bullet.trail.length > 8) bullet.trail.shift();
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      const ar = battle.arena;
      if (bullet.ttl <= 0 || bullet.x < ar.x || bullet.y < ar.y || bullet.x > ar.x + ar.w || bullet.y > ar.y + ar.h) continue;
      const obstacle = battle.obstacles.find((o) => pointInRect(bullet.x, bullet.y, o));
      if (obstacle) {
        spawnSpark(bullet.x, bullet.y, battle, 5);
        continue;
      }
      const target = bullet.owner === "P" ? battle.enemy : battle.player;
      const hit = bulletHitBlock(target, bullet, battle);
      if (hit) {
        damageBlock(target, hit, bullet.damage, battle, bullet.owner);
        spawnSpark(bullet.x, bullet.y, battle, 10);
        continue;
      }
      next.push(bullet);
    }
    battle.bullets = next;
  }

  function bulletHitBlock(bot, bullet, battle) {
    const scale = battleScale(battle);
    let best = null;
    for (const bl of bot.blocks) {
      if (!bl.alive) continue;
      const p = blockWorld(bot, bl, scale);
      const d = Math.hypot(p.x - bullet.x, p.y - bullet.y);
      const r = scale * (bl.type === "armor" ? 0.95 : 0.82) + 3;
      if (d <= r && (!best || d < best.d)) best = { bl, d };
    }
    return best?.bl || null;
  }

  function pointInRect(x, y, r) {
    return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
  }

  function circleRectOverlap(cx, cy, radius, r) {
    const x = clamp(cx, r.x, r.x + r.w);
    const y = clamp(cy, r.y, r.y + r.h);
    return Math.hypot(cx - x, cy - y) <= radius;
  }

  function damageBlock(bot, bl, amount, battle, attackerId) {
    const attacker = attackerId === "P" ? battle.player : battle.enemy;
    bl.hp -= amount;
    bl.flash = 1;
    bot.hitBulletT = 0.45;
    bot.report.damageTaken += amount;
    if (attacker && attacker !== bot) {
      attacker.report.damageDealt += amount;
      attacker.report.hits += 1;
    }
    if (bl.type === "core") bot.report.coreHits += 1;
    if (bl.hp <= 0 && bl.alive) {
      bl.alive = false;
      bot.report.blocksLost += 1;
      const p = blockWorld(bot, bl, battleScale(battle));
      spawnBreak(p.x, p.y, battle, bl.type === "core" ? 24 : 12);
    }
  }

  function finishFight(result, reason) {
    const b = state.battle;
    if (!b || b.result) return;
    b.result = result;
    b.reason = reason;
    b.analysis = resultAnalysis(b);
    spawnBreak(state.w / 2, state.h * 0.36, b, 28);
  }

  function resultAnalysis(battle) {
    const p = battle.player.report;
    const accuracy = p.shots ? Math.round((p.hits / p.shots) * 100) : 0;
    const notes = [];
    if (p.enemySeenTicks < battle.t * 8) notes.push("NO RADAR LOCK");
    if (p.shots >= 3 && p.wastedShots > p.lockShots) notes.push("WASTED SHOTS");
    if (p.nearTicks > battle.t * 13) notes.push("TOO CLOSE");
    if (p.wallTicks > battle.t * 7) notes.push("WALL STUCK");
    if (p.coreHits >= 2) notes.push("CORE EXPOSED");
    if (p.bulletIncomingTicks > 8 && p.dodgeTicks > 5) notes.push("GOOD DODGE");
    if (p.lockShots >= Math.max(2, p.wastedShots * 2)) notes.push("GOOD LOCK");
    if (!notes.length) notes.push(accuracy >= 45 ? "GOOD LOCK" : "TUNE PROGRAM");
    return {
      damageDealt: Math.round(p.damageDealt),
      damageTaken: Math.round(p.damageTaken),
      accuracy,
      blocksLost: p.blocksLost,
      coreHp: Math.round(coreHp(battle.player)),
      notes: notes.slice(0, 2),
    };
  }

  function fightArena() {
    const top = 58;
    const bottom = Math.max(top + 300, state.h - 154);
    const pad = 14;
    return { x: pad, y: top, w: state.w - pad * 2, h: bottom - top };
  }

  function makeObstacles(arena, rng) {
    const base = [
      { x: 0.45, y: 0.16, w: 0.1, h: 0.2 },
      { x: 0.25, y: 0.58, w: 0.15, h: 0.09 },
      { x: 0.63, y: 0.6, w: 0.12, h: 0.16 },
    ];
    if (arena.h > 430) base.push({ x: 0.44, y: 0.78, w: 0.12, h: 0.08 });
    return base.map((o, i) => ({
      x: Math.round(arena.x + arena.w * o.x + (rng() - 0.5) * 14),
      y: Math.round(arena.y + arena.h * o.y + (rng() - 0.5) * 14),
      w: Math.round(arena.w * o.w),
      h: Math.round(arena.h * o.h),
      id: i,
    }));
  }

  function startSpot(arena, obstacles, xFrac, rng) {
    for (let i = 0; i < 18; i += 1) {
      const p = {
        x: arena.x + arena.w * xFrac,
        y: arena.y + arena.h * (0.18 + rng() * 0.64),
      };
      if (!obstacles.some((o) => circleRectOverlap(p.x, p.y, 34, o))) return p;
    }
    return { x: arena.x + arena.w * xFrac, y: arena.y + arena.h * (xFrac < 0.5 ? 0.26 : 0.74) };
  }

  function battleScale(battle) {
    return clamp(Math.floor(battle.arena.w / 23), 13, 20);
  }

  function blockWorld(bot, bl, scale) {
    const lx = bl.localX * scale;
    const ly = bl.localY * scale;
    const c = Math.cos(bot.bodyAngle);
    const s = Math.sin(bot.bodyAngle);
    return { x: bot.x + lx * c - ly * s, y: bot.y + lx * s + ly * c };
  }

  function nearestLiveBlockWorld(observer, foe, battle) {
    const scale = battleScale(battle);
    let best = null;
    for (const bl of foe.blocks) {
      if (!bl.alive) continue;
      const p = blockWorld(foe, bl, scale);
      const d = Math.hypot(p.x - observer.x, p.y - observer.y);
      if (!best || d < best.d) best = { ...p, d };
    }
    return best || { x: foe.x, y: foe.y, d: 9999 };
  }

  function botRadius(bot, battle) {
    const scale = battleScale(battle);
    let r = 24;
    for (const bl of bot.blocks) {
      if (!bl.alive) continue;
      r = Math.max(r, Math.hypot(bl.localX * scale, bl.localY * scale) + scale);
    }
    return r;
  }

  function coreHp(bot) {
    const core = bot.blocks.find((b) => b.type === "core");
    return core && core.alive ? Math.max(0, core.hp) : 0;
  }

  function totalHp(bot) {
    return bot.blocks.reduce((sum, b) => sum + (b.alive ? Math.max(0, b.hp) : 0), 0);
  }

  function spawnSpark(x, y, battle, count) {
    for (let i = 0; i < count; i += 1) {
      const a = battle.rng() * Math.PI * 2;
      battle.particles.push({ x, y, vx: Math.cos(a) * (30 + battle.rng() * 90), vy: Math.sin(a) * (30 + battle.rng() * 90), life: 0.24 + battle.rng() * 0.2, size: 2 + battle.rng() * 3 });
    }
  }

  function spawnBreak(x, y, battle, count) {
    for (let i = 0; i < count; i += 1) {
      const a = battle.rng() * Math.PI * 2;
      battle.particles.push({ x, y, vx: Math.cos(a) * (45 + battle.rng() * 130), vy: Math.sin(a) * (45 + battle.rng() * 130), life: 0.45 + battle.rng() * 0.35, size: 3 + battle.rng() * 4 });
    }
  }

  function updateParticles(battle, dt) {
    for (const p of battle.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    battle.particles = battle.particles.filter((p) => p.life > 0);
  }

  function draw() {
    state.hits = [];
    ctx.clearRect(0, 0, state.w, state.h);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, state.w, state.h);
    drawTabs();
    if (state.mode === "build") drawBuild();
    else if (state.mode === "program") drawProgram();
    else if (state.mode === "fight") drawFight();
    else drawShare();
    if (state.toastT > 0) {
      ctx.fillStyle = INK;
      ctx.fillRect(state.w / 2 - 52, 46, 104, 26);
      text(state.toast, state.w / 2, 60, 13, "center", PAPER);
    }
    canvas.dataset.mode = state.mode;
    canvas.dataset.blocks = String(state.design.blocks.length);
    canvas.dataset.logic = String(state.design.schematic.logicNodes.length);
    canvas.dataset.wires = String(state.design.program.wires.length);
    canvas.dataset.nodes = String(state.design.program.nodes.length);
    canvas.dataset.fight = state.battle
      ? `${state.battle.t.toFixed(1)},${state.battle.bullets.length},${Math.round(coreHp(state.battle.player))},${Math.round(coreHp(state.battle.enemy))},${state.battle.result}`
      : "";
    canvas.dataset.signals = state.battle ? JSON.stringify(state.battle.player.sensors) : "";
    canvas.dataset.debug = state.battle
      ? JSON.stringify({
          energy: Math.round(state.battle.player.energy),
          maxEnergy: Math.round(state.battle.player.maxEnergy),
          cooldown: Number(state.battle.player.gunCooldown.toFixed(2)),
          guns: state.battle.player.stats.guns,
          actions: state.battle.player.actions,
          aimDiff: Number(Math.abs(angleDiff(state.battle.player.turretAngle, state.battle.player.lastSeenAngle)).toFixed(2)),
        })
      : "";
    syncShareLayer();
  }

  function drawTabs() {
    const tabs = ["build", "program", "fight", "share"];
    const labels = ["Build", "Program", "Test", "Share"];
    const w = state.w / tabs.length;
    for (let i = 0; i < tabs.length; i += 1) {
      const active = state.mode === tabs[i];
      ctx.fillStyle = active ? ACCENT : PANEL;
      ctx.strokeStyle = active ? "#3149b5" : "#cbd7e4";
      ctx.lineWidth = active ? 2 : 1;
      roundRect(i * w + 5, 7, w - 10, 30, 8, true, true);
      text(labels[i], i * w + w / 2, 22, 12, "center", active ? "#fff" : INK);
      addHit("tab", i * w, 0, w, 42, { mode: tabs[i] });
    }
  }

  function drawBuild() {
    const l = buildLayout();
    text(state.design.name, 16, 56, 15, "left");
    button("Random", state.w - 90, 42, 74, 30, false, 10);
    addHit("random", state.w - 90, 42, 74, 30);
    drawBuildGrid(l);
    drawBuildStats(l);
    drawBuildHints(l);
    drawBuildInspector(l);
    drawBuildPalette(l);
    drawBuildActions(l);
    drawFloatingBlockTools(l);
  }

  function buildLayout() {
    const top = 82;
    const gridSize = Math.floor(Math.min(state.w - 42, Math.max(252, state.h * 0.36)));
    const cell = Math.floor(gridSize / GRID);
    const size = cell * GRID;
    return {
      x: Math.floor((state.w - size) / 2),
      y: top,
      cell,
      size,
      statsY: top + size + 14,
      hintY: top + size + 96,
      inspectorY: top + size + 132,
      paletteY: Math.min(state.h - 182, top + size + 184),
      actionY: state.h - 58,
    };
  }

  function drawBuildGrid(l) {
    ctx.fillStyle = "#eef3f8";
    ctx.strokeStyle = "#d7e2ec";
    ctx.lineWidth = 1;
    roundRect(l.x - 14, l.y - 14, l.size + 28, l.size + 28, 24, true, true);
    drawBuildJoints(l);
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const px = l.x + x * l.cell;
        const py = l.y + y * l.cell;
        const b = state.design.blocks.find((q) => q.x === x && q.y === y);
        const place = canPlace(x, y);
        if (place && !b) {
          const ok = placementNatural(state.selectedBlockType, x, y);
          ctx.fillStyle = ok ? "rgba(68, 179, 125, 0.22)" : "rgba(130, 145, 165, 0.14)";
          ctx.strokeStyle = ok ? "#44b37d" : "#9aa8b6";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px + l.cell / 2, py + l.cell / 2, ok ? 9 : 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        if (b) drawBlockIcon(b.type, px + l.cell / 2, py + l.cell / 2, l.cell * (b.type === "core" ? 1.15 : 1.0), b.rot, { selected: b.id === state.selectedBlockId });
        addHit("cell", px, py, l.cell, l.cell, { gx: x, gy: y });
      }
    }
  }

  function drawBuildJoints(l) {
    ctx.lineCap = "round";
    for (const b of state.design.blocks) {
      for (const d of DIRS) {
        const n = state.design.blocks.find((q) => q.x === b.x + d.x && q.y === b.y + d.y);
        if (!n) continue;
        const ax = l.x + b.x * l.cell + l.cell / 2;
        const ay = l.y + b.y * l.cell + l.cell / 2;
        const bx = l.x + n.x * l.cell + l.cell / 2;
        const by = l.y + n.y * l.cell + l.cell / 2;
        if (ax > bx || ay > by) continue;
        ctx.strokeStyle = "#9fb0bf";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.strokeStyle = "#eaf0f6";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }
    ctx.lineCap = "butt";
  }

  function drawBuildPalette(l) {
    text("Parts", 16, l.paletteY - 13, 11, "left", "#555");
    const gap = 8;
    const cardW = Math.max(66, Math.floor((state.w - 28 - gap * 4) / 5));
    const cardH = 78;
    let x = 14;
    for (const type of PALETTE) {
      const active = state.selectedBlockType === type && !state.selectedBlockId;
      const info = PART_INFO[type];
      ctx.fillStyle = active ? info.color : "#fff";
      ctx.strokeStyle = active ? info.dark : "#d8e1ea";
      ctx.lineWidth = active ? 2 : 1;
      roundRect(x, l.paletteY, cardW, cardH, 12, true, true);
      drawBlockIcon(type, x + cardW / 2, l.paletteY + 23, 34, defaultRot(type), { card: true, inverse: active });
      text(info.name, x + cardW / 2, l.paletteY + 49, 9, "center", active ? "#fff" : INK);
      text(info.role, x + cardW / 2, l.paletteY + 64, 8, "center", active ? "#fff" : info.dark);
      addHit("palette", x, l.paletteY, cardW, cardH, { type });
      x += cardW + gap;
    }
  }

  function drawBuildActions(l) {
    const gap = 10;
    const w = Math.floor((state.w - 34 - gap) / 2);
    button("Program", 12, l.actionY, w, 44, false, 13);
    button("Test", 22 + w, l.actionY, w, 44, true, 13);
    addHit("program", 12, l.actionY, w, 44);
    addHit("fight", 22 + w, l.actionY, w, 44);
  }

  function drawBuildStats(l) {
    const s = designStats(state.design);
    const preview = !state.selectedBlockId ? designStats({ ...state.design, blocks: [...state.design.blocks, block(state.selectedBlockType, 0, 0)] }) : s;
    const items = [
      ["SPD", s.speed / 150, preview.speed / 150],
      ["TURN", s.turn / 3.1, preview.turn / 3.1],
      ["RADAR", s.radar / 310, preview.radar / 310],
      ["FIRE", s.fire / 3.2, preview.fire / 3.2],
      ["ENERGY", s.energy / 150, preview.energy / 150],
      ["ARMOR", s.armor / 120, preview.armor / 120],
    ];
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#d7d7d7";
    ctx.lineWidth = 1;
    roundRect(12, l.statsY, state.w - 24, 70, 12, true, true);
    const w = Math.floor((state.w - 46) / 2);
    for (let i = 0; i < items.length; i += 1) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 22 + col * (w + 10);
      const y = l.statsY + 13 + row * 18;
      text(items[i][0], x, y + 5, 9, "left");
      ctx.strokeStyle = "#bbb";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 48, y, w - 58, 10);
      ctx.fillStyle = "#d7e7f8";
      ctx.fillRect(x + 50, y + 2, (w - 62) * clamp(items[i][2], 0, 1), 6);
      ctx.fillStyle = INK;
      ctx.fillRect(x + 50, y + 2, (w - 62) * clamp(items[i][1], 0, 1), 6);
    }
  }

  function designStats(design) {
    const count = (type) => design.blocks.filter((b) => b.type === type).length;
    const wheels = count("wheel");
    const guns = count("gun");
    const radars = count("radar");
    const batteries = count("battery");
    const armor = count("armor");
    return {
      speed: 20 + wheels * 34,
      turn: 0.9 + wheels * 0.36,
      radar: radars ? 165 + radars * 42 : 0,
      fire: guns ? 1 / Math.max(0.34, 0.82 - guns * 0.08) + guns * 0.25 : 0,
      energy: BLOCKS.core.energy + batteries * BLOCKS.battery.energy,
      armor: armor * BLOCKS.armor.hp,
    };
  }

  function blockCounts(design) {
    return {
      wheel: design.blocks.filter((b) => b.type === "wheel").length,
      gun: design.blocks.filter((b) => b.type === "gun").length,
      radar: design.blocks.filter((b) => b.type === "radar").length,
      armor: design.blocks.filter((b) => b.type === "armor").length,
      battery: design.blocks.filter((b) => b.type === "battery").length,
    };
  }

  function chipAvailable(kind, id, design) {
    const meta = kind === "sensor" ? SENSOR_META[id] : ACTION_META[id];
    if (!meta) return { ok: false, need: "LOCKED" };
    const counts = blockCounts(design);
    if (meta.need === "radar" && counts.radar <= 0) return { ok: false, need: "Need Radar" };
    if (meta.need === "gun" && counts.gun <= 0) return { ok: false, need: "Need Gun" };
    if (meta.need === "wheel" && counts.wheel <= 0) return { ok: false, need: "Need Wheel" };
    return { ok: true, need: "" };
  }

  function programNodeAvailable(node, design = state.design) {
    if (node.kind === "logic") return { ok: true, need: "" };
    if (node.kind === "sensor") return chipAvailable("sensor", node.type, design);
    if (node.kind === "action") return chipAvailable("action", node.type, design);
    return { ok: false, need: "Locked" };
  }

  function programNodeSignal(node) {
    const bot = state.battle?.player;
    if (bot?.programValues && Object.prototype.hasOwnProperty.call(bot.programValues, node.id)) return !!bot.programValues[node.id];
    if (node.kind === "sensor") return !!state.battle?.player?.sensors?.[node.type];
    if (node.kind === "action") return !!state.battle?.player?.actions?.[node.type];
    return false;
  }

  function buildHints() {
    const c = blockCounts(state.design);
    const hints = [];
    if (!c.radar) hints.push("No Radar: cannot see.");
    if (!c.gun) hints.push("No Gun: cannot fire.");
    if (!c.wheel) hints.push("Low Wheels: slow bot.");
    if (!c.battery) hints.push("Low Energy: fewer shots.");
    const coreShielded = state.design.blocks.some((b) => b.type === "armor" && Math.abs(b.x - CORE) + Math.abs(b.y - CORE) === 1);
    if (!coreShielded) hints.push("Exposed Core: add Armor.");
    return hints.slice(0, 2);
  }

  function drawBuildHints(l) {
    const hints = buildHints();
    if (!hints.length) return;
    for (let i = 0; i < hints.length; i += 1) {
      text(hints[i], 18, l.hintY + i * 16, 10, "left", "#555");
    }
  }

  function drawBuildInspector(l) {
    const selected = state.design.blocks.find((b) => b.id === state.selectedBlockId);
    const type = selected?.type === "core" || !selected ? state.selectedBlockType : selected.type;
    if (!PART_INFO[type]) return;
    const info = PART_INFO[type];
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#d7d7d7";
    ctx.lineWidth = 1;
    roundRect(12, l.inspectorY, state.w - 24, 38, 12, true, true);
    drawBlockIcon(type, 36, l.inspectorY + 19, 24, selected?.rot || defaultRot(type));
    text(info.name, 58, l.inspectorY + 13, 12, "left");
    text(info.desc, 58, l.inspectorY + 28, 10, "left", "#555");
    text(info.stats.join(" + "), state.w - 20, l.inspectorY + 20, 9, "right", "#555");
  }

  function drawFloatingBlockTools(l) {
    const b = state.design.blocks.find((x) => x.id === state.selectedBlockId);
    if (!b || b.type === "core") return;
    const x = l.x + b.x * l.cell + l.cell / 2;
    const y = l.y + b.y * l.cell;
    const py = clamp(y - 42, 46, l.y + l.size - 40);
    const px = clamp(x - 58, 12, state.w - 128);
    button("Rotate", px, py, 58, 32, false, 10);
    button("Delete", px + 64, py, 58, 32, false, 10);
    addHit("rotate", px, py, 58, 32);
    addHit("delete", px + 64, py, 58, 32);
  }

  function drawProgram() {
    const p = state.design.program;
    text("Program", 16, 56, 15, "left");
    button("Fit", state.w - 184, 42, 48, 30, false, 10);
    button("Reset", state.w - 128, 42, 56, 30, false, 10);
    button("+", state.w - 62, 42, 46, 30, true, 16);
    addHit("programTool", state.w - 184, 42, 48, 30, { tool: "fit" });
    addHit("programTool", state.w - 128, 42, 56, 30, { tool: "reset" });
    addHit("programTool", state.w - 62, 42, 46, 30, { tool: "library" });
    drawProgramCanvas(p);
    drawProgramBottomBar();
    if (state.libraryOpen) drawNodeLibrary();
  }

  function drawProgramCanvas(program) {
    const area = programArea();
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();
    ctx.fillStyle = "#edf3f8";
    ctx.fillRect(area.x, area.y, area.w, area.h);
    drawProgramGrid(area, program.view);
    for (const w of program.wires) drawProgramWire(w, false);
    if (state.connectingPort) drawTempWire();
    for (const n of program.nodes) drawProgramNode(n);
    ctx.restore();
    ctx.strokeStyle = "#ccd8e4";
    ctx.lineWidth = 1;
    roundRect(area.x, area.y, area.w, area.h, 18, false, true);
  }

  function programArea() {
    return { x: 10, y: 84, w: state.w - 20, h: state.h - 164 };
  }

  function worldToScreen(wx, wy) {
    const v = state.design.program.view;
    const area = programArea();
    return {
      x: area.x + area.w / 2 + (wx + v.x) * v.zoom,
      y: area.y + area.h / 2 + (wy + v.y) * v.zoom,
    };
  }

  function screenToWorld(x, y) {
    const v = state.design.program.view;
    const area = programArea();
    return {
      x: (x - area.x - area.w / 2) / v.zoom - v.x,
      y: (y - area.y - area.h / 2) / v.zoom - v.y,
    };
  }

  function drawProgramGrid(area, view) {
    const step = Math.max(18, 64 * view.zoom);
    const ox = (area.x + area.w / 2 + view.x * view.zoom) % step;
    const oy = (area.y + area.h / 2 + view.y * view.zoom) % step;
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    for (let x = area.x + ox; x < area.x + area.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, area.y);
      ctx.lineTo(x, area.y + area.h);
      ctx.stroke();
    }
    for (let y = area.y + oy; y < area.y + area.h; y += step) {
      ctx.beginPath();
      ctx.moveTo(area.x, y);
      ctx.lineTo(area.x + area.w, y);
      ctx.stroke();
    }
  }

  function programNodeSize(node) {
    const ports = Math.max(1, programInputPorts(node).length);
    return { w: node.kind === "logic" ? 132 : 156, h: Math.max(76, 48 + ports * 22) };
  }

  function programNodeRect(node) {
    const p = worldToScreen(node.x, node.y);
    const s = programNodeSize(node);
    const z = state.design.program.view.zoom;
    return { x: p.x - (s.w * z) / 2, y: p.y - (s.h * z) / 2, w: s.w * z, h: s.h * z };
  }

  function drawProgramNode(node) {
    const r = programNodeRect(node);
    const z = state.design.program.view.zoom;
    const meta = programNodeMeta(node);
    const active = !!programNodeSignal(node);
    const disabled = !programNodeAvailable(node).ok;
    ctx.fillStyle = disabled ? "#eef0f3" : active ? "#f9ffe9" : "#ffffff";
    ctx.strokeStyle = active ? SIGNAL : meta.color;
    ctx.lineWidth = active ? 4 : state.selectedNodeId === node.id ? 3 : 2;
    ctx.shadowColor = "rgba(30,45,70,0.16)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    roundRect(r.x, r.y, r.w, r.h, 14 * z, true, true);
    ctx.shadowBlur = 0;
    ctx.fillStyle = disabled ? "#a5adb6" : meta.color;
    roundRect(r.x, r.y, r.w, 24 * z, 14 * z, true, false);
    text(meta.kindLabel, r.x + 10 * z, r.y + 12 * z, Math.max(7, 9 * z), "left", "#fff");
    text(meta.label, r.x + 14 * z, r.y + 45 * z, Math.max(10, 15 * z), "left", disabled ? "#8a93a0" : INK);
    text(meta.icon, r.x + r.w - 18 * z, r.y + 45 * z, Math.max(12, 18 * z), "center", disabled ? "#99a2ad" : meta.color);
    addHit("programNode", r.x, r.y, r.w, r.h, { nodeId: node.id });
    if (disabled) text(programNodeAvailable(node).need, r.x + 14 * z, r.y + r.h - 14 * z, Math.max(7, 9 * z), "left", DANGER);
    drawProgramPorts(node, r);
  }

  function programNodeMeta(node) {
    if (node.kind === "sensor") {
      const m = SENSOR_META[node.type] || { label: node.type, short: node.type };
      return { label: m.label, icon: sensorIcon(node.type), color: "#2d8cff", kindLabel: "SENSOR" };
    }
    if (node.kind === "logic") return { label: LOGIC_TYPES[node.type]?.label || node.type, icon: "◇", color: "#9b63ff", kindLabel: "LOGIC" };
    const m = ACTION_META[node.type] || { label: node.type, short: node.type };
    return { label: m.label, icon: actionIcon(node.type), color: "#ff9f2e", kindLabel: "ACTION" };
  }

  function sensorIcon(type) {
    if (type.includes("enemy")) return "◉";
    if (type.includes("gun")) return "⌖";
    if (type.includes("wall")) return "▦";
    if (type.includes("bullet")) return "!";
    return "●";
  }

  function actionIcon(type) {
    if (type.includes("fire")) return "➤";
    if (type.includes("aim")) return "⌖";
    if (type.includes("radar")) return "◜";
    if (type.includes("orbit")) return "↺";
    if (type.includes("turn")) return "↷";
    if (type.includes("move") || type === "stop") return "▸";
    return "◆";
  }

  function drawProgramPorts(node, r) {
    const z = state.design.program.view.zoom;
    const inputs = programInputPorts(node);
    for (let i = 0; i < inputs.length; i += 1) {
      const p = programPortScreen(node, inputs[i]);
      drawPortDot(p.x, p.y, "#4a5564", z);
      addHit("programPort", p.x - 14, p.y - 14, 28, 28, { nodeId: node.id, port: inputs[i], dir: "in" });
    }
    if (node.kind !== "action") {
      const p = programPortScreen(node, "out");
      drawPortDot(p.x, p.y, "#1c9b63", z);
      addHit("programPort", p.x - 14, p.y - 14, 28, 28, { nodeId: node.id, port: "out", dir: "out" });
    }
  }

  function drawPortDot(x, y, color, z) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, 2 * z);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(5, 7 * z), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function programPortScreen(node, port) {
    const r = programNodeRect(node);
    const inputs = programInputPorts(node);
    if (port === "out") return { x: r.x + r.w, y: r.y + r.h / 2 };
    const i = Math.max(0, inputs.indexOf(port));
    return { x: r.x, y: r.y + ((i + 1) * r.h) / (inputs.length + 1) };
  }

  function drawProgramWire(w, temp) {
    const program = state.design.program;
    const from = program.nodes.find((n) => n.id === w.fromNode);
    const to = program.nodes.find((n) => n.id === w.toNode);
    if (!from || !to) return;
    const a = programPortScreen(from, w.fromPort);
    const b = programPortScreen(to, w.toPort);
    const active = !!programNodeSignal(from);
    const selected = state.selectedProgramWireId === w.id;
    ctx.strokeStyle = temp ? "#6b7280" : selected ? "#ffcc4d" : active ? SIGNAL : "#7d8a99";
    ctx.lineWidth = temp ? 3 : selected ? 6 : active ? 5 : 3;
    ctx.beginPath();
    const dx = Math.max(80, Math.abs(b.x - a.x) * 0.45);
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(a.x + dx, a.y, b.x - dx, b.y, b.x, b.y);
    ctx.stroke();
    const hx = Math.min(a.x, b.x) - 10;
    const hy = Math.min(a.y, b.y) - 12;
    addHit("programWire", hx, hy, Math.abs(b.x - a.x) + 20, Math.abs(b.y - a.y) + 24, { wireId: w.id });
  }

  function drawTempWire() {
    const from = state.design.program.nodes.find((n) => n.id === state.connectingPort.nodeId);
    if (!from) return;
    const a = programPortScreen(from, state.connectingPort.port);
    const b = { x: state.pointer.lastX || a.x, y: state.pointer.lastY || a.y };
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(a.x + 80, a.y, b.x - 80, b.y, b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawProgramBottomBar() {
    const y = state.h - 68;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    roundRect(10, y - 8, state.w - 20, 60, 16, true, false);
    button("Build", 18, y, 70, 38, false, 11);
    button("Delete", 98, y, 76, 38, !!state.selectedProgramWireId || !!state.selectedNodeId, 11);
    button("Test", state.w - 92, y, 74, 38, true, 12);
    addHit("build", 18, y, 70, 38);
    addHit("programTool", 98, y, 76, 38, { tool: "delete" });
    addHit("fight", state.w - 92, y, 74, 38);
    const z = state.design.program.view.zoom;
    text(`${Math.round(z * 100)}%`, state.w / 2, y + 19, 11, "center", "#657386");
  }

  function drawNodeLibrary() {
    const w = Math.min(360, state.w - 24);
    const h = 250;
    const x = (state.w - w) / 2;
    const y = state.h - h - 76;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#c9d6e2";
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, 18, true, true);
    text("Node Library", x + 16, y + 24, 14, "left");
    const tabs = [["sensor", "Sensors"], ["logic", "Logic"], ["action", "Actions"]];
    let tx = x + 14;
    for (const [id, label] of tabs) {
      const on = state.libraryTab === id;
      ctx.fillStyle = on ? "#243b53" : "#eef3f8";
      ctx.strokeStyle = "transparent";
      roundRect(tx, y + 42, 88, 30, 12, true, false);
      text(label, tx + 44, y + 57, 10, "center", on ? "#fff" : "#4b5a6a");
      addHit("libraryTab", tx, y + 42, 88, 30, { tab: id });
      tx += 94;
    }
    const entries = libraryEntries(state.libraryTab);
    let px = x + 14;
    let py = y + 86;
    for (const item of entries) {
      const cardW = 104;
      const cardH = 46;
      if (px + cardW > x + w - 12) {
        px = x + 14;
        py += cardH + 10;
      }
      const available = item.kind === "logic" ? { ok: true } : programNodeAvailable({ kind: item.kind, type: item.type });
      const meta = programNodeMeta({ kind: item.kind, type: item.type });
      ctx.fillStyle = available.ok ? "#f8fbfd" : "#f0f1f3";
      ctx.strokeStyle = available.ok ? meta.color : "#c8ced6";
      ctx.lineWidth = 1;
      roundRect(px, py, cardW, cardH, 12, true, true);
      text(meta.icon, px + 18, py + 22, 16, "center", available.ok ? meta.color : "#999");
      text(meta.label.replace("Enemy ", ""), px + 36, py + 17, 9, "left", available.ok ? INK : "#999");
      text(available.ok ? meta.kindLabel : available.need, px + 36, py + 31, 7, "left", available.ok ? "#657386" : DANGER);
      addHit("libraryNode", px, py, cardW, cardH, { kindType: item.kind, type: item.type });
      px += cardW + 8;
    }
  }

  function libraryEntries(kind) {
    if (kind === "sensor") return Object.keys(SENSOR_META).map((type) => ({ kind: "sensor", type }));
    if (kind === "logic") return Object.keys(LOGIC_TYPES).map((type) => ({ kind: "logic", type }));
    return Object.keys(ACTION_META).map((type) => ({ kind: "action", type }));
  }

  function drawBrain() {
    const rules = state.design.brain.rules;
    text("Brain Builder", 16, 56, 15, "left");
    const conditionCount = rules.reduce((sum, r) => sum + r.conditions.length, 0);
    const actionCount = rules.reduce((sum, r) => sum + r.actions.length, 0);
    text(`${rules.length} Rules  ${conditionCount} Conditions  ${actionCount} Actions`, 16, 78, 10, "left", "#555");
    button("Test", state.w - 78, 44, 62, 30, true, 10);
    addHit("fight", state.w - 78, 44, 62, 30);

    const top = 94;
    const editorOpen = !!editingRule();
    const bottom = editorOpen ? state.h - 402 : state.h - 112;
    const cardH = Math.max(48, Math.min(62, Math.floor((bottom - top - 12) / Math.max(1, Math.min(8, rules.length)))));
    for (let i = 0; i < rules.length; i += 1) {
      const y = top + i * (cardH + 7);
      if (y + cardH > bottom) break;
      drawRuleCard(rules[i], 14, y, state.w - 28, cardH, state.battle?.player?.ruleStates?.[rules[i].id]);
    }
    button("+ Rule", 16, bottom + 12, 92, 38, false, 12);
    button("Build", state.w - 190, bottom + 12, 78, 38, false, 12);
    button("Test", state.w - 102, bottom + 12, 86, 38, true, 12);
    addHit("addRule", 16, bottom + 12, 92, 38);
    addHit("build", state.w - 190, bottom + 12, 78, 38);
    addHit("fight", state.w - 102, bottom + 12, 86, 38);
    if (editorOpen) drawRuleEditor(editingRule());
  }

  function drawRuleCard(r, x, y, w, h, active = false) {
    ctx.fillStyle = active ? INK : "#fff";
    ctx.strokeStyle = active ? INK : "#d0d0d0";
    ctx.lineWidth = state.editingRuleId === r.id ? 3 : 1;
    roundRect(x, y, w, h, 12, true, true);
    const ink = active ? PAPER : INK;
    const muted = active ? "#ddd" : "#777";
    text("WHEN", x + 12, y + 15, 8, "left", muted);
    drawInlineChips(r.conditions.map((c) => SENSOR_META[c.sensor]?.short || c.sensor), x + 58, y + 7, w - 70, active);
    text("DO", x + 12, y + h - 16, 8, "left", muted);
    drawInlineChips(r.actions.map((a) => ACTION_META[a.action]?.short || a.action), x + 58, y + h - 24, w - 70, active);
    if (!r.conditions.length || !r.actions.length) text("Incomplete", x + w - 12, y + h / 2, 9, "right", muted);
    addHit("rule", x, y, w, h, { id: r.id });
    ctx.fillStyle = ink;
  }

  function drawInlineChips(labels, x, y, maxW, inverse = false) {
    let px = x;
    const shown = labels.length ? labels : ["Empty"];
    for (const label of shown.slice(0, 4)) {
      const w = Math.min(74, Math.max(38, label.length * 6 + 16));
      if (px + w > x + maxW) {
        text("+", px + 8, y + 9, 10, "center", inverse ? PAPER : INK);
        break;
      }
      ctx.fillStyle = inverse ? PAPER : "#f3f3f3";
      ctx.strokeStyle = inverse ? PAPER : "#ddd";
      ctx.lineWidth = 1;
      roundRect(px, y, w, 18, 9, true, true);
      text(label, px + w / 2, y + 9, 8, "center", inverse ? INK : "#333");
      px += w + 5;
    }
  }

  function drawRuleEditor(r) {
    const h = 392;
    const y = state.h - h;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    roundRect(8, y, state.w - 16, h - 8, 16, true, true);
    text("Edit Rule", 22, y + 22, 14, "left");
    button("Done", state.w - 82, y + 10, 58, 30, true, 10);
    addHit("doneRule", state.w - 82, y + 10, 58, 30);
    text("WHEN", 22, y + 52, 9, "left", "#555");
    drawChipGroups("conditions", y + 64, r, 164);
    text("DO", 22, y + 230, 9, "left", "#555");
    drawChipGroups("actions", y + 242, r, 96);
    button("Delete Rule", 22, y + 348, 112, 30, false, 10);
    addHit("deleteRule", 22, y + 348, 112, 30);
  }

  function drawChipGroups(kind, y, r, maxH) {
    const groups = kind === "conditions" ? CONDITION_GROUPS : ACTION_GROUPS;
    const meta = kind === "conditions" ? SENSOR_META : ACTION_META;
    const hitKind = kind === "conditions" ? "toggleCondition" : "toggleAction";
    const selected = new Set((r[kind] || []).map((x) => kind === "conditions" ? x.sensor : x.action));
    let px = 22;
    let py = y;
    for (const group of groups) {
      const entries = Object.entries(meta).filter(([, v]) => v.category === group);
      if (!entries.length) continue;
      text(group, px, py + 8, 7, "left", "#999");
      px += 40;
      for (const [id, m] of entries) {
        const available = chipAvailable(kind === "conditions" ? "sensor" : "action", id, state.design);
        const on = selected.has(id);
        const w = Math.max(42, Math.min(76, m.short.length * 6 + 20));
        if (px + w > state.w - 20) {
          px = 22;
          py += 27;
        }
        ctx.fillStyle = on ? INK : available.ok ? "#f7f7f7" : "#eee";
        ctx.strokeStyle = on ? INK : "#d6d6d6";
        ctx.lineWidth = on ? 2 : 1;
        roundRect(px, py, w, 22, 11, true, true);
        text(m.short, px + w / 2, py + 11, 8, "center", on ? PAPER : available.ok ? INK : "#999");
        addHit(hitKind, px, py, w, 22, { id });
        px += w + 6;
      }
      px = 22;
      py += 30;
      if (py > y + maxH) break;
    }
  }

  function drawWire() {
    const l = wireLayout();
    text("ONE SCHEMATIC", 16, 54, 15, "left");
    drawWireColumns(l);
    drawWireLines(l);
    drawWireNodes(l);
    drawWireTools(l);
  }

  function wireLayout() {
    const top = 78;
    const colW = Math.floor((state.w - 38) / 3);
    return {
      top,
      nodeH: 27,
      gap: 7,
      colW,
      sensorX: 12,
      logicX: 19 + colW,
      actionX: 26 + colW * 2,
    };
  }

  function drawWireColumns(l) {
    text("SENSOR", l.sensorX + l.colW / 2, 61, 10, "center");
    text("LOGIC", l.logicX + l.colW / 2, 61, 10, "center");
    text("ACTION", l.actionX + l.colW / 2, 61, 10, "center");
  }

  function nodeRect(kind, id, l) {
    if (kind === "sensor") {
      const i = SENSORS.findIndex(([x]) => x === id);
      return { x: l.sensorX, y: l.top + i * (l.nodeH + l.gap), w: l.colW, h: l.nodeH };
    }
    if (kind === "action") {
      const i = ACTIONS.findIndex(([x]) => x === id);
      return { x: l.actionX, y: l.top + i * (l.nodeH + l.gap), w: l.colW, h: l.nodeH };
    }
    const i = state.design.schematic.logicNodes.findIndex((n) => n.id === id);
    return { x: l.logicX, y: l.top + i * (l.nodeH + l.gap), w: l.colW, h: l.nodeH };
  }

  function endpointPoint(ep, l) {
    if (ep.startsWith("sensor.")) {
      const id = ep.slice(7);
      const r = nodeRect("sensor", id, l);
      return { x: r.x + r.w, y: r.y + r.h / 2 };
    }
    if (ep.startsWith("action.")) {
      const id = ep.slice(7);
      const r = nodeRect("action", id, l);
      return { x: r.x, y: r.y + r.h / 2 };
    }
    const [id, port] = ep.split(".");
    const r = nodeRect("logic", id, l);
    if (port === "out") return { x: r.x + r.w, y: r.y + r.h / 2 };
    const input = Number((port || "in0").replace("in", "")) || 0;
    const node = state.design.schematic.logicNodes.find((n) => n.id === id);
    const n = Math.max(1, LOGIC_TYPES[node?.type]?.inputs || 1);
    return { x: r.x, y: r.y + ((input + 1) * r.h) / (n + 1) };
  }

  function drawWireLines(l) {
    const wires = state.design.schematic.wires;
    for (let i = 0; i < wires.length; i += 1) {
      const a = endpointPoint(wires[i].from, l);
      const b = endpointPoint(wires[i].to, l);
      const active = signalValue(wires[i].from);
      const selected = state.selectedWireIndex === i;
      ctx.strokeStyle = selected || active ? INK : "#999";
      ctx.lineWidth = selected ? 6 : active ? 5 : 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const mid = (a.x + b.x) / 2;
      ctx.bezierCurveTo(mid, a.y, mid, b.y, b.x, b.y);
      ctx.stroke();
      const hx = Math.min(a.x, b.x);
      const hy = Math.min(a.y, b.y) - 6;
      addHit("wireLine", hx, hy, Math.abs(b.x - a.x), Math.abs(b.y - a.y) + 12, { index: i });
    }
    if (state.wireFrom) {
      const p = endpointPoint(state.wireFrom, l);
      ctx.fillStyle = INK;
      ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
      text("TO?", state.w / 2, state.h - 26, 14, "center");
    } else if (state.selectedWireIndex != null) {
      text("WIRE SELECTED", state.w / 2, state.h - 26, 12, "center");
    }
  }

  function drawWireNodes(l) {
    for (const [id, label] of SENSORS) drawNodeBox(nodeRect("sensor", id, l), label, signalValue(`sensor.${id}`), "out", `sensor.${id}`);
    for (const node of state.design.schematic.logicNodes) {
      const r = nodeRect("logic", node.id, l);
      drawNodeBox(r, LOGIC_TYPES[node.type].label, signalValue(`${node.id}.out`), "both", node.id, LOGIC_TYPES[node.type].inputs, node.id === state.selectedLogicId);
      addHit("logic", r.x, r.y, r.w, r.h, { id: node.id });
    }
    for (const [id, label] of ACTIONS) drawNodeBox(nodeRect("action", id, l), label, false, "in", `action.${id}`);
  }

  function drawNodeBox(r, label, active, ports, endpoint, inputs = 1, selected = false) {
    ctx.fillStyle = active ? INK : PAPER;
    ctx.strokeStyle = selected ? INK : "#111";
    ctx.lineWidth = selected ? 4 : 2;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    text(label, r.x + r.w / 2, r.y + r.h / 2 + 1, 9, "center", active ? PAPER : INK);
    if (ports === "out" || ports === "both") {
      port(r.x + r.w, r.y + r.h / 2, "portOut", endpoint.includes(".") ? endpoint : `${endpoint}.out`);
    }
    if (ports === "in" || ports === "both") {
      const n = Math.max(1, inputs);
      for (let i = 0; i < n; i += 1) port(r.x, r.y + ((i + 1) * r.h) / (n + 1), "portIn", ports === "in" ? endpoint : `${endpoint}.in${i}`);
    }
  }

  function port(x, y, kind, endpoint) {
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    addHit(kind, x - 11, y - 11, 22, 22, { endpoint });
  }

  function drawWireTools(l) {
    const types = ["and", "or", "not", "timer", "random"];
    const bw = Math.floor((state.w - 28) / 6);
    const y = state.h - 50;
    let x = 8;
    for (const t of types) {
      button(`+${LOGIC_TYPES[t].label}`, x, y, bw, 38, false, 10);
      addHit("addLogic", x, y, bw, 38, { type: t });
      x += bw + 4;
    }
    button("DEL", x, y, bw, 38, false, 11);
    addHit("deleteLogic", x, y, bw, 38);
    button("FIGHT", state.w - 78, 42, 66, 28, true, 11);
    addHit("fight", state.w - 78, 42, 66, 28);
  }

  function signalValue(endpoint) {
    if (endpoint.startsWith("sensor.")) return !!state.battle?.player?.sensors?.[endpoint.slice(7)];
    return !!state.lastSignals?.[endpoint];
  }

  function drawFight() {
    const b = state.battle;
    if (!b) return;
    drawArena(b);
    drawBattleBot(b.player, b);
    drawBattleBot(b.enemy, b);
    drawBullets(b);
    drawParticles(b);
    drawFightHud(b);
    drawMiniCircuit(b);
  }

  function drawArena(b) {
    const ar = b.arena = fightArena();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(ar.x, ar.y, ar.w, ar.h);
    for (const o of b.obstacles) {
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = "#ddd";
      for (let x = o.x + 6; x < o.x + o.w - 4; x += 10) ctx.fillRect(x, o.y + 6, 5, 5);
    }
    for (let x = ar.x + 18; x < ar.x + ar.w; x += 28) {
      ctx.fillStyle = PALE;
      ctx.fillRect(x, ar.y + ar.h / 2, 8, 2);
    }
  }

  function drawBattleBot(bot, battle) {
    const scale = battleScale(battle);
    if (bot.stats.radars > 0) drawRadarCone(bot, battle);
    for (const bl of bot.blocks) {
      if (!bl.alive) continue;
      const p = blockWorld(bot, bl, scale);
      const rot = bot.bodyAngle + bl.rot * Math.PI / 2;
      drawBlockTop(bl.type, p.x, p.y, scale, rot, { flash: bl.flash, side: bot.side });
    }
    drawTurret(bot, battle);
  }

  function drawRadarCone(bot, battle) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.arc(bot.x, bot.y, Math.min(bot.radarRange, battle.arena.w * 0.62), bot.radarAngle - bot.radarFov, bot.radarAngle + bot.radarFov);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTurret(bot, battle) {
    const scale = battleScale(battle);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.lineTo(bot.x + Math.cos(bot.turretAngle) * scale * 2.1, bot.y + Math.sin(bot.turretAngle) * scale * 2.1);
    ctx.stroke();
    ctx.strokeStyle = bot.sensors.enemySeen ? INK : "#999";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y);
    ctx.lineTo(bot.x + Math.cos(bot.radarAngle) * scale * 2.5, bot.y + Math.sin(bot.radarAngle) * scale * 2.5);
    ctx.stroke();
  }

  function drawBullets(battle) {
    for (const bullet of battle.bullets) {
      ctx.strokeStyle = bullet.aimed ? INK : "#777";
      ctx.lineWidth = bullet.aimed ? 3 : 2;
      ctx.beginPath();
      for (let i = 0; i < bullet.trail.length; i += 1) {
        const p = bullet.trail[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(bullet.x - 3, bullet.y - 3, 6, 6);
    }
  }

  function drawParticles(battle) {
    ctx.fillStyle = INK;
    for (const p of battle.particles) ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  function drawFightHud(b) {
    text(`${state.design.name}`, 12, 50, 10, "left");
    text(`${b.enemy.design.name}`, state.w - 12, 50, 10, "right");
    hpBar(12, 62, 116, coreHp(b.player), BLOCKS.core.hp);
    hpBar(state.w - 128, 62, 116, coreHp(b.enemy), BLOCKS.core.hp);
    energyBar(12, 78, 116, b.player.energy, b.player.maxEnergy);
    text(`${Math.floor(Math.max(0, MAX_FIGHT - b.t))}`, state.w / 2, 54, 18, "center");
    const y = state.h - 46;
    button("Restart", 10, y, 78, 34, false, 11);
    button("Next", 96, y, 58, 34, false, 11);
    button("Build", state.w - 226, y, 64, 34, false, 11);
    button("Program", state.w - 166, y, 80, 34, false, 10);
    button("Share", state.w - 78, y, 68, 34, false, 11);
    addHit("restart", 10, y, 78, 34);
    addHit("nextEnemy", 96, y, 58, 34);
    addHit("build", state.w - 226, y, 64, 34);
    addHit("program", state.w - 166, y, 80, 34);
    addHit("share", state.w - 78, y, 68, 34);
    if (b.result) {
      const info = b.analysis || resultAnalysis(b);
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      const px = state.w / 2 - 126;
      const py = state.h * 0.28;
      ctx.fillRect(px, py, 252, 154);
      ctx.strokeRect(px, py, 252, 154);
      text(b.result, state.w / 2, py + 25, 30, "center");
      text(b.reason, state.w / 2, py + 51, 12, "center");
      text(`DMG ${info.damageDealt} / TAKEN ${info.damageTaken}`, state.w / 2, py + 76, 11, "center");
      text(`ACC ${info.accuracy}%  LOST ${info.blocksLost}  CORE ${info.coreHp}`, state.w / 2, py + 96, 11, "center");
      text(info.notes[0] || "", state.w / 2, py + 120, 13, "center");
      text(info.notes[1] || "", state.w / 2, py + 139, 13, "center");
    }
  }

  function hpBar(x, y, w, hp, max) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 9);
    ctx.fillStyle = INK;
    ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(hp / max, 0, 1), 5);
  }

  function energyBar(x, y, w, energy, max) {
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 7);
    ctx.fillStyle = "#777";
    ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(energy / Math.max(1, max), 0, 1), 3);
  }

  function drawMiniCircuit(b) {
    const x = 12;
    const y = state.h - 136;
    text("Signal Strip", x, y - 10, 10, "left", "#5c6d80");
    const items = [
      ["SEE", b.player.sensors.enemySeen],
      ["NEAR", b.player.sensors.enemyNear],
      ["FAR", b.player.sensors.enemyFar],
      ["LOCK", b.player.sensors.gunAligned],
      ["WALL", b.player.sensors.wallAhead],
      ["DODGE", b.player.sensors.bulletIncoming],
      ["AIM", b.player.actions.aimAtEnemy],
      ["FIRE", b.player.pulse.fire > 0 || b.player.actions.fire],
      ["ORB", b.player.actions.orbitLeft || b.player.actions.orbitRight],
      ["BACK", b.player.actions.moveBackward],
    ];
    let px = x;
    for (const [label, on] of items) {
      ctx.fillStyle = on ? INK : PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.fillRect(px, y, 35, 18);
      ctx.strokeRect(px, y, 35, 18);
      text(label, px + 17, y + 10, label.length > 4 ? 6 : 7, "center", on ? PAPER : INK);
      px += 37;
    }
    const activeNodes = state.design.program.nodes.filter((n) => b.player.programValues?.[n.id] && n.kind === "action").slice(0, 4);
    let rx = x;
    const ry = y + 28;
    if (!activeNodes.length) {
      text("No action signal", x, ry + 11, 9, "left", "#777");
    }
    for (const n of activeNodes) {
      const label = ACTION_META[n.type]?.short || n.type;
      ctx.fillStyle = "#ffb454";
      ctx.strokeStyle = "#de7b1f";
      ctx.lineWidth = 1;
      roundRect(rx, ry, 76, 25, 10, true, true);
      text(label, rx + 38, ry + 13, 9, "center", "#1b2430");
      rx += 82;
    }
    const pulses = [];
    if (b.player.pulse.enemySeen > 0) pulses.push("SEE");
    if (b.player.pulse.gunAligned > 0) pulses.push("LOCK");
    if (b.player.pulse.bulletIncoming > 0) pulses.push("DODGE");
    if (b.player.pulse.fire > 0) pulses.push("FIRE");
    if (pulses.length) {
      ctx.fillStyle = INK;
      ctx.fillRect(state.w / 2 - 52, 92, 104, 28);
      text(pulses[0], state.w / 2, 107, 16, "center", PAPER);
    }
  }

  function drawShare() {
    text("BOT CODE", 16, 58, 15, "left");
    text("Export your build + program. Import a rival.", 16, 86, 10, "left", "#555");
    if (state.opponent) text(`OPPONENT: ${state.opponent.name}`, 16, state.h - 110, 12, "left");
    button("FIGHT IMPORTED", 16, state.h - 72, state.w - 32, 42, true, 14);
    addHit("fightImported", 16, state.h - 72, state.w - 32, 42);
  }

  function drawBlockIcon(type, x, y, size, rot = 0, opt = {}) {
    drawBlockTop(type, x, y, size, rot * Math.PI / 2, opt);
  }

  function drawBlockTop(type, x, y, s, rot = 0, opt = {}) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    if (opt.ghost) ctx.globalAlpha = 0.28;
    const inverse = opt.inverse;
    const flash = opt.flash > 0;
    const info = PART_INFO[type] || PART_INFO.core;
    const base = inverse ? "#ffffff" : flash ? "#ffffff" : info.color;
    const dark = inverse ? "#ffffff" : info.dark;
    ctx.shadowColor = "rgba(20,30,45,0.18)";
    ctx.shadowBlur = opt.card ? 0 : 8;
    ctx.shadowOffsetY = opt.card ? 0 : 3;
    if (opt.selected) {
      ctx.strokeStyle = "#ffcc4d";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.66, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (type === "core") {
      ctx.fillStyle = base;
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(2, s / 11);
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = Math.PI / 6 + (Math.PI * 2 * i) / 6;
        const px = Math.cos(a) * s * 0.42;
        const py = Math.sin(a) * s * 0.42;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, s / 18);
      ctx.stroke();
    } else if (type === "wheel") {
      ctx.fillStyle = "#2f3c4d";
      ctx.strokeStyle = "#151b22";
      ctx.lineWidth = Math.max(2, s / 10);
      for (const ox of [-s * 0.24, s * 0.24]) {
        ctx.beginPath();
        ctx.arc(ox, 0, s * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(ox, 0, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2f3c4d";
      }
      ctx.fillStyle = base;
      roundRect(-s * 0.38, -s * 0.1, s * 0.76, s * 0.2, s * 0.08, true, false);
    } else if (type === "gun") {
      ctx.fillStyle = base;
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(2, s / 12);
      ctx.beginPath();
      ctx.arc(-s * 0.12, 0, s * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      roundRect(-s * 0.02, -s * 0.11, s * 0.58, s * 0.22, s * 0.08, true, true);
      ctx.fillStyle = dark;
      roundRect(s * 0.42, -s * 0.16, s * 0.18, s * 0.32, s * 0.04, true, false);
    } else if (type === "radar") {
      ctx.fillStyle = "rgba(72,198,217,0.22)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, s * 0.56, -0.55, 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = base;
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(2, s / 13);
      ctx.beginPath();
      ctx.arc(-s * 0.05, 0, s * 0.22, -1.2, 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-s * 0.05, 0, s * 0.34, -1.0, 1.0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-s * 0.08, 0, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (type === "armor") {
      ctx.fillStyle = base;
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(2, s / 12);
      ctx.beginPath();
      ctx.moveTo(-s * 0.38, -s * 0.32);
      ctx.lineTo(s * 0.3, -s * 0.42);
      ctx.lineTo(s * 0.42, 0);
      ctx.lineTo(s * 0.3, s * 0.42);
      ctx.lineTo(-s * 0.38, s * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#dce6ef";
      ctx.lineWidth = Math.max(1, s / 18);
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, -s * 0.25);
      ctx.lineTo(s * 0.19, -s * 0.29);
      ctx.moveTo(-s * 0.18, 0);
      ctx.lineTo(s * 0.25, 0);
      ctx.moveTo(-s * 0.18, s * 0.25);
      ctx.lineTo(s * 0.19, s * 0.29);
      ctx.stroke();
    } else if (type === "battery") {
      ctx.fillStyle = base;
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(2, s / 12);
      roundRect(-s * 0.28, -s * 0.38, s * 0.56, s * 0.76, s * 0.11, true, true);
      ctx.fillStyle = dark;
      roundRect(-s * 0.13, -s * 0.49, s * 0.26, s * 0.12, s * 0.04, true, false);
      ctx.fillStyle = "#ddffe2";
      roundRect(-s * 0.17, -s * 0.2, s * 0.34, s * 0.13, s * 0.03, true, false);
      roundRect(-s * 0.17, s * 0.03, s * 0.34, s * 0.13, s * 0.03, true, false);
    }
    ctx.restore();
  }

  function button(label, x, y, w, h, active = false, size = 12) {
    ctx.fillStyle = active ? ACCENT : PANEL;
    ctx.strokeStyle = active ? "#3149b5" : "#cbd7e4";
    ctx.lineWidth = active ? 2 : 1;
    roundRect(x, y, w, h, 10, true, true);
    text(label, x + w / 2, y + h / 2 + 1, size, "center", active ? "#fff" : INK);
  }

  function roundRect(x, y, w, h, r, fill = true, stroke = false) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function addHit(kind, x, y, w, h, data = {}) {
    state.hits.push({ kind, x, y, w, h, ...data });
  }

  function text(value, x, y, size, align = "left", color = INK) {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), Math.round(x), Math.round(y));
  }

  function exportCode(design) {
    const normalized = normalizeDesign(design);
    const clean = {
      version: 3,
      name: normalized.name,
      blocks: normalized.blocks.map((b) => ({ id: b.id, type: b.type, x: b.x, y: b.y, rot: b.rot })),
      program: normalized.program,
    };
    const json = JSON.stringify(clean);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return PREFIX + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function importCode(code) {
    const trimmed = String(code || "").trim();
    const prefix = trimmed.startsWith(PREFIX) ? PREFIX : OLD_PREFIXES.find((p) => trimmed.startsWith(p)) || "";
    if (!prefix) throw new Error("BAD PREFIX");
    let b64 = trimmed.slice(prefix.length).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if (raw.version !== 1 && raw.version !== 2 && raw.version !== 3) throw new Error("BAD VERSION");
    if (prefix !== PREFIX && !raw.program) raw.program = defaultProgram();
    return validateImportedDesign(raw);
  }

  function validateImportedDesign(raw) {
    if (!raw || typeof raw !== "object") throw new Error("BAD JSON");
    if (!Array.isArray(raw.blocks) || raw.blocks.length > MAX_BLOCKS) throw new Error("BAD BLOCKS");
    if (raw.schematic && (!Array.isArray(raw.schematic.logicNodes) || !Array.isArray(raw.schematic.wires))) throw new Error("BAD SCHEMATIC");
    if (raw.schematic && (raw.schematic.logicNodes.length > MAX_LOGIC || raw.schematic.wires.length > MAX_WIRES)) throw new Error("TOO MANY NODES");
    if (raw.program?.nodes && raw.program.nodes.length > MAX_NODES) throw new Error("TOO MANY NODES");
    if (raw.program?.wires && raw.program.wires.length > MAX_WIRES) throw new Error("TOO MANY WIRES");
    return normalizeDesign(raw);
  }

  function makeShareLayer() {
    const layer = document.createElement("div");
    layer.id = "share-ui";
    layer.innerHTML = `
      <label>EXPORT</label>
      <textarea id="export-code" readonly spellcheck="false"></textarea>
      <button id="copy-code" type="button">COPY</button>
      <label>IMPORT</label>
      <textarea id="import-code" spellcheck="false" placeholder="CBA3:..."></textarea>
      <button id="import-code-btn" type="button">IMPORT AS OPPONENT</button>
      <div id="share-message"></div>
    `;
    document.body.appendChild(layer);
    layer.querySelector("#copy-code").addEventListener("click", async () => {
      const value = layer.querySelector("#export-code").value;
      try {
        await navigator.clipboard.writeText(value);
        shareMessage("COPIED");
      } catch {
        layer.querySelector("#export-code").select();
        shareMessage("SELECTED");
      }
    });
    layer.querySelector("#import-code-btn").addEventListener("click", () => {
      try {
        const design = importCode(layer.querySelector("#import-code").value);
        saveOpponent(design);
        state.fightOpponent = state.opponent;
        shareMessage("IMPORTED");
      } catch (error) {
        shareMessage("INVALID CODE");
      }
    });
    return layer;
  }

  function positionShareLayer() {
    const rect = canvas.getBoundingClientRect();
    shareLayer.style.left = `${rect.left + rect.width / 2}px`;
    shareLayer.style.top = `${rect.top + 104}px`;
    shareLayer.style.width = `${Math.min(rect.width - 30, 520)}px`;
  }

  function syncShareLayer() {
    if (state.mode !== "share") {
      shareLayer.style.display = "none";
      return;
    }
    shareLayer.style.display = "block";
    const out = shareLayer.querySelector("#export-code");
    if (document.activeElement !== out) out.value = state.exportText;
    positionShareLayer();
  }

  function shareMessage(value) {
    const el = shareLayer.querySelector("#share-message");
    el.textContent = value;
    setTimeout(() => {
      if (el.textContent === value) el.textContent = "";
    }, 1600);
  }

  function toast(value) {
    state.toast = value;
    state.toastT = 0.9;
  }

  function frame(now) {
    if (!frame.last) frame.last = now;
    const dt = Math.min(0.05, (now - frame.last) / 1000);
    frame.last = now;
    if (state.toastT > 0) state.toastT -= dt;
    if (state.mode === "fight") updateFight(dt);
    draw();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rand01(n) {
    const x = Math.sin(n * 999.13) * 43758.5453;
    return x - Math.floor(x);
  }

  function normAngle(a) {
    while (a <= -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    return a;
  }

  function angleDiff(a, b) {
    return normAngle(a - b);
  }

  function approachAngle(current, target, step) {
    const d = angleDiff(target, current);
    if (Math.abs(d) <= step) return target;
    return normAngle(current + Math.sign(d) * step);
  }

  function hashString(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
})();

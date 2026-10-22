/**
 * Zombies3D — Undead Survival Game Engine
 * Call of Duty Zombies-inspired 3D FPS built with Three.js and Web Audio API.
 * 100% offline, zero server required.
 */

(function () {
  "use strict";

  // Check Three.js
  if (typeof THREE === "undefined") {
    alert("Three.js library is not loaded. Please verify lib/three.min.js.");
    return;
  }

  // Canvas & Dimensions
  const canvas = document.getElementById("gameCanvas");
  let width = window.innerWidth;
  let height = window.innerHeight;

  // DOM HUD Elements
  const blocker = document.getElementById("blocker");
  const startBtn = document.getElementById("startBtn");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const restartBtn = document.getElementById("restartBtn");
  const roundNumEl = document.getElementById("roundNum");
  const pointsValEl = document.getElementById("pointsVal");
  const weaponNameEl = document.getElementById("weaponName");
  const ammoMagEl = document.getElementById("ammoMag");
  const ammoReserveEl = document.getElementById("ammoReserve");
  const healthBarFill = document.getElementById("healthBarFill");
  const perksContainer = document.getElementById("perksContainer");
  const hitmarkerEl = document.getElementById("hitmarker");
  const damageVignette = document.getElementById("damageVignette");
  const centerPrompt = document.getElementById("centerPrompt");

  // Game Stats
  const statRounds = document.getElementById("statRounds");
  const statKills = document.getElementById("statKills");
  const statHeadshots = document.getElementById("statHeadshots");
  const statPoints = document.getElementById("statPoints");

  // Web Audio Context & Procedural Synthesizer
  let audioCtx = null;
  let lowHealthHeartbeatTimer = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    if (type === "pistol") {
      // Crisp noise burst + pitch dive
      const bufferSize = audioCtx.sampleRate * 0.15;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(1.0, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start(now);
    } else if (type === "shotgun") {
      // Boom noise + low sub
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
      oscGain.gain.setValueAtTime(1.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "rifle") {
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
      oscGain.gain.setValueAtTime(0.8, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "hit") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "headshot") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.12);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === "reload") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(900, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "hurt") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
      gain.gain.setValueAtTime(1.0, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "heartbeat") {
      // Two low, filtered thumps form a short procedural heartbeat, with no audio asset dependency.
      [0, 0.19].forEach((offset, index) => {
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(index ? 47 : 58, now + offset);
        osc.frequency.exponentialRampToValueAtTime(index ? 34 : 38, now + offset + 0.16);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(105, now + offset);
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.exponentialRampToValueAtTime(index ? 0.075 : 0.11, now + offset + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.19);
      });
    } else if (type === "round") {
      // Eerie brass sting
      [220, 261.63, 311.13, 440].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.3, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.6);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.6);
      });
    } else if (type === "buy") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "raygun") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "powerup") {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.4, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } else if (type === "nuke") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 1.2);
      gain.gain.setValueAtTime(1.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    } else if (type === "mysterybox") {
      [330, 392, 493.88, 587.33, 659.25].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.3, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.06 + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.2);
      });
    }
  }

  // Three.js Core Engine Setup
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0c0b0a, 0.035);

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.rotation.order = "YXZ";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x2a2826, 0.6);
  scene.add(ambientLight);

  // Red emergency beacon
  const redLight = new THREE.PointLight(0xef4444, 2.5, 25);
  redLight.position.set(0, 5, 0);
  scene.add(redLight);

  // Four corner wall lamps
  const lampPositions = [
    [-18, 4.5, -18],
    [18, 4.5, -18],
    [-18, 4.5, 18],
    [18, 4.5, 18]
  ];
  lampPositions.forEach(([x, y, z]) => {
    const lamp = new THREE.PointLight(0xf59e0b, 1.8, 20);
    lamp.position.set(x, y, z);
    scene.add(lamp);

    // Lamp fixture mesh
    const fixGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4);
    const fixMat = new THREE.MeshBasicMaterial({ color: 0xffbb44 });
    const fixMesh = new THREE.Mesh(fixGeo, fixMat);
    fixMesh.position.set(x, y, z);
    scene.add(fixMesh);
  });

  // Procedural Concrete Texture for Floor
  function createConcreteTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1c1b19";
    ctx.fillRect(0, 0, 512, 512);
    // Grid seams
    ctx.strokeStyle = "#121110";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 512, 512);
    // Speckle noise & concrete aggregate
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.08)";
      ctx.fillRect(x, y, Math.random() * 3 + 1, Math.random() * 3 + 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    return texture;
  }

  // Procedural Bunker Wall Texture
  function createBunkerWallTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#262421";
    ctx.fillRect(0, 0, 512, 512);
    // Horizontal mortar courses
    ctx.strokeStyle = "#161513";
    ctx.lineWidth = 6;
    for (let y = 64; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
      const offset = (y / 64) % 2 === 0 ? 0 : 64;
      for (let x = offset; x < 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, y - 64);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
    // Concrete weathering
    for (let i = 0; i < 35; i++) {
      const x = Math.random() * 512;
      const h = Math.random() * 220 + 40;
      const grad = ctx.createLinearGradient(x, 0, x, h);
      grad.addColorStop(0, "rgba(0,0,0,0.22)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, Math.random() * 12 + 4, h);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 2);
    return texture;
  }

  // Procedural Hazard Warning Stripes Texture
  function createHazardTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#eab308";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#18181b";
    ctx.beginPath();
    for (let i = -256; i < 512; i += 64) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 32, 0);
      ctx.lineTo(i + 32 + 256, 256);
      ctx.lineTo(i + 256, 256);
      ctx.closePath();
    }
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    return texture;
  }

  // Procedural Military Supply Crate Texture
  function createCrateTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#3e3223";
    ctx.fillRect(0, 0, 256, 256);
    // Wood plank seams
    ctx.strokeStyle = "#251d14";
    ctx.lineWidth = 4;
    for (let y = 64; y < 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    // Iron corner reinforcement braces
    ctx.fillStyle = "#1c1b18";
    ctx.fillRect(0, 0, 36, 36);
    ctx.fillRect(220, 0, 36, 36);
    ctx.fillRect(0, 220, 36, 36);
    ctx.fillRect(220, 220, 36, 36);
    // Stencil text
    ctx.fillStyle = "rgba(220, 200, 160, 0.45)";
    ctx.font = "bold 22px monospace";
    ctx.fillText("SUPPLY", 78, 136);
    return new THREE.CanvasTexture(canvas);
  }

  // Procedural Zombie Rotting Skin Texture
  let zombieSkinTexture = null;
  function getZombieSkinTexture() {
    if (!zombieSkinTexture) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#4a5342";
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        ctx.fillStyle = Math.random() > 0.6 ? "rgba(20, 25, 18, 0.3)" : "rgba(80, 40, 40, 0.25)";
        ctx.fillRect(x, y, Math.random() * 6 + 2, Math.random() * 6 + 2);
      }
      zombieSkinTexture = new THREE.CanvasTexture(canvas);
    }
    return zombieSkinTexture;
  }

  // Procedural Zombie Shirt Texture
  let zombieShirtTexture = null;
  function getZombieShirtTexture() {
    if (!zombieShirtTexture) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#2d2a28";
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 24; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        ctx.fillStyle = "rgba(130, 20, 20, 0.5)";
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 8 + 3, 0, Math.PI * 2);
        ctx.fill();
      }
      zombieShirtTexture = new THREE.CanvasTexture(canvas);
    }
    return zombieShirtTexture;
  }

  // Arena Geometry: Bunker 50x50m
  const floorGeo = new THREE.PlaneGeometry(50, 50);
  const floorMat = new THREE.MeshLambertMaterial({ map: createConcreteTexture() });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling
  const ceilGeo = new THREE.PlaneGeometry(50, 50);
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0x141312 });
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 6;
  scene.add(ceiling);

  // Outer Walls with procedural concrete block textures
  const wallMat = new THREE.MeshLambertMaterial({ map: createBunkerWallTexture() });
  const wallHeight = 6;
  const wallHalf = 25;

  const walls = [
    { pos: [-13.5, wallHeight / 2, -wallHalf], size: [22, wallHeight, 1] },
    { pos: [13.5, wallHeight / 2, -wallHalf], size: [22, wallHeight, 1] },
    { pos: [-13.5, wallHeight / 2, wallHalf], size: [22, wallHeight, 1] },
    { pos: [13.5, wallHeight / 2, wallHalf], size: [22, wallHeight, 1] },
    { pos: [-wallHalf, wallHeight / 2, -13.5], size: [1, wallHeight, 22] },
    { pos: [-wallHalf, wallHeight / 2, 13.5], size: [1, wallHeight, 22] },
    { pos: [wallHalf, wallHeight / 2, -13.5], size: [1, wallHeight, 22] },
    { pos: [wallHalf, wallHeight / 2, 13.5], size: [1, wallHeight, 22] }
  ];

  walls.forEach(({ pos, size }) => {
    const geo = new THREE.BoxGeometry(...size);
    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set(...pos);
    scene.add(wall);
  });

  // Connected Mystery Box annex beyond the eastern passage. Its only doorway
  // is the already-open central bay; the buyable debris seals that threshold.
  const annexFloor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
  annexFloor.rotation.x = -Math.PI / 2;
  annexFloor.position.x = 40;
  annexFloor.receiveShadow = true;
  scene.add(annexFloor);
  const annexCeiling = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), ceilMat);
  annexCeiling.rotation.x = Math.PI / 2;
  annexCeiling.position.set(40, 6, 0);
  scene.add(annexCeiling);
  const annexWalls = [
    { pos: [40, wallHeight / 2, -15], size: [30, wallHeight, 1] },
    { pos: [40, wallHeight / 2, 15], size: [30, wallHeight, 1] },
    { pos: [55, wallHeight / 2, -8.75], size: [1, wallHeight, 12.5] },
    { pos: [55, wallHeight / 2, 8.75], size: [1, wallHeight, 12.5] }
  ];
  annexWalls.forEach(({ pos, size }) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...size), wallMat);
    wall.position.set(...pos);
    scene.add(wall);
  });
  const annexLamp = new THREE.PointLight(0x60a5fa, 1.4, 24);
  annexLamp.position.set(42, 4.5, 0);
  scene.add(annexLamp);

  // Pillars & Obstacles with hazard warning bands
  const obstacles = [];
  const pillarGeo = new THREE.BoxGeometry(3, wallHeight, 3);
  const pillarMat = new THREE.MeshLambertMaterial({ map: createHazardTexture() });

  const pillarCoords = [
    [-10, -10],
    [10, -10],
    [-10, 10],
    [10, 10]
  ];

  pillarCoords.forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, wallHeight / 2, pz);
    scene.add(pillar);
    obstacles.push({ x: px, z: pz, radius: 2.2 });
  });

  // Crates / Cover with wooden plank & iron bracket textures
  const crateGeo = new THREE.BoxGeometry(2, 1.6, 2);
  const crateMat = new THREE.MeshLambertMaterial({ map: createCrateTexture() });
  const crateCoords = [
    [-3, -15],
    [5, -15],
    [-14, 2],
    [15, -4],
    [4, 16]
  ];
  crateCoords.forEach(([cx, cz]) => {
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(cx, 0.8, cz);
    scene.add(crate);
    obstacles.push({ x: cx, z: cz, radius: 1.5 });
  });

  // A purchasable debris pile seals the passage into the Mystery Box annex.
  const debrisGroup = new THREE.Group();
  debrisGroup.position.set(27.5, 0, 0);
  const debrisMat = new THREE.MeshLambertMaterial({ color: 0x58544d, roughness: 1 });
  [[-1.1, 0.5, 0.1, 2.2, 1, 1.2], [0.5, 0.9, -0.2, 1.5, 1.8, 1.4], [1.4, 0.35, 0.3, 1.4, 0.7, 1.1], [-0.1, 1.45, 0.2, 1.6, 0.55, 1]].forEach(([x, y, z, w, h, d]) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), debrisMat);
    rock.scale.set(w / 2, h / 2, d / 2);
    rock.position.set(x, y, z);
    debrisGroup.add(rock);
  });
  scene.add(debrisGroup);
  const debrisObstacle = { x: 27.5, z: 0, radius: 2.7 };
  obstacles.push(debrisObstacle);
  const debrisBarrier = { group: debrisGroup, obstacle: debrisObstacle, cost: 1000, purchased: false, pos: new THREE.Vector3(27.5, 1.5, 0) };

  // Wall Buys & Perks Setup
  const wallBuys = [
    {
      id: "shotgun",
      name: "Trench Shotgun",
      weaponId: 1,
      cost: 500,
      ammoCost: 250,
      pos: new THREE.Vector3(0, 2, -24.4),
      color: 0x10b981
    },
    {
      id: "rifle",
      name: "Assault Rifle",
      weaponId: 2,
      cost: 1200,
      ammoCost: 600,
      pos: new THREE.Vector3(40, 2, -14.4),
      color: 0x3b82f6
    },
    {
      id: "juggernog",
      name: "Juggernog (250 HP)",
      isPerk: true,
      perkType: "juggernog",
      cost: 2500,
      pos: new THREE.Vector3(-24.4, 1.8, 0),
      color: 0xef4444
    },
    {
      id: "speedcola",
      name: "Speed Cola (Fast Reload)",
      isPerk: true,
      perkType: "speedcola",
      cost: 3000,
      pos: new THREE.Vector3(0, 1.8, 24.4),
      color: 0x10b981
    }
  ];

  // Visual Wall Buy Chalk Outlines / Boxes
  wallBuys.forEach((wb) => {
    const boxGeo = new THREE.BoxGeometry(2.4, 1.2, 0.2);
    const boxMat = new THREE.MeshBasicMaterial({ color: wb.color, wireframe: true });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.position.copy(wb.pos);
    if (wb.pos.x !== 0) boxMesh.rotation.y = Math.PI / 2;
    scene.add(boxMesh);
  });

  // Weapon Definitions
  const WEAPONS = [
    {
      id: 0,
      name: "M1911 PISTOL",
      damage: 35,
      magSize: 8,
      mag: 8,
      reserve: 48,
      maxReserve: 96,
      fireRate: 220, // ms
      reloadTime: 1200, // ms
      isAuto: false,
      pellets: 1,
      sound: "pistol"
    },
    {
      id: 1,
      name: "TRENCH SHOTGUN",
      damage: 25,
      magSize: 6,
      mag: 6,
      reserve: 30,
      maxReserve: 60,
      fireRate: 750,
      reloadTime: 1800,
      isAuto: false,
      pellets: 6,
      spread: 0.05,
      sound: "shotgun"
    },
    {
      id: 2,
      name: "ASSAULT RIFLE",
      damage: 45,
      magSize: 30,
      mag: 30,
      reserve: 120,
      maxReserve: 240,
      fireRate: 110,
      reloadTime: 1500,
      isAuto: true,
      pellets: 1,
      sound: "rifle"
    },
    {
      id: 3,
      name: "RAY GUN",
      damage: 300,
      magSize: 20,
      mag: 20,
      reserve: 160,
      maxReserve: 160,
      fireRate: 200,
      reloadTime: 2000,
      isAuto: false,
      pellets: 1,
      sound: "raygun"
    },
    {
      id: 4,
      name: "HEAVY MACHINE GUN",
      damage: 55,
      magSize: 60,
      mag: 60,
      reserve: 300,
      maxReserve: 300,
      fireRate: 90,
      reloadTime: 2800,
      isAuto: true,
      pellets: 1,
      sound: "rifle"
    }
  ];

  // Player State
  const player = {
    pos: new THREE.Vector3(0, 1.7, 0),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    health: 100,
    maxHealth: 100,
    hasJuggernog: false,
    hasSpeedCola: false,
    instaKillUntil: 0,
    doublePointsUntil: 0,
    points: 500,
    inventory: [0], // weapons owned
    currentWeaponIdx: 0,
    isReloading: false,
    lastShotTime: 0,
    lastHitTime: 0,
    kills: 0,
    headshots: 0,
    totalPointsEarned: 500
  };

  // Mystery Box State & 3D Model
  const mysteryBox = {
    pos: new THREE.Vector3(45, 0, 0),
    cost: 950,
    isSpinning: false,
    offeredWeaponId: null,
    offerExpiresAt: 0,
    spinUntil: 0,
    lastSpinTick: 0,
    tempWeaponId: 0,
    lidMesh: null,
    light: null
  };

  const boxGroup = new THREE.Group();
  boxGroup.position.copy(mysteryBox.pos);
  const boxBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.9, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85, metalness: 0.2 })
  );
  boxBase.position.y = 0.45;
  boxGroup.add(boxBase);

  const boxLid = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.25, 1.35),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
  );
  boxLid.position.y = 0.95;
  boxGroup.add(boxLid);
  mysteryBox.lidMesh = boxLid;

  const qMark1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.05, 0.35),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  qMark1.position.set(-0.5, 1.1, 0);
  boxGroup.add(qMark1);
  const qMark2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.05, 0.35),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  qMark2.position.set(0.5, 1.1, 0);
  boxGroup.add(qMark2);

  const boxLight = new THREE.PointLight(0x38bdf8, 0, 8);
  boxLight.position.set(0, 1.2, 0);
  boxGroup.add(boxLight);
  mysteryBox.light = boxLight;

  scene.add(boxGroup);
  obstacles.push({ x: mysteryBox.pos.x, z: mysteryBox.pos.z, radius: 1.6 });

  // Power-Ups System
  const powerupTypes = [
    { type: "MAX AMMO", color: 0x10b981, label: "MAX AMMO!" },
    { type: "INSTA-KILL", color: 0xef4444, label: "INSTA-KILL!" },
    { type: "NUKE", color: 0xf59e0b, label: "KABOOM!" },
    { type: "DOUBLE POINTS", color: 0xfacc15, label: "DOUBLE POINTS!" }
  ];
  let powerupsAlive = [];

  function spawnPowerUp(pos) {
    const pType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    const pGroup = new THREE.Group();
    pGroup.position.set(pos.x, 1.0, pos.z);

    const geo = new THREE.OctahedronGeometry(0.45);
    const mat = new THREE.MeshStandardMaterial({
      color: pType.color,
      emissive: pType.color,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    pGroup.add(mesh);

    const ringGeo = new THREE.TorusGeometry(0.65, 0.04, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: pType.color, wireframe: true });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    pGroup.add(ringMesh);

    const pLight = new THREE.PointLight(pType.color, 1.5, 6);
    pGroup.add(pLight);

    scene.add(pGroup);

    powerupsAlive.push({
      type: pType.type,
      label: pType.label,
      group: pGroup,
      spawnTime: performance.now(),
      expiresAt: performance.now() + 30000
    });
  }

  function showPowerupBanner(text) {
    const el = document.getElementById("powerupAnnouncer");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden");
    el.style.animation = "none";
    el.offsetHeight; // trigger reflow
    el.style.animation = "powerupPop 2.0s ease-out forwards";
    setTimeout(() => {
      el.classList.add("hidden");
    }, 2000);
  }

  function updatePowerups(dt, now) {
    for (let i = powerupsAlive.length - 1; i >= 0; i--) {
      const p = powerupsAlive[i];
      p.group.rotation.y += dt * 2.5;
      p.group.position.y = 1.0 + Math.sin(now * 0.004) * 0.15;

      const timeLeft = (p.expiresAt - now) / 1000;
      if (timeLeft <= 0) {
        scene.remove(p.group);
        powerupsAlive.splice(i, 1);
        continue;
      }

      if (timeLeft < 6) {
        p.group.visible = Math.floor(now / 150) % 2 === 0;
      } else {
        p.group.visible = true;
      }

      const dist = Math.hypot(player.pos.x - p.group.position.x, player.pos.z - p.group.position.z);
      if (dist < 2.0) {
        scene.remove(p.group);
        powerupsAlive.splice(i, 1);
        playSound("powerup");
        showPowerupBanner(p.label);

        if (p.type === "MAX AMMO") {
          WEAPONS.forEach((w) => {
            w.reserve = w.maxReserve;
          });
          updateWeaponHUD();
        } else if (p.type === "INSTA-KILL") {
          player.instaKillUntil = now + 30000;
          updateActivePowerupsHUD();
        } else if (p.type === "NUKE") {
          playSound("nuke");
          damageVignette.style.boxShadow = "inset 0 0 200px 100px rgba(255, 255, 255, 0.9)";
          setTimeout(() => { damageVignette.style.boxShadow = ""; }, 350);

          const toKill = [...zombiesAlive];
          toKill.forEach((z) => killZombie(z, false));
          addPoints(400);
        } else if (p.type === "DOUBLE POINTS") {
          player.doublePointsUntil = now + 30000;
          updateActivePowerupsHUD();
        }
      }
    }
  }

  function updateActivePowerupsHUD() {
    const container = document.getElementById("activePowerups");
    if (!container) return;
    const now = performance.now();
    let html = "";
    if (player.instaKillUntil > now) {
      const sec = Math.ceil((player.instaKillUntil - now) / 1000);
      html += `<span class="active-powerup-badge instakill">💀 INSTA-KILL (${sec}s)</span>`;
    }
    if (player.doublePointsUntil > now) {
      const sec = Math.ceil((player.doublePointsUntil - now) / 1000);
      html += `<span class="active-powerup-badge doublepoints">2X POINTS (${sec}s)</span>`;
    }
    container.innerHTML = html;
  }

  // 3D Gun Viewmodel attached to Camera
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0.25, -0.22, -0.45);
  camera.add(gunGroup);
  scene.add(camera);

  // Detailed 3D Gun Viewmodels
  function buildViewModel(weaponIndex) {
    while (gunGroup.children.length > 0) {
      gunGroup.remove(gunGroup.children[0]);
    }

    const darkMetalMat = new THREE.MeshLambertMaterial({ color: 0x1f2024 });
    const woodGripMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0x8e8e93 });

    if (weaponIndex === 0) {
      // M1911 Pistol
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.34), darkMetalMat);
      slide.position.set(0, 0.04, -0.05);
      gunGroup.add(slide);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.1), woodGripMat);
      grip.position.set(0, -0.08, 0.06);
      grip.rotation.x = 0.25;
      gunGroup.add(grip);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.06), darkMetalMat);
      guard.position.set(0, -0.04, 0.01);
      gunGroup.add(guard);
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.02), chromeMat);
      sight.position.set(0, 0.09, -0.2);
      gunGroup.add(sight);
    } else if (weaponIndex === 1) {
      // Trench Shotgun
      const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65), darkMetalMat);
      barrel1.rotation.x = Math.PI / 2;
      barrel1.position.set(-0.02, 0.03, -0.2);
      gunGroup.add(barrel1);
      const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65), darkMetalMat);
      barrel2.rotation.x = Math.PI / 2;
      barrel2.position.set(0.02, 0.03, -0.2);
      gunGroup.add(barrel2);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.2), woodGripMat);
      pump.position.set(0, -0.01, -0.2);
      gunGroup.add(pump);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.35), woodGripMat);
      stock.position.set(0, -0.05, 0.2);
      gunGroup.add(stock);
    } else if (weaponIndex === 2) {
      // Assault Rifle
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.45), darkMetalMat);
      receiver.position.set(0, 0.02, -0.05);
      gunGroup.add(receiver);
      const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45), darkMetalMat);
      rifleBarrel.rotation.x = Math.PI / 2;
      rifleBarrel.position.set(0, 0.02, -0.42);
      gunGroup.add(rifleBarrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.1), chromeMat);
      mag.position.set(0, -0.12, -0.05);
      mag.rotation.x = -0.3;
      gunGroup.add(mag);
      const rifleGrip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.15, 0.08), woodGripMat);
      rifleGrip.position.set(0, -0.09, 0.1);
      rifleGrip.rotation.x = 0.3;
      gunGroup.add(rifleGrip);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.2), darkMetalMat);
      handle.position.set(0, 0.09, -0.02);
      gunGroup.add(handle);
    }
  }

  buildViewModel(0);

  // Muzzle Flash
  const flashLight = new THREE.PointLight(0xffaa22, 0, 8);
  flashLight.position.set(0.25, -0.2, -0.8);
  camera.add(flashLight);

  // Zombies Manager
  let round = 1;
  let zombiesRemainingInRound = 6;
  let zombiesSpawnedInRound = 0;
  let zombiesAlive = [];
  let roundIntermission = false;
  let nextRoundTimer = 0;
  let lastSpawnTime = 0;

  // Zombie Spawn Coordinates
  const spawnPoints = [
    new THREE.Vector3(0, 0, -27),
    new THREE.Vector3(57, 0, 0),
    new THREE.Vector3(0, 0, 27),
    new THREE.Vector3(-27, 0, 0)
  ];

  // Four barricaded openings around the arena. Each opening has five
  // individually removable boards; rebuilt boards are restored from the same
  // local game state and never require downloaded assets.
  const barricades = spawnPoints.map((point, index) => {
    const opening = Math.abs(point.x) > Math.abs(point.z)
      ? new THREE.Vector3(Math.sign(point.x) * 24.2, 0, 0)
      : new THREE.Vector3(0, 0, Math.sign(point.z) * 24.2);
    const horizontal = index === 0 || index === 2;
    const boards = [];
    const woodCanvas = document.createElement("canvas");
    woodCanvas.width = 256; woodCanvas.height = 64;
    const woodCtx = woodCanvas.getContext("2d");
    woodCtx.fillStyle = "#76502b"; woodCtx.fillRect(0, 0, 256, 64);
    for (let grain = 0; grain < 24; grain++) {
      woodCtx.strokeStyle = grain % 3 === 0 ? "rgba(35,20,10,.35)" : "rgba(220,175,105,.16)";
      woodCtx.lineWidth = 1 + (grain % 2);
      woodCtx.beginPath(); woodCtx.moveTo(0, grain * 2.6); woodCtx.bezierCurveTo(75, grain * 2.6 - 4, 160, grain * 2.6 + 4, 256, grain * 2.6); woodCtx.stroke();
    }
    woodCtx.fillStyle = "#aaa08d";
    [[8, 8], [248, 8], [8, 56], [248, 56]].forEach(([x, y]) => { woodCtx.beginPath(); woodCtx.arc(x, y, 2, 0, Math.PI * 2); woodCtx.fill(); });
    const boardTexture = new THREE.CanvasTexture(woodCanvas);
    const boardMaterial = new THREE.MeshStandardMaterial({ map: boardTexture, roughness: 0.95 });
    for (let i = 0; i < 5; i++) {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 5.2 : 0.14, 0.22, horizontal ? 0.14 : 5.2),
        boardMaterial
      );
      board.position.set(opening.x, 0.55 + i * 0.42, opening.z);
      // Geometry is already aligned to the window plane; rotating east/west
      // boards here would turn their long axis through the wall instead.
      board.rotation.y = 0.15;
      scene.add(board);
      boards.push(board);
    }
    return { pos: opening, boards, count: 5, rebuildProgress: 0 };
  });
  const setBarricadeCount = (windowState, count) => {
    windowState.count = Math.max(0, Math.min(5, count));
    windowState.boards.forEach((board, i) => { board.visible = i < windowState.count; });
  };
  let repairHeld = false;

  // Create Articulated Zombie Mesh
  function createZombieMesh() {
    const group = new THREE.Group();

    // Torso with torn bloodied shirt
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.88, 0.4);
    const torsoMat = new THREE.MeshLambertMaterial({ map: getZombieShirtTexture(), color: 0x3d3935 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.05;
    group.add(torso);

    // Head Group with neck joint
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.72, 0);
    const headGeo = new THREE.BoxGeometry(0.42, 0.46, 0.42);
    const headMat = new THREE.MeshLambertMaterial({ map: getZombieSkinTexture(), color: 0x5a6351 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.userData.isHead = true;
    headGroup.add(head);

    // Glowing Yellow Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.06), eyeMat);
    eye1.position.set(-0.11, 0.05, 0.22);
    const eye2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.06), eyeMat);
    eye2.position.set(0.11, 0.05, 0.22);
    headGroup.add(eye1);
    headGroup.add(eye2);
    group.add(headGroup);

    // Jointed Arms
    const armMat = new THREE.MeshLambertMaterial({ map: getZombieSkinTexture(), color: 0x4f5446 });
    const armGeo = new THREE.BoxGeometry(0.16, 0.72, 0.16);

    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.46, 1.45, 0);
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.y = -0.32;
    leftArmGroup.add(leftArm);
    leftArmGroup.rotation.x = -Math.PI / 2.2;
    group.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.46, 1.45, 0);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.y = -0.32;
    rightArmGroup.add(rightArm);
    rightArmGroup.rotation.x = -Math.PI / 2.1;
    group.add(rightArmGroup);

    // Jointed Legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0x242220 });
    const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.22);

    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.2, 0.65, 0);
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.y = -0.35;
    leftLegGroup.add(leftLeg);
    group.add(leftLegGroup);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.2, 0.65, 0);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.y = -0.35;
    rightLegGroup.add(rightLeg);
    group.add(rightLegGroup);

    group.userData = {
      torso,
      headGroup,
      leftArmGroup,
      rightArmGroup,
      leftLegGroup,
      rightLegGroup
    };

    return group;
  }

  // Spawn Zombie
  function spawnZombie() {
    const pt = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const mesh = createZombieMesh();
    mesh.position.copy(pt);
    scene.add(mesh);

    // Preserve the slow, uneven opening rounds, then switch to the familiar
    // fast pursuit pace at round five. Later rounds keep increasing pressure.
    const isRunner = round >= 5;
    const speed = isRunner
      ? 3.6 + Math.min((round - 5) * 0.18, 1.4)
      : 1.8 + round * 0.25;
    const maxHp = 70 + (round - 1) * 35;

    zombiesAlive.push({
      mesh,
      barricade: barricades[spawnPoints.indexOf(pt)],
      hp: maxHp,
      maxHp,
      speed,
      isRunner,
      attackCooldown: 0,
      animCycle: Math.random() * 10
    });

    zombiesSpawnedInRound++;
  }

  // Input State
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false
  };
  let isPointerLocked = false;
  let isMouseDown = false;

  // Pointer Lock Controls
  startBtn.addEventListener("click", () => {
    initAudio();
    canvas.requestPointerLock();
  });

  restartBtn.addEventListener("click", () => {
    gameOverOverlay.style.display = "none";
    resetGame();
    canvas.requestPointerLock();
  });

  document.addEventListener("pointerlockchange", () => {
    isPointerLocked = document.pointerLockElement === canvas;
    syncLowHealthEffects();
    if (!isPointerLocked) repairHeld = false;
    if (isPointerLocked) {
      blocker.style.display = "none";
    } else {
      // Clear movement keys and firing state on pointer lock release
      keys.forward = keys.backward = keys.left = keys.right = keys.sprint = keys.jump = false;
      isMouseDown = false;
      if (player.health > 0) {
        blocker.style.display = "flex";
      }
    }
  });

  window.addEventListener("blur", () => {
    keys.forward = keys.backward = keys.left = keys.right = keys.sprint = keys.jump = false;
    isMouseDown = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isPointerLocked) return;
    // Discard anomalous large delta spikes from browser locking / unlocking
    if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
    const sens = 0.0022;
    player.yaw -= e.movementX * sens;
    player.pitch -= e.movementY * sens;
    // Clamp pitch to avoid gimbal inversion
    player.pitch = Math.max(-Math.PI / 2.15, Math.min(Math.PI / 2.15, player.pitch));
  });

  document.addEventListener("keydown", (e) => {
    if (!isPointerLocked) return;

    if (e.code === "KeyW") keys.forward = true;
    if (e.code === "KeyS") keys.backward = true;
    if (e.code === "KeyA") keys.left = true;
    if (e.code === "KeyD") keys.right = true;
    if (e.code === "ShiftLeft") keys.sprint = true;
    if (e.code === "Space") keys.jump = true;

    if (e.code === "KeyR") reloadWeapon();
    if (e.code === "KeyF") { repairHeld = true; if (!e.repeat) handleInteract(); }

    if (e.code === "Digit1") switchWeapon(0);
    if (e.code === "Digit2") switchWeapon(1);
    if (e.code === "Digit3") switchWeapon(2);
  });

  document.addEventListener("keyup", (e) => {
    if (e.code === "KeyF") repairHeld = false;
    if (e.code === "KeyW") keys.forward = false;
    if (e.code === "KeyS") keys.backward = false;
    if (e.code === "KeyA") keys.left = false;
    if (e.code === "KeyD") keys.right = false;
    if (e.code === "ShiftLeft") keys.sprint = false;
    if (e.code === "Space") keys.jump = false;
  });

  document.addEventListener("mousedown", (e) => {
    if (!isPointerLocked) return;
    if (e.button === 0) {
      isMouseDown = true;
      triggerShoot();
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (e.button === 0) isMouseDown = false;
  });

  document.addEventListener("wheel", (e) => {
    if (!isPointerLocked) return;
    if (e.deltaY > 0) {
      player.currentWeaponIdx = (player.currentWeaponIdx + 1) % player.inventory.length;
    } else {
      player.currentWeaponIdx = (player.currentWeaponIdx - 1 + player.inventory.length) % player.inventory.length;
    }
    updateWeaponHUD();
  });

  // Switch Weapon
  function switchWeapon(slotIdx) {
    if (slotIdx < player.inventory.length) {
      player.currentWeaponIdx = slotIdx;
      player.isReloading = false;
      buildViewModel(player.inventory[slotIdx]);
      updateWeaponHUD();
    }
  }

  function getActiveWeapon() {
    return WEAPONS[player.inventory[player.currentWeaponIdx]];
  }

  // Shoot Weapon
  function triggerShoot() {
    const weapon = getActiveWeapon();
    const now = performance.now();

    if (player.isReloading || now - player.lastShotTime < weapon.fireRate) return;
    if (weapon.mag <= 0) {
      reloadWeapon();
      return;
    }

    weapon.mag--;
    player.lastShotTime = now;
    playSound(weapon.sound);

    // Muzzle Flash Effect
    flashLight.intensity = 3;
    setTimeout(() => { flashLight.intensity = 0; }, 40);

    // Gun Recoil Kick
    gunGroup.position.z = -0.36;

    // Raycast Shooting aligned directly with camera world direction
    const raycaster = new THREE.Raycaster();
    const hitZombies = [];
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    for (let p = 0; p < weapon.pellets; p++) {
      let shootDir = forward.clone();
      if (weapon.spread) {
        shootDir.addScaledVector(right, (Math.random() - 0.5) * weapon.spread);
        shootDir.addScaledVector(up, (Math.random() - 0.5) * weapon.spread);
        shootDir.normalize();
      }

      raycaster.set(camera.position, shootDir);

      // Check against zombie meshes
      const targets = [];
      zombiesAlive.forEach((z) => {
        z.mesh.traverse((child) => {
          if (child.isMesh) {
            child.userData.zombieRef = z;
            targets.push(child);
          }
        });
      });

      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const hit = hits[0];
        const z = hit.object.userData.zombieRef;
        const isHead = !!hit.object.userData.isHead;

        if (z && !hitZombies.includes(z)) {
          hitZombies.push(z);
          const isInsta = player.instaKillUntil > performance.now();
          const dmg = isInsta ? z.hp : (isHead ? weapon.damage * 3 : weapon.damage);
          z.hp -= dmg;

          showHitmarker(isHead || isInsta);
          playSound(isHead ? "headshot" : "hit");

          if (z.hp <= 0) {
            killZombie(z, isHead);
          } else {
            const hitPts = player.doublePointsUntil > performance.now() ? 20 : 10;
            addPoints(hitPts);
          }
        }
      }
    }

    updateWeaponHUD();
  }

  // Hitmarker UI
  function showHitmarker(isHeadshot) {
    hitmarkerEl.className = `hitmarker active ${isHeadshot ? "headshot" : ""}`;
    setTimeout(() => {
      hitmarkerEl.classList.remove("active");
    }, 120);
  }

  // Reload Weapon
  function reloadWeapon() {
    const weapon = getActiveWeapon();
    if (player.isReloading || weapon.mag >= weapon.magSize || weapon.reserve <= 0) return;

    player.isReloading = true;
    playSound("reload");

    const reloadDuration = player.hasSpeedCola ? weapon.reloadTime * 0.5 : weapon.reloadTime;

    setTimeout(() => {
      const needed = weapon.magSize - weapon.mag;
      const taking = Math.min(needed, weapon.reserve);
      weapon.mag += taking;
      weapon.reserve -= taking;
      player.isReloading = false;
      updateWeaponHUD();
    }, reloadDuration);
  }

  // Kill Zombie
  function killZombie(z, isHeadshot) {
    scene.remove(z.mesh);
    zombiesAlive = zombiesAlive.filter((item) => item !== z);

    player.kills++;
    if (isHeadshot) player.headshots++;

    let earned = isHeadshot ? 100 : 60;
    if (player.doublePointsUntil > performance.now()) {
      earned *= 2;
    }
    addPoints(earned);

    // 15% Chance to spawn a Power-Up drop
    if (Math.random() < 0.15) {
      spawnPowerUp(z.mesh.position);
    }

    // Check Round Completion
    if (zombiesAlive.length === 0 && zombiesSpawnedInRound >= zombiesRemainingInRound) {
      completeRound();
    }
  }

  // Points Manager
  function addPoints(pts) {
    player.points += pts;
    player.totalPointsEarned += pts;
    pointsValEl.textContent = player.points;
  }

  // Round Management
  function completeRound() {
    roundIntermission = true;
    nextRoundTimer = performance.now() + 4000;
  }

  function advanceRound() {
    round++;
    updateRoundHUD(round);
    zombiesRemainingInRound = 5 + round * 4;
    zombiesSpawnedInRound = 0;
    roundIntermission = false;
    playSound("round");
  }

  function updateRoundHUD(r) {
    if (r === 1) roundNumEl.innerHTML = "I";
    else if (r === 2) roundNumEl.innerHTML = "II";
    else if (r === 3) roundNumEl.innerHTML = "III";
    else if (r === 4) roundNumEl.innerHTML = "IIII";
    else if (r === 5) roundNumEl.innerHTML = '<span class="tally-slash">IIII</span>';
    else roundNumEl.innerHTML = `<span style="color:#dc2626;">${r}</span>`;
  }

  // Wall Buy & Interaction
  function handleInteract() {
    if (!debrisBarrier.purchased && camera.position.distanceTo(debrisBarrier.pos) < 4.5 && player.points >= debrisBarrier.cost) {
      player.points -= debrisBarrier.cost;
      pointsValEl.textContent = player.points;
      debrisBarrier.purchased = true;
      scene.remove(debrisBarrier.group);
      obstacles.splice(obstacles.indexOf(debrisBarrier.obstacle), 1);
      playSound("buy");
      return;
    }
    // 1. Mystery Box Interaction
    if (camera.position.distanceTo(mysteryBox.pos) < 3.5) {
      if (mysteryBox.offeredWeaponId !== null) {
        // Take offered weapon
        const wid = mysteryBox.offeredWeaponId;
        mysteryBox.offeredWeaponId = null;
        mysteryBox.light.intensity = 0;
        mysteryBox.lidMesh.position.y = 0.95;

        if (player.inventory.includes(wid)) {
          // Already owns, refill ammo
          WEAPONS[wid].reserve = WEAPONS[wid].maxReserve;
        } else if (player.inventory.length >= 2) {
          // Replace current weapon
          player.inventory[player.currentWeaponIdx] = wid;
        } else {
          player.inventory.push(wid);
          player.currentWeaponIdx = player.inventory.length - 1;
        }
        playSound("buy");
        updateWeaponHUD();
        return;
      } else if (!mysteryBox.isSpinning && player.points >= mysteryBox.cost) {
        // Spin mystery box
        player.points -= mysteryBox.cost;
        pointsValEl.textContent = player.points;
        mysteryBox.isSpinning = true;
        mysteryBox.spinUntil = performance.now() + 3500;
        mysteryBox.lidMesh.position.y = 1.6;
        mysteryBox.light.intensity = 2.5;
        playSound("mysterybox");
        return;
      }
    }

    // 2. Wall Buys & Perks Interaction
    wallBuys.forEach((wb) => {
      if (camera.position.distanceTo(wb.pos) < 3.2) {
        if (wb.isPerk) {
          if (wb.perkType === "juggernog" && !player.hasJuggernog && player.points >= wb.cost) {
            player.points -= wb.cost;
            player.hasJuggernog = true;
            player.maxHealth = 250;
            player.health = 250;
            playSound("buy");
            updateHealthHUD();
            pointsValEl.textContent = player.points;
            renderPerks();
          } else if (wb.perkType === "speedcola" && !player.hasSpeedCola && player.points >= wb.cost) {
            player.points -= wb.cost;
            player.hasSpeedCola = true;
            playSound("buy");
            pointsValEl.textContent = player.points;
            renderPerks();
          }
        } else {
          const alreadyOwns = player.inventory.includes(wb.weaponId);
          if (!alreadyOwns && player.points >= wb.cost) {
            player.points -= wb.cost;
            if (player.inventory.length >= 2) {
              player.inventory[player.currentWeaponIdx] = wb.weaponId;
            } else {
              player.inventory.push(wb.weaponId);
              player.currentWeaponIdx = player.inventory.length - 1;
            }
            playSound("buy");
            updateWeaponHUD();
            pointsValEl.textContent = player.points;
          } else if (alreadyOwns && player.points >= wb.ammoCost) {
            const w = WEAPONS[wb.weaponId];
            if (w.reserve < w.maxReserve) {
              player.points -= wb.ammoCost;
              w.reserve = w.maxReserve;
              playSound("buy");
              updateWeaponHUD();
              pointsValEl.textContent = player.points;
            }
          }
        }
      }
    });
  }

  // Check Nearby Wall Buy & Mystery Box for Center Prompt
  function checkInteractionPrompt() {
    let promptText = null;

    const nearbyWindow = barricades.find((windowState) => camera.position.distanceTo(windowState.pos) < 3.2);
    if (nearbyWindow && nearbyWindow.count < 5) {
      promptText = `Hold F to Rebuild Barricade [+10 pts] (${nearbyWindow.count}/5)`;
    }

    // 1. Check Wall Buys & Perks
    wallBuys.forEach((wb) => {
      if (camera.position.distanceTo(wb.pos) < 3.2) {
        if (wb.isPerk) {
          if (wb.perkType === "juggernog" && !player.hasJuggernog) {
            promptText = `Press F to Buy ${wb.name} [${wb.cost} pts]`;
          } else if (wb.perkType === "speedcola" && !player.hasSpeedCola) {
            promptText = `Press F to Buy ${wb.name} [${wb.cost} pts]`;
          }
        } else {
          const alreadyOwns = player.inventory.includes(wb.weaponId);
          if (!alreadyOwns) {
            promptText = `Press F to Buy ${wb.name} [${wb.cost} pts]`;
          } else {
            promptText = `Press F for Ammo [${wb.ammoCost} pts]`;
          }
        }
      }
    });

    // 2. Check Mystery Box
    if (camera.position.distanceTo(mysteryBox.pos) < 3.5) {
      if (mysteryBox.isSpinning) {
        const tempW = WEAPONS[mysteryBox.tempWeaponId || 0];
        promptText = `Cycling... [${tempW ? tempW.name : "???"}]`;
      } else if (mysteryBox.offeredWeaponId !== null) {
        const offW = WEAPONS[mysteryBox.offeredWeaponId];
        promptText = `Press F to Take [${offW.name}]`;
      } else {
        promptText = `Press F for Mystery Box [${mysteryBox.cost} pts]`;
      }
    }

    if (!debrisBarrier.purchased && camera.position.distanceTo(debrisBarrier.pos) < 4.5) {
      promptText = `Press F to Clear Debris — ${debrisBarrier.cost} Pts`;
    }

    if (promptText) {
      centerPrompt.textContent = promptText;
      centerPrompt.style.display = "block";
    } else {
      centerPrompt.style.display = "none";
    }
  }

  // Update HUD
  function updateWeaponHUD() {
    const weapon = getActiveWeapon();
    weaponNameEl.textContent = weapon.name;
    ammoMagEl.textContent = player.isReloading ? "..." : weapon.mag;
    ammoReserveEl.textContent = weapon.reserve;
  }

  function updateHealthHUD() {
    const pct = Math.max(0, (player.health / player.maxHealth) * 100);
    healthBarFill.style.width = `${pct}%`;
    healthBarFill.classList.toggle("low", pct < 35);
    syncLowHealthEffects();
  }

  function syncLowHealthEffects() {
    const critical = player.health > 0 && (player.health / player.maxHealth) < 0.3 && isPointerLocked;
    damageVignette.classList.toggle("critical", critical);
    if (critical && !lowHealthHeartbeatTimer) {
      playSound("heartbeat");
      lowHealthHeartbeatTimer = window.setInterval(() => {
        if (audioCtx?.state === "running" && player.health > 0 && (player.health / player.maxHealth) < 0.3 && isPointerLocked) playSound("heartbeat");
        else syncLowHealthEffects();
      }, 860);
    } else if (!critical && lowHealthHeartbeatTimer) {
      clearInterval(lowHealthHeartbeatTimer);
      lowHealthHeartbeatTimer = null;
    }
  }

  function renderPerks() {
    perksContainer.innerHTML = "";
    if (player.hasJuggernog) {
      const p = document.createElement("div");
      p.className = "perk-badge";
      p.textContent = "🛡 JUGGERNOG";
      perksContainer.appendChild(p);
    }
    if (player.hasSpeedCola) {
      const p = document.createElement("div");
      p.className = "perk-badge";
      p.style.borderColor = "rgba(16, 185, 129, 0.4)";
      p.style.color = "#34d399";
      p.textContent = "⚡ SPEED COLA";
      perksContainer.appendChild(p);
    }
  }

  // Damage Player
  function damagePlayer(dmg) {
    player.health -= dmg;
    player.lastHitTime = performance.now();
    playSound("hurt");
    updateHealthHUD();

    damageVignette.classList.add("hurt");
    setTimeout(() => {
      damageVignette.classList.remove("hurt");
    }, 250);

    if (player.health <= 0) {
      triggerGameOver();
    }
  }

  // Game Over
  function triggerGameOver() {
    if (document.exitPointerLock) document.exitPointerLock();
    statRounds.textContent = round;
    statKills.textContent = player.kills;
    statHeadshots.textContent = player.headshots;
    statPoints.textContent = player.totalPointsEarned;
    gameOverOverlay.style.display = "flex";
  }

  // Reset Game
  function resetGame() {
    round = 1;
    roundNumEl.textContent = round;
    roundIntermission = false;
    zombiesRemainingInRound = 6;
    zombiesSpawnedInRound = 0;

    zombiesAlive.forEach((z) => scene.remove(z.mesh));
    zombiesAlive = [];
    if (debrisBarrier.purchased) {
      scene.add(debrisBarrier.group);
      obstacles.push(debrisBarrier.obstacle);
      debrisBarrier.purchased = false;
    }
    barricades.forEach((windowState) => {
      windowState.rebuildProgress = 0;
      setBarricadeCount(windowState, 5);
    });

    player.pos.set(0, 1.7, 0);
    player.yaw = 0;
    player.pitch = 0;
    player.health = 100;
    player.maxHealth = 100;
    player.hasJuggernog = false;
    player.hasSpeedCola = false;
    player.instaKillUntil = 0;
    player.doublePointsUntil = 0;
    updateActivePowerupsHUD();
    powerupsAlive.forEach(p => scene.remove(p.group));
    powerupsAlive = [];
    mysteryBox.isSpinning = false;
    mysteryBox.offeredWeaponId = null;
    if (mysteryBox.light) mysteryBox.light.intensity = 0;
    if (mysteryBox.lidMesh) mysteryBox.lidMesh.position.y = 0.95;

    player.points = 500;
    player.kills = 0;
    player.headshots = 0;
    player.totalPointsEarned = 500;
    player.inventory = [0];
    player.currentWeaponIdx = 0;

    // Reset weapons ammo
    WEAPONS[0].mag = 8;
    WEAPONS[0].reserve = 48;
    WEAPONS[1].mag = 6;
    WEAPONS[1].reserve = 30;
    WEAPONS[2].mag = 30;
    WEAPONS[2].reserve = 120;
    WEAPONS[3].mag = 20;
    WEAPONS[3].reserve = 160;
    WEAPONS[4].mag = 60;
    WEAPONS[4].reserve = 300;

    pointsValEl.textContent = player.points;
    renderPerks();
    updateHealthHUD();
    updateWeaponHUD();
  }

  // Main Loop
  let lastFrameTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;

    if (isPointerLocked && player.health > 0) {
      // Automatic weapons firing while mouse down
      if (isMouseDown && getActiveWeapon().isAuto) {
        triggerShoot();
      }

      // Smooth gun return after recoil
      gunGroup.position.z += (-0.45 - gunGroup.position.z) * 0.2;

      // Natural Health Regeneration after 4 seconds
      if (now - player.lastHitTime > 4000 && player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + 40 * dt);
        updateHealthHUD();
      }

      // Player Movement Logic
      const moveSpeed = keys.sprint ? 9.0 : 5.5;
      const moveDir = new THREE.Vector3();

      if (keys.forward) moveDir.z -= 1;
      if (keys.backward) moveDir.z += 1;
      if (keys.left) moveDir.x -= 1;
      if (keys.right) moveDir.x += 1;
      moveDir.normalize();

      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);

      let nextX = player.pos.x + moveDir.x * moveSpeed * dt;
      let nextZ = player.pos.z + moveDir.z * moveSpeed * dt;

      // Starting room -> narrow debris passage -> annex. The two doorway
      // crossings are closed until the 1000 point purchase removes the rubble.
      const previousX = player.pos.x;
      nextX = Math.max(-23.5, Math.min(debrisBarrier.purchased ? 53.5 : 23.5, nextX));
      nextZ = Math.max(-23.5, Math.min(23.5, nextZ));
      if (!debrisBarrier.purchased) nextX = Math.min(nextX, 23.5);
      if (previousX <= 23.5 && nextX > 23.5 && Math.abs(nextZ) > 2.2) nextX = 23.5;
      if (previousX > 24.5 && nextX <= 24.5 && Math.abs(nextZ) > 2.2) nextX = 24.51;
      if (previousX <= 28.5 && nextX > 28.5 && Math.abs(nextZ) > 2.2) nextX = 28.5;
      if (previousX > 28.5 && nextX <= 28.5 && Math.abs(nextZ) > 2.2) nextX = 28.51;
      if (nextX > 23.5 && nextX <= 28.5) nextZ = Math.max(-2.2, Math.min(2.2, nextZ));
      else if (nextX > 28.5) nextZ = Math.max(-13.5, Math.min(13.5, nextZ));

      // Pillar & Obstacle Collisions
      obstacles.forEach((obs) => {
        const dist = Math.hypot(nextX - obs.x, nextZ - obs.z);
        if (dist < obs.radius) {
          const angle = Math.atan2(nextZ - obs.z, nextX - obs.x);
          nextX = obs.x + Math.cos(angle) * obs.radius;
          nextZ = obs.z + Math.sin(angle) * obs.radius;
        }
      });

      player.pos.x = nextX;
      player.pos.z = nextZ;

      // Camera Positioning & Orientation (Pure YXZ Euler order, no gimbal lock)
      camera.position.copy(player.pos);
      camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");

      // Check Wall Buy Interaction Prompt
      checkInteractionPrompt();

      // Zombie Spawner & AI
      if (!roundIntermission) {
        if (zombiesSpawnedInRound < zombiesRemainingInRound && now - lastSpawnTime > 1500) {
          spawnZombie();
          lastSpawnTime = now;
        }
      } else if (now > nextRoundTimer) {
        advanceRound();
      }

      // Update Zombies AI & Shambling Limb Animation
      zombiesAlive.forEach((z) => {
        z.animCycle += dt * (z.speed * (z.isRunner ? 3.8 : 2.2));
        const limbStride = Math.sin(z.animCycle);
        const strideLength = z.isRunner ? 0.9 : 0.55;

        // Articulated limbs animation
        if (z.mesh.userData && z.mesh.userData.leftLegGroup) {
          z.mesh.userData.leftLegGroup.rotation.x = limbStride * strideLength;
          z.mesh.userData.rightLegGroup.rotation.x = -limbStride * strideLength;
          const armSwing = Math.sin(z.animCycle * 0.9) * (z.isRunner ? 0.48 : 0.15);
          z.mesh.userData.leftArmGroup.rotation.x = -Math.PI / 2.2 + armSwing;
          z.mesh.userData.rightArmGroup.rotation.x = -Math.PI / 2.1 - armSwing;
          if (z.mesh.userData.torso) z.mesh.userData.torso.rotation.x = z.isRunner ? -0.12 : 0;
          z.mesh.userData.headGroup.rotation.z = Math.sin(z.animCycle * 0.4) * 0.1;
        }

        const dx = player.pos.x - z.mesh.position.x;
        const dz = player.pos.z - z.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        // Face player
        z.mesh.rotation.y = Math.atan2(dx, dz);

        // Shambling / limping bob
        z.mesh.position.y = Math.abs(limbStride) * 0.08;

        // Zombies first tear down the boards at their spawn opening, one at a
        // time, then enter the arena and pursue the player.
        const barrier = z.barricade;
        if (barrier && barrier.count > 0 && z.mesh.position.distanceTo(barrier.pos) < 2.6) {
          z.attackCooldown -= dt;
          if (z.attackCooldown <= 0) {
            setBarricadeCount(barrier, barrier.count - 1);
            z.attackCooldown = z.isRunner ? 0.8 : 1.25;
          }
          return;
        }

        // Move towards player if outside melee range
        if (dist > 1.4) {
          const vx = (dx / dist) * z.speed * dt;
          const vz = (dz / dist) * z.speed * dt;
          let nx = z.mesh.position.x + vx, nz = z.mesh.position.z + vz;
          nx = Math.max(-24.5, Math.min(56.5, nx));
          if (nx > 25 && nx <= 28.5) nz = Math.max(-2.2, Math.min(2.2, nz));
          else if (nx > 28.5) nz = Math.max(-14.5, Math.min(14.5, nz));
          else nz = Math.max(-24.5, Math.min(24.5, nz));
          const collides = (x, zz) => obstacles.some((obstacle) => Math.hypot(x - obstacle.x, zz - obstacle.z) < obstacle.radius + 0.45);
          if (!collides(nx, nz)) {
            z.mesh.position.x = nx;
            z.mesh.position.z = nz;
          } else if (!collides(nx, z.mesh.position.z)) {
            z.mesh.position.x = nx;
          } else if (!collides(z.mesh.position.x, nz)) {
            z.mesh.position.z = nz;
          }
        } else {
          // Melee Attack
          z.attackCooldown -= dt;
          if (z.attackCooldown <= 0) {
            damagePlayer(35);
            z.attackCooldown = 1.3;
          }
        }
      });

      // Holding F steadily restores one board every 0.75 seconds. Each board
      // awards ten points, matching the classic repair reward.
      const repairTarget = barricades.find((windowState) => camera.position.distanceTo(windowState.pos) < 3.2 && windowState.count < 5);
      if (repairHeld && repairTarget) {
        repairTarget.rebuildProgress += dt;
        if (repairTarget.rebuildProgress >= 0.75) {
          repairTarget.rebuildProgress = 0;
          setBarricadeCount(repairTarget, repairTarget.count + 1);
          player.points += 10;
          player.totalPointsEarned += 10;
          pointsValEl.textContent = player.points;
          playSound("buy");
        }
      } else {
        barricades.forEach((windowState) => { windowState.rebuildProgress = 0; });
      }

      // Update Powerup Pickups & Active Timers
      updatePowerups(dt, now);
      updateActivePowerupsHUD();

      // Update Mystery Box Spin & Offering
      if (mysteryBox.isSpinning) {
        if (now - mysteryBox.lastSpinTick > 100) {
          mysteryBox.lastSpinTick = now;
          mysteryBox.tempWeaponId = Math.floor(Math.random() * WEAPONS.length);
        }
        if (now > mysteryBox.spinUntil) {
          mysteryBox.isSpinning = false;
          // Weighted random pick: Ray Gun 20%, Heavy Machine Gun 25%, Assault Rifle 25%, Trench Shotgun 20%, Pistol 10%
          const r = Math.random();
          let picked = 0;
          if (r < 0.20) picked = 3;
          else if (r < 0.45) picked = 4;
          else if (r < 0.70) picked = 2;
          else if (r < 0.90) picked = 1;
          else picked = 0;

          mysteryBox.offeredWeaponId = picked;
          mysteryBox.offerExpiresAt = now + 10000;
          playSound("powerup");
        }
      } else if (mysteryBox.offeredWeaponId !== null && now > mysteryBox.offerExpiresAt) {
        mysteryBox.offeredWeaponId = null;
        if (mysteryBox.light) mysteryBox.light.intensity = 0;
        if (mysteryBox.lidMesh) mysteryBox.lidMesh.position.y = 0.95;
      }
    }

    renderer.render(scene, camera);
  }

  // Handle Resize
  window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });

  // Start Animation Loop
  animate();
})();

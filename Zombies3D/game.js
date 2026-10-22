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
    }
  }

  // Three.js Core Engine Setup
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0c0b0a, 0.035);

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
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
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1e1d1b";
    ctx.fillRect(0, 0, 256, 256);
    // Grid lines
    ctx.strokeStyle = "#141312";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 256);
    // Speckle noise
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(x, y, 2, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    return texture;
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

  // Outer Walls
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x242220 });
  const wallHeight = 6;
  const wallHalf = 25;

  const walls = [
    { pos: [0, wallHeight / 2, -wallHalf], size: [50, wallHeight, 1] }, // North
    { pos: [0, wallHeight / 2, wallHalf], size: [50, wallHeight, 1] },  // South
    { pos: [-wallHalf, wallHeight / 2, 0], size: [1, wallHeight, 50] }, // West
    { pos: [wallHalf, wallHeight / 2, 0], size: [1, wallHeight, 50] }   // East
  ];

  walls.forEach(({ pos, size }) => {
    const geo = new THREE.BoxGeometry(...size);
    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set(...pos);
    scene.add(wall);
  });

  // Pillars & Obstacles
  const obstacles = [];
  const pillarGeo = new THREE.BoxGeometry(3, wallHeight, 3);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x2b2826 });

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

  // Crates / Cover
  const crateGeo = new THREE.BoxGeometry(2, 1.6, 2);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x3d3023 });
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

  // Wall Buys Setup
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
      pos: new THREE.Vector3(24.4, 2, 0),
      color: 0x3b82f6
    },
    {
      id: "juggernog",
      name: "Juggernog (250 HP)",
      isPerk: true,
      cost: 2500,
      pos: new THREE.Vector3(-24.4, 1.8, 0),
      color: 0xef4444
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

  // 3D Gun Viewmodel attached to Camera
  const gunGroup = new THREE.Group();
  const gunBarrelGeo = new THREE.BoxGeometry(0.08, 0.1, 0.45);
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x1f1d1b });
  const gunMesh = new THREE.Mesh(gunBarrelGeo, gunMat);
  gunGroup.add(gunMesh);
  gunGroup.position.set(0.25, -0.22, -0.45);
  camera.add(gunGroup);
  scene.add(camera);

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
    new THREE.Vector3(-22, 0, -22),
    new THREE.Vector3(22, 0, -22),
    new THREE.Vector3(-22, 0, 22),
    new THREE.Vector3(22, 0, 22)
  ];

  // Create Zombie Mesh
  function createZombieMesh() {
    const group = new THREE.Group();

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.4);
    const torsoMat = new THREE.MeshLambertMaterial({ color: 0x3d3935 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.05;
    group.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.45, 0.4);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x5a6351 }); // sickly green
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.72;
    head.userData.isHead = true;
    group.add(head);

    // Glowing Yellow Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMat);
    eye1.position.set(-0.1, 1.75, 0.21);
    const eye2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMat);
    eye2.position.set(0.1, 1.75, 0.21);
    group.add(eye1);
    group.add(eye2);

    // Outstretched Arms
    const armMat = new THREE.MeshLambertMaterial({ color: 0x4f5446 });
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.7), armMat);
    arm1.position.set(-0.45, 1.25, 0.35);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.7), armMat);
    arm2.position.set(0.45, 1.25, 0.35);
    group.add(arm1);
    group.add(arm2);

    return group;
  }

  // Spawn Zombie
  function spawnZombie() {
    const pt = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const mesh = createZombieMesh();
    mesh.position.copy(pt);
    scene.add(mesh);

    const speed = 1.8 + Math.min(round * 0.25, 3.5);
    const maxHp = 70 + (round - 1) * 35;

    zombiesAlive.push({
      mesh,
      hp: maxHp,
      maxHp,
      speed,
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
    if (isPointerLocked) {
      blocker.style.display = "none";
    } else {
      if (player.health > 0) {
        blocker.style.display = "flex";
      }
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!isPointerLocked) return;
    const sens = 0.0022;
    player.yaw -= e.movementX * sens;
    player.pitch -= e.movementY * sens;
    player.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, player.pitch));
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
    if (e.code === "KeyF") handleInteract();

    if (e.code === "Digit1") switchWeapon(0);
    if (e.code === "Digit2") switchWeapon(1);
    if (e.code === "Digit3") switchWeapon(2);
  });

  document.addEventListener("keyup", (e) => {
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

    // Raycast Shooting
    const raycaster = new THREE.Raycaster();
    const hitZombies = [];

    for (let p = 0; p < weapon.pellets; p++) {
      let shootDir = new THREE.Vector3(0, 0, -1);
      if (weapon.spread) {
        shootDir.x += (Math.random() - 0.5) * weapon.spread;
        shootDir.y += (Math.random() - 0.5) * weapon.spread;
        shootDir.normalize();
      }
      shootDir.applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, "YXZ"));

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
          const dmg = isHead ? weapon.damage * 3 : weapon.damage;
          z.hp -= dmg;

          showHitmarker(isHead);
          playSound(isHead ? "headshot" : "hit");

          if (z.hp <= 0) {
            killZombie(z, isHead);
          } else {
            addPoints(10);
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

    setTimeout(() => {
      const needed = weapon.magSize - weapon.mag;
      const taking = Math.min(needed, weapon.reserve);
      weapon.mag += taking;
      weapon.reserve -= taking;
      player.isReloading = false;
      updateWeaponHUD();
    }, weapon.reloadTime);
  }

  // Kill Zombie
  function killZombie(z, isHeadshot) {
    scene.remove(z.mesh);
    zombiesAlive = zombiesAlive.filter((item) => item !== z);

    player.kills++;
    if (isHeadshot) player.headshots++;

    const earned = isHeadshot ? 100 : 60;
    addPoints(earned);

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
    roundNumEl.textContent = round;
    zombiesRemainingInRound = 5 + round * 4;
    zombiesSpawnedInRound = 0;
    roundIntermission = false;
    playSound("round");
  }

  // Wall Buy & Interaction
  function handleInteract() {
    wallBuys.forEach((wb) => {
      if (camera.position.distanceTo(wb.pos) < 3.2) {
        if (wb.isPerk) {
          if (!player.hasJuggernog && player.points >= wb.cost) {
            player.points -= wb.cost;
            player.hasJuggernog = true;
            player.maxHealth = 250;
            player.health = 250;
            playSound("buy");
            updateHealthHUD();
            pointsValEl.textContent = player.points;
            renderPerks();
          }
        } else {
          // Weapon
          const alreadyOwns = player.inventory.includes(wb.weaponId);
          if (!alreadyOwns && player.points >= wb.cost) {
            player.points -= wb.cost;
            player.inventory.push(wb.weaponId);
            player.currentWeaponIdx = player.inventory.length - 1;
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

  // Check Nearby Wall Buy for Center Prompt
  function checkInteractionPrompt() {
    let promptText = null;
    wallBuys.forEach((wb) => {
      if (camera.position.distanceTo(wb.pos) < 3.2) {
        if (wb.isPerk) {
          if (!player.hasJuggernog) {
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
  }

  function renderPerks() {
    perksContainer.innerHTML = "";
    if (player.hasJuggernog) {
      const p = document.createElement("div");
      p.className = "perk-badge";
      p.textContent = "🛡 JUGGERNOG";
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

    player.pos.set(0, 1.7, 0);
    player.yaw = 0;
    player.pitch = 0;
    player.health = 100;
    player.maxHealth = 100;
    player.hasJuggernog = false;
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

      // Arena Boundary Collisions (Walls)
      nextX = Math.max(-23.5, Math.min(23.5, nextX));
      nextZ = Math.max(-23.5, Math.min(23.5, nextZ));

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

      // Camera Positioning & Rotation
      camera.position.copy(player.pos);
      camera.rotation.set(0, 0, 0);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

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

      // Update Zombies AI
      zombiesAlive.forEach((z) => {
        z.animCycle += dt * 6;
        const dx = player.pos.x - z.mesh.position.x;
        const dz = player.pos.z - z.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        // Face player
        z.mesh.rotation.y = Math.atan2(dx, dz);

        // Walking / Limping Animation Bob
        z.mesh.position.y = Math.abs(Math.sin(z.animCycle)) * 0.12;

        // Move towards player if outside melee range
        if (dist > 1.4) {
          const vx = (dx / dist) * z.speed * dt;
          const vz = (dz / dist) * z.speed * dt;
          z.mesh.position.x += vx;
          z.mesh.position.z += vz;
        } else {
          // Melee Attack
          z.attackCooldown -= dt;
          if (z.attackCooldown <= 0) {
            damagePlayer(35);
            z.attackCooldown = 1.3;
          }
        }
      });
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

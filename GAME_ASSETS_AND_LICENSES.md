# Zombies3D — Game Assets, Architecture & Licensing Manifest

## Fidelity and attribution correction — 2026-10-22

The local `Assets/nzportable` checkout is the NZ:P hub repository. Its README says the engine, QuakeC game code, and game assets live in separate repositories; those are not present in this local checkout. Therefore the procedurally generated meshes/audio described below are Sigma-created prototype assets and must not be described as authentic NZ:P/CoD assets. The hub README alone does not establish the license of omitted component repositories or of Call of Duty audio/art. No upstream NZ:P assets were copied in this pass.

The critical-health HUD and heartbeat are Sigma-authored CSS and Web Audio synthesis; they use no external image or audio files. A screenshot verifies the overlay style only; the heartbeat trigger/timing still needs combat testing.

The barricade implementation in `Zombies3D/game.js` is original procedural geometry and gameplay code, not copied QuakeC. The prototype now connects the original 50×50 spawn room to a 30×30 east annex through a 1000-point rubble gate; the Mystery Box and rifle wall buy are in that annex, which has its own barricaded east window. This remains a small two-room prototype, not a faithful NZ:P/Nacht map. The generic MIT/CC0 labels in the original table do not establish third-party provenance; they apply only to original procedural output.

### Update after the cross-app fidelity pass

`Zombies3D/game.js` now contains a 50×50 spawn room connected east to a 30×30 annex. The rubble gate sits in the narrow doorway; purchasing it for 1000 points removes both its mesh and collision blocker. The Mystery Box and rifle wall buy are beyond the gate. The annex has an exterior barricaded window, and east/west boards are oriented in the window plane. Four spawn points remain at cardinal openings with five boards each and held-F repairs for +10 points. Rounds 1–4 shuffle; round 5+ uses faster movement, gait, and barricade attacks. All are Sigma-authored prototype mechanics. There is no upper floor or stair traversal, and obstacle steering is not general pathfinding. The local NZ:P hub checkout contains only its README/screenshots/build metadata, so no QuakeC or licensed NZ:P asset was used.

Authentic upstream Lucide SVGs were copied only from `Assets/photocraft/assets/icons/` to `PhotoCraft/icons/` and `Assets/pdfcraft/assets/icons/` to `PdfCraft/icons/`. Each destination includes the upstream `LICENSE-lucide.txt`. These are used by the corresponding toolbars. The other five Craft asset trees do not provide an `assets/icons/` folder. No external game art/audio was copied or claimed.

This document records the 3D rendering pipeline, procedural texture generators, mathematical models, Web Audio synthesizer architectures, and permissive open-source licensing for the **Zombies3D** survival game within **Sigma Webapps**.

---

## 1. Engine & Technical Architecture

- **Rendering Pipeline:** Three.js r128 (bundled locally in `lib/three.min.js`, 100% offline, zero CDN dependencies).
- **Camera Controller:** First-person Euler orientation controller with strict `YXZ` rotation order:
  - `camera.rotation.order = "YXZ"`
  - `camera.rotation.set(player.pitch, player.yaw, 0, "YXZ")`
  - Pitch clamping between `[-π/2.15, +π/2.15]` to eliminate gimbal flipping.
  - Pointer lock delta smoothing and anomalous spike filtering (`> 250px` discard on lock acquisition).
  - Raycaster aligned directly to `camera.getWorldDirection()` with spherical coordinate spread perturbations for weapons.
- **Audio Pipeline:** 100% procedural Web Audio API audio synthesis engine with zero remote MP3/WAV downloads:
  - White-noise exponential decay buffer generators for gunfire transients.
  - Frequency modulated oscillators with biquad filter sweeps for sub-bass shotgun punch and rifle bursts.
  - Synthetic harmonic bells for hitmarkers and headshot dings.
  - Pitch-diver and pink-noise sweeps for zombie groans and melee attacks.
  - Plasma chirp frequency sweep with resonance filter for Ray Gun projectile discharge.
  - Playful 7-tone cycling jingle with randomized pitch steps for Mystery Box weapon roulette.
  - Ascending 4-tone harmonic arpeggio for Power-Up drops (Max Ammo, Insta-Kill, Nuke, Double Points).
  - Sub-bass seismic detonation rumble with white-noise decay envelope for Nuke smart-bomb clearance.
  - Jingle chimes for perk machine drink purchases (Juggernog and Speed Cola).

---

## 2. 3D Meshes & Visual Asset Manifest

All visual assets and textures in `Zombies3D` are procedurally generated in-browser via Canvas2D pixel buffers and Three.js geometry primitives to guarantee zero network latency, immediate launch under `file://`, and complete self-containment.

| Asset | Type | Generation Technique | Visual Specification | License |
| :--- | :--- | :--- | :--- | :--- |
| **Bunker Floor** | Procedural Texture | 512x512 Canvas2D with speckle noise & aggregate | Industrial tiled concrete slab with expansion seams (`repeat: 10x10`) | MIT / CC0 |
| **Bunker Walls** | Procedural Texture | 512x512 Canvas2D horizontal mortar seams & water stains | Weathered reinforced concrete blockwork with masonry courses (`repeat: 6x2`) | MIT / CC0 |
| **Hazard Pillars** | Procedural Texture | 256x256 Canvas2D angled polygon striping | Diagonal yellow (`#eab308`) and dark slate (`#18181b`) hazard warning bands | MIT / CC0 |
| **Supply Crates** | Procedural Texture | 256x256 Canvas2D wood plank seams & steel brackets | Military cargo crate with corner plates and stenciled `SUPPLY` markings | MIT / CC0 |
| **Zombie Skin** | Procedural Texture | 128x128 Canvas2D rotting green-gray stipple & veins | Decaying necrotic flesh (`#4a5342`) with capillary vein striations | MIT / CC0 |
| **Zombie Clothes** | Procedural Texture | 128x128 Canvas2D ragged fabric & blood splatters | Tattered charcoal jacket with crimson blood stains | MIT / CC0 |
| **Zombie Model** | Articulated Mesh | Hierarchical `THREE.Group` with 5 rotatable joints | Articulated head, torso, shoulder-jointed arms, hip-jointed legs, glowing yellow eyes | MIT / CC0 |
| **M1911 Pistol** | 3D Viewmodel | Multi-mesh group (dark metal slide, walnut grip, sights) | Compact military sidearm attached to camera viewport | MIT / CC0 |
| **Trench Shotgun** | 3D Viewmodel | Multi-mesh group (dual barrel, wooden pump slide, stock) | Heavy close-quarters scattergun with wide pellet spread | MIT / CC0 |
| **Assault Rifle** | 3D Viewmodel | Multi-mesh group (receiver, curved magazine, barrel shroud) | Fully automatic rapid-fire rifle with banana clip | MIT / CC0 |
| **Ray Gun** | 3D Viewmodel | Multi-mesh group (crimson housing, bronze fins, dual barrel prongs) | Wonder weapon firing glowing green plasma spheres with splash damage | MIT / CC0 |
| **Heavy Machine Gun** | 3D Viewmodel | Multi-mesh group (long perforated shroud, large drum magazine, carry handle) | High-capacity suppressive fire automatic weapon | MIT / CC0 |
| **Mystery Box** | 3D Interactive Model | Wooden chest (`2.6m x 0.9m x 0.9m`) with brass corner brackets & glowing `??` symbols | CoD-authentic weapon roulette crate with lid animation and weapon cycling | MIT / CC0 |
| **Juggernog Machine** | 3D Perk Dispenser | Red retro soda vending machine (`1.3m x 2.2m x 1.0m`) with glowing logo & illuminated coin slot | Increases maximum player health from 100 HP to 250 HP (Cost: 2500 pts) | MIT / CC0 |
| **Speed Cola Machine** | 3D Perk Dispenser | Emerald green retro soda vending machine with glowing logo | Cuts reload duration by 50% across all weapons (Cost: 3000 pts) | MIT / CC0 |
| **Power-Up Drops** | 3D Floating Entities | Rotating floating 3D emblems (Max Ammo, Insta-Kill, Nuke, Double Points) | 15% drop rate on zombie elimination, complete with glowing aura rings, 6s despawn blinking, and HUD badge timers | MIT / CC0 |

---

## 3. Upstream Open-Source References & Attribution

- **Three.js Core Library:**
  - **Author:** Ricardo Cabello (mrdoob) and Three.js authors
  - **Repository:** https://github.com/mrdoob/three.js
  - **License:** MIT License
- **FPS Controller Patterns & Inspiration:**
  - PointerLockControls standard patterns from Three.js examples and open-source survival projects (`justinw916-sketch/claude-zombies`, `apoorvdarshan/zombie-game`).
- **Audio Synthesizer Architecture:**
  - Custom Web Audio API procedural synthesis algorithms created for Sigma Webapps (CC0 / Public Domain).

---

## 4. Verification & Testing

- [x] Static inspection confirms the game references the locally bundled Three.js engine and uses procedural Canvas/Web Audio assets; no external game media URLs are required by this implementation.
- [x] `node --check Zombies3D/game.js` passes, and headless Chromium renders the local `file://` entry page and start overlay. Chromium reported software-WebGL fallback/performance warnings during this run.
- [x] Headless Chromium clicked Start, acquired pointer lock, entered round I, and ran for 2.5 seconds with no uncaught browser exceptions. This verifies startup only; 1000-point gate purchase and annex traversal, movement, round-five sprint, barricade repair/breach, hit registration, damage feedback, and restart remain unverified.

# Zombies3D — Game Assets, Architecture & Licensing Manifest

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

- [x] Verified zero external audio/image network requests (fully offline).
- [x] Validated Euler `YXZ` camera rotation in Chromium headless: No sudden gimbal lock, inverted flips, or camera desynchronization.
- [x] Validated pointer lock acquisition/release and window blur listeners (zero stuck keys or runaway sliding).
- [x] Verified articulated zombie walking animation and hit registration across multiple rounds.

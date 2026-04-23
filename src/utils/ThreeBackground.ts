import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from './Constants';

const LANE_COUNT = 3;
const FIELD_WIDTH = 6;       // world units matching ~390px game width
const FIELD_DEPTH = 40;      // how deep the ground stretches
const SCROLL_SPEED = 0.006;  // world units per ms  (roughly matches 120px/s game scroll)
const GAME_ASPECT = 390 / 844;

export interface ThreeFrameSnapshot {
  player?: { x: number; y: number };
  bullets: Array<{ x: number; y: number }>;
  zombies: Array<{ x: number; y: number; type: string; hpPct: number }>;
  barrels: Array<{ x: number; y: number; hpPct: number }>;
  gates: Array<{ x: number; y: number; passed: boolean }>;
}

/** Subtle 3D bird's-eye background rendered by Three.js behind the Phaser canvas. */
export class ThreeBackground {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private groundMesh: THREE.Mesh;
  private laneLines: THREE.LineSegments;
  private roadMarks: THREE.LineSegments;
  private groundPlane: THREE.Plane;
  private raycaster: THREE.Raycaster;
  private tmpVec3: THREE.Vector3;
  private dummy: THREE.Object3D;
  private playerMesh: THREE.Mesh;
  private bulletMesh: THREE.InstancedMesh;
  private zombieMesh: THREE.InstancedMesh;
  private barrelMesh: THREE.InstancedMesh;
  private gateMesh: THREE.InstancedMesh;
  private clock: THREE.Clock;
  private animFrameId: number = 0;
  private onResize: () => void;

  constructor() {
    // ── Renderer ──────────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x10203a, 1);
    const canvas = this.renderer.domElement;
    canvas.id = 'three-bg';
    canvas.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'z-index:0',
      'pointer-events:none',
    ].join(';');
    document.body.insertBefore(canvas, document.body.firstChild);

    // ── Scene ─────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x10203a, 0.045);

    // ── Camera — slight bird's-eye tilt (≈75° from ground) ───────────────────
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
    // position a few units above and slightly "behind" the viewer bottom
    this.camera.position.set(0, 12, 5);
    this.camera.lookAt(0, 0, -6);
    this.scene.add(this.camera);

    // ── Ambient + directional light (for any emissive / lit material) ─────────
    const ambient = new THREE.AmbientLight(0x8bb6ff, 2.8);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.9);
    dirLight.position.set(2, 18, 6);
    this.scene.add(dirLight);

    // ── Ground plane ──────────────────────────────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_DEPTH, 1, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x36445c,
      roughness: 1,
      metalness: 0,
      emissive: 0x17263c,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.set(0, 0, -FIELD_DEPTH / 2 + 5);
    this.scene.add(this.groundMesh);

    // Water planes on both sides of the road for a bridge-like look.
    const waterGeo = new THREE.PlaneGeometry(FIELD_WIDTH * 1.4, FIELD_DEPTH);
    const waterMat = new THREE.MeshBasicMaterial({ color: 0x1d6cb3, transparent: true, opacity: 0.8 });
    for (const side of [-1, 1]) {
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(side * (FIELD_WIDTH * 1.05), -0.05, -FIELD_DEPTH / 2 + 5);
      this.scene.add(water);
    }

    // ── Tiled lane-marker lines ────────────────────────────────────────────────
    this.laneLines = this.buildLaneLines();
    this.scene.add(this.laneLines);
    this.roadMarks = this.buildRoadMarks();
    this.scene.add(this.roadMarks);

    // ── Side edge glow strips ─────────────────────────────────────────────────
    this.buildEdgeStrips();
    this.buildBarrelProps();

    // ── Distant horizon haze plane ────────────────────────────────────────────
    const hazeGeo = new THREE.PlaneGeometry(FIELD_WIDTH * 3, 8);
    const hazeMat = new THREE.MeshBasicMaterial({
      color: 0x1a1a3e,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const hazePlane = new THREE.Mesh(hazeGeo, hazeMat);
    hazePlane.rotation.x = -Math.PI / 2;
    hazePlane.position.set(0, 0.01, -FIELD_DEPTH + 6);
    this.scene.add(hazePlane);

    // ── Clock ─────────────────────────────────────────────────────────────────
    // THREE.Clock is still fine for basic elapsed/delta; Timer is for render-loop use
    this.clock = new THREE.Clock();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.raycaster = new THREE.Raycaster();
    this.tmpVec3 = new THREE.Vector3();
    this.dummy = new THREE.Object3D();
    this.buildGameplayMeshes();

    // ── Resize ────────────────────────────────────────────────────────────────
    this.handleResize();
    this.onResize = () => this.handleResize();
    window.addEventListener('resize', this.onResize);

    // ── Start loop ────────────────────────────────────────────────────────────
    this.loop();
  }

  // ────────────────────────────────────────────────────────────────────────────

  /** Dashed centre dividers + solid outer edges repeating along Z. */
  private buildLaneLines(): THREE.LineSegments {
    const positions: number[] = [];
    const laneW = FIELD_WIDTH / LANE_COUNT;
    const dashLen = 1.2;
    const gapLen = 0.8;
    const totalLen = dashLen + gapLen;
    const segments = Math.ceil(FIELD_DEPTH / totalLen) + 2;
    const zStart = -FIELD_DEPTH + 4;

    for (let li = 1; li < LANE_COUNT; li++) {
      const x = -FIELD_WIDTH / 2 + laneW * li;
      for (let s = 0; s < segments; s++) {
        const z0 = zStart + s * totalLen;
        const z1 = z0 + dashLen;
        positions.push(x, 0.01, z0, x, 0.01, z1);
      }
    }

    // Outer solid edges
    positions.push(
      -FIELD_WIDTH / 2, 0.01, zStart,  -FIELD_WIDTH / 2, 0.01, 6,
       FIELD_WIDTH / 2, 0.01, zStart,   FIELD_WIDTH / 2, 0.01, 6,
    );

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffee, transparent: true, opacity: 0.25 });
    return new THREE.LineSegments(geo, mat);
  }

  /** Thin emissive strips along the long edges — purely decorative glow. */
  private buildEdgeStrips(): void {
    const stripGeo = new THREE.PlaneGeometry(0.08, FIELD_DEPTH);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x00ffee, transparent: true, opacity: 0.35 });

    for (const xSide of [-FIELD_WIDTH / 2, FIELD_WIDTH / 2]) {
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(xSide, 0.02, -FIELD_DEPTH / 2 + 5);
      this.scene.add(strip);
    }
  }

  private buildRoadMarks(): THREE.LineSegments {
    const positions: number[] = [];
    const zStart = -FIELD_DEPTH + 4;
    const markLen = 1;
    const gapLen = 1.8;
    const segments = Math.ceil(FIELD_DEPTH / (markLen + gapLen)) + 2;
    for (let i = 0; i < segments; i++) {
      const z0 = zStart + i * (markLen + gapLen);
      const z1 = z0 + markLen;
      positions.push(0, 0.015, z0, 0, 0.015, z1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true }));
  }

  private buildBarrelProps(): void {
    const barrelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.28, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x9a5a2a, roughness: 0.8, metalness: 0.1 });
    for (let i = 0; i < 18; i++) {
      const z = -3 - i * 2.1;
      for (const side of [-1, 1]) {
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(side * (FIELD_WIDTH / 2 + 0.35), 0.14, z + (Math.random() - 0.5) * 0.5);
        this.scene.add(barrel);
      }
    }
  }

  private buildGameplayMeshes(): void {
    this.playerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x5bfff2, emissive: 0x1a7770, metalness: 0.25, roughness: 0.35 })
    );
    this.playerMesh.visible = false;
    this.scene.add(this.playerMesh);

    this.bulletMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff37a }),
      512
    );
    this.bulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bulletMesh.count = 0;
    this.scene.add(this.bulletMesh);

    this.zombieMesh = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.16, 0.34, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, vertexColors: true }),
      220
    );
    this.zombieMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.zombieMesh.count = 0;
    this.scene.add(this.zombieMesh);

    this.barrelMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.24, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, vertexColors: true }),
      96
    );
    this.barrelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.barrelMesh.count = 0;
    this.scene.add(this.barrelMesh);

    this.gateMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.6, 0.45, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.2, vertexColors: true }),
      64
    );
    this.gateMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gateMesh.count = 0;
    this.scene.add(this.gateMesh);
  }

  private screenToGround(x: number, y: number): THREE.Vector3 {
    const ndcX = (x / GAME_WIDTH) * 2 - 1;
    const ndcY = -(y / GAME_HEIGHT) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, this.tmpVec3);
    return this.tmpVec3;
  }

  syncEntities(frame: ThreeFrameSnapshot): void {
    if (frame.player) {
      const p = this.screenToGround(frame.player.x, frame.player.y);
      this.playerMesh.visible = true;
      this.playerMesh.position.set(p.x, 0.22, p.z);
    } else {
      this.playerMesh.visible = false;
    }

    let i = 0;
    for (const b of frame.bullets) {
      if (i >= 512) break;
      const p = this.screenToGround(b.x, b.y);
      this.dummy.position.set(p.x, 0.12, p.z);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.bulletMesh.setMatrixAt(i++, this.dummy.matrix);
    }
    this.bulletMesh.count = i;
    this.bulletMesh.instanceMatrix.needsUpdate = true;

    i = 0;
    for (const z of frame.zombies) {
      if (i >= 220) break;
      const p = this.screenToGround(z.x, z.y);
      const scale = z.type === 'boss_zombie' ? 1.35 : z.type === 'giant_zombie' ? 1.2 : 1;
      this.dummy.position.set(p.x, 0.25, p.z);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      this.zombieMesh.setMatrixAt(i++, this.dummy.matrix);
      const zombieColor = z.type === 'boss_zombie' ? 0xcc55ff :
        z.type === 'giant_zombie' ? 0xff5a5a :
        z.type === 'runner_zombie' ? 0xff9a40 :
        z.type === 'armored_zombie' ? 0xc0c6d9 : 0x6cff6c;
      this.zombieMesh.setColorAt(i - 1, new THREE.Color(zombieColor));
    }
    this.zombieMesh.count = i;
    this.zombieMesh.instanceMatrix.needsUpdate = true;
    if (this.zombieMesh.instanceColor) this.zombieMesh.instanceColor.needsUpdate = true;

    i = 0;
    for (const b of frame.barrels) {
      if (i >= 96) break;
      const p = this.screenToGround(b.x, b.y);
      this.dummy.position.set(p.x, 0.14, p.z);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.barrelMesh.setMatrixAt(i++, this.dummy.matrix);
      const healthTint = Math.max(0, Math.min(1, b.hpPct));
      const c = new THREE.Color(1, 0.45 + healthTint * 0.35, 0.12);
      this.barrelMesh.setColorAt(i - 1, c);
    }
    this.barrelMesh.count = i;
    this.barrelMesh.instanceMatrix.needsUpdate = true;
    if (this.barrelMesh.instanceColor) this.barrelMesh.instanceColor.needsUpdate = true;

    i = 0;
    for (const g of frame.gates) {
      if (g.passed) continue;
      if (i >= 64) break;
      const lp = this.screenToGround(g.x - 55, g.y);
      this.dummy.position.set(lp.x, 0.23, lp.z);
      this.dummy.scale.set(0.6, 0.8, 1);
      this.dummy.updateMatrix();
      this.gateMesh.setMatrixAt(i++, this.dummy.matrix);
      this.gateMesh.setColorAt(i - 1, new THREE.Color(0x42ff86));
      if (i >= 64) break;
      const rp = this.screenToGround(g.x + 55, g.y);
      this.dummy.position.set(rp.x, 0.23, rp.z);
      this.dummy.updateMatrix();
      this.gateMesh.setMatrixAt(i++, this.dummy.matrix);
      this.gateMesh.setColorAt(i - 1, new THREE.Color(0x4da3ff));
    }
    this.gateMesh.count = i;
    this.gateMesh.instanceMatrix.needsUpdate = true;
    if (this.gateMesh.instanceColor) this.gateMesh.instanceColor.needsUpdate = true;
  }

  // ────────────────────────────────────────────────────────────────────────────

  private handleResize(): void {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Match Phaser's portrait fit area so the 3D lane and 2D gameplay share one space.
    let renderW = viewportW;
    let renderH = renderW / GAME_ASPECT;
    if (renderH > viewportH) {
      renderH = viewportH;
      renderW = renderH * GAME_ASPECT;
    }

    const offsetX = Math.floor((viewportW - renderW) / 2);
    const offsetY = Math.floor((viewportH - renderH) / 2);

    this.renderer.setSize(renderW, renderH, false);
    this.renderer.domElement.style.width = `${Math.floor(renderW)}px`;
    this.renderer.domElement.style.height = `${Math.floor(renderH)}px`;
    this.renderer.domElement.style.left = `${offsetX}px`;
    this.renderer.domElement.style.top = `${offsetY}px`;
    this.camera.aspect = renderW / renderH;
    this.camera.updateProjectionMatrix();
  }

  private loop = (): void => {
    this.animFrameId = requestAnimationFrame(this.loop);
    const delta = this.clock.getDelta() * 1000; // ms

    // Scroll lane lines forward (camera-relative illusion of movement)
    const scroll = SCROLL_SPEED * delta;
    this.laneLines.position.z += scroll;
    this.roadMarks.position.z += scroll;
    // Wrap when a full tile has scrolled past
    const tileSize = 1.2 + 0.8; // dashLen + gapLen
    if (this.laneLines.position.z > tileSize) {
      this.laneLines.position.z -= tileSize;
    }
    if (this.roadMarks.position.z > tileSize) {
      this.roadMarks.position.z -= tileSize;
    }

    // Subtle slow camera sway (breathes life into the scene)
    const t = this.clock.elapsedTime;
    this.camera.position.x = Math.sin(t * 0.18) * 0.18;

    this.renderer.render(this.scene, this.camera);
  };

  destroy(): void {
    cancelAnimationFrame(this.animFrameId);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    window.removeEventListener('resize', this.onResize);
  }
}

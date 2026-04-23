import * as THREE from 'three';

const LANE_COUNT = 3;
const FIELD_WIDTH = 6;       // world units matching ~390px game width
const FIELD_DEPTH = 40;      // how deep the ground stretches
const SCROLL_SPEED = 0.006;  // world units per ms  (roughly matches 120px/s game scroll)

/** Subtle 3D bird's-eye background rendered by Three.js behind the Phaser canvas. */
export class ThreeBackground {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private groundMesh: THREE.Mesh;
  private laneLines: THREE.LineSegments;
  private clock: THREE.Clock;
  private animFrameId: number = 0;
  private onResize: () => void;

  constructor() {
    // ── Renderer ──────────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0d0d1a, 1);
    const canvas = this.renderer.domElement;
    canvas.id = 'three-bg';
    canvas.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'z-index:0',
      'pointer-events:none',
    ].join(';');
    document.body.insertBefore(canvas, document.body.firstChild);

    // ── Scene ─────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0d0d1a, 0.06);

    // ── Camera — slight bird's-eye tilt (≈75° from ground) ───────────────────
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
    // position a few units above and slightly "behind" the viewer bottom
    this.camera.position.set(0, 12, 5);
    this.camera.lookAt(0, 0, -6);
    this.scene.add(this.camera);

    // ── Ambient + directional light (for any emissive / lit material) ─────────
    const ambient = new THREE.AmbientLight(0x222244, 2.5);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0x4466ff, 1.2);
    dirLight.position.set(0, 15, 5);
    this.scene.add(dirLight);

    // ── Ground plane ──────────────────────────────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_DEPTH, 1, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 1,
      metalness: 0,
      emissive: 0x050510,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.set(0, 0, -FIELD_DEPTH / 2 + 5);
    this.scene.add(this.groundMesh);

    // ── Tiled lane-marker lines ────────────────────────────────────────────────
    this.laneLines = this.buildLaneLines();
    this.scene.add(this.laneLines);

    // ── Side edge glow strips ─────────────────────────────────────────────────
    this.buildEdgeStrips();

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

  // ────────────────────────────────────────────────────────────────────────────

  private handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = (): void => {
    this.animFrameId = requestAnimationFrame(this.loop);
    const delta = this.clock.getDelta() * 1000; // ms

    // Scroll lane lines forward (camera-relative illusion of movement)
    const scroll = SCROLL_SPEED * delta;
    this.laneLines.position.z += scroll;
    // Wrap when a full tile has scrolled past
    const tileSize = 1.2 + 0.8; // dashLen + gapLen
    if (this.laneLines.position.z > tileSize) {
      this.laneLines.position.z -= tileSize;
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

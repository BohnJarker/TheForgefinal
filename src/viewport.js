import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class CADViewport {
  constructor(container, { onSelect, onStatus } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.onStatus = onStatus;
    this.bodies = new Map();
    this.showGrid = true;
    this.showEdges = true;
    this.selected = null;
    this.section = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#edf1f5");
    this.camera = new THREE.OrthographicCamera(
      -100,
      100,
      100,
      -100,
      0.01,
      100000,
    );
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(145, -180, 145);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.renderer.domElement.addEventListener(
      "pointerdown",
      (e) => {
        this.controls.mouseButtons.LEFT =
          e.ctrlKey && e.shiftKey
            ? THREE.MOUSE.ROTATE
            : e.ctrlKey && e.altKey
              ? THREE.MOUSE.PAN
              : null;
      },
      true,
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = true;
    this.controls.minZoom = 0.01;
    this.controls.maxZoom = 500;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x748498, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    key.position.set(-150, -200, 300);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xbed5f6, 1.1);
    fill.position.set(200, 100, 180);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.7);
    rim.position.set(-100, 200, 100);
    this.scene.add(rim);
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);
    this.gridGroup = new THREE.Group();
    this.scene.add(this.gridGroup);
    this.makeGrid(300, 30);
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(10, 10);
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      const r = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
    });
    this.renderer.domElement.addEventListener("pointerleave", () =>
      this.pointer.set(10, 10),
    );
    let down = null;
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      if (e.button === 0) down = { x: e.clientX, y: e.clientY };
    });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (!down || e.button !== 0) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 4) return;
      const r = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        this.camera,
      );
      const hits = this.raycaster.intersectObjects(
        [...this.bodies.values()]
          .filter((g) => g.visible)
          .map((g) => g.userData.mesh),
        false,
      );
      const hit = hits.find(
        (h) => !this.section || this.clipPlane.distanceToPoint(h.point) >= 0,
      );
      this.onSelect?.(hit?.object.userData.bodyId || null, e.shiftKey);
    });
    this.renderer.domElement.addEventListener("contextmenu", (e) =>
      e.preventDefault(),
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.animate();
  }
  makeGrid(size, divisions) {
    this.clearGroup(this.gridGroup);
    const grid = new THREE.GridHelper(size, divisions, 0xc1cdd9, 0xd6dfe8);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.12;
    grid.material.transparent = true;
    grid.material.opacity = 0.6;
    this.gridGroup.add(grid);
    const axisMaterial = new THREE.LineBasicMaterial({
      color: 0xbccad9,
      transparent: true,
      opacity: 0.55,
    });
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-size / 2, 0, -0.1),
      new THREE.Vector3(size / 2, 0, -0.1),
      new THREE.Vector3(0, -size / 2, -0.1),
      new THREE.Vector3(0, size / 2, -0.1),
    ]);
    this.gridGroup.add(new THREE.LineSegments(g, axisMaterial));
    this.gridGroup.visible = this.showGrid;
  }
  clearGroup(group) {
    while (group.children.length) {
      const obj = group.children[0];
      group.remove(obj);
      obj.traverse((x) => {
        x.geometry?.dispose();
        if (Array.isArray(x.material)) x.material.forEach((m) => m.dispose());
        else x.material?.dispose();
      });
    }
  }
  setBodies(bodies) {
    this.clearGroup(this.modelGroup);
    this.bodies.clear();
    for (const b of bodies) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(b.mesh.vertices, 3),
      );
      geometry.setIndex(b.mesh.triangles);
      if (b.mesh.normals?.length)
        geometry.setAttribute(
          "normal",
          new THREE.Float32BufferAttribute(b.mesh.normals, 3),
        );
      else geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb9c5d2,
        metalness: 0.25,
        roughness: 0.42,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        clippingPlanes: this.section ? [this.clipPlane] : [],
      });
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.userData.bodyId = b.id;
      const group = new THREE.Group();
      group.add(mesh);
      let lines;
      if (b.edges?.lines?.length) {
        const eg = new THREE.BufferGeometry();
        eg.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(b.edges.lines, 3),
        );
        lines = new THREE.LineSegments(
          eg,
          new THREE.LineBasicMaterial({
            color: 0x63738a,
            transparent: true,
            opacity: 0.68,
            clippingPlanes: this.section ? [this.clipPlane] : [],
          }),
        );
      } else {
        lines = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry, 25),
          new THREE.LineBasicMaterial({
            color: 0x63738a,
            transparent: true,
            opacity: 0.68,
          }),
        );
      }
      lines.visible = this.showEdges;
      group.add(lines);
      group.userData = { mesh, lines, id: b.id, bounds: b.bounds };
      this.modelGroup.add(group);
      this.bodies.set(b.id, group);
    }
    this.select(this.selected);
    this.updateClipping();
  }
  select(id) {
    this.selected = id;
    for (const [bodyId, g] of this.bodies) {
      const selected = Array.isArray(id) ? id.includes(bodyId) : id === bodyId;
      g.userData.mesh.material.color.setHex(selected ? 0xb8cce4 : 0xb9c5d2);
      g.userData.lines.material.color.setHex(selected ? 0x317bc7 : 0x607289);
      g.userData.lines.material.opacity = selected ? 0.88 : 0.65;
    }
  }
  modelBounds() {
    const box = new THREE.Box3();
    for (const g of this.bodies.values()) if (g.visible) box.expandByObject(g);
    return box;
  }
  fit() {
    const box = this.modelBounds();
    if (box.isEmpty()) {
      this.controls.target.set(0, 0, 0);
      this.span = 160;
    } else {
      const c = box.getCenter(new THREE.Vector3()),
        s = box.getSize(new THREE.Vector3());
      this.controls.target.copy(c);
      this.span = Math.max(50, s.length() * 1.55);
      const direction = this.camera.position
        .clone()
        .sub(this.controls.target)
        .normalize();
      if (direction.length() < 0.5) direction.set(1, -1, 1).normalize();
      this.camera.position.copy(c).addScaledVector(direction, this.span * 3);
      this.makeGrid(
        Math.max(200, Math.ceil(Math.max(s.x, s.y) / 100) * 300),
        30,
      );
    }
    this.camera.zoom = 1;
    this.resize();
    this.controls.update();
  }
  setView(view) {
    const dir = {
      iso: [1, -1.5, 1.15],
      top: [0, 0, 1],
      front: [0, -1, 0],
      right: [1, 0, 0],
      back: [0, 1, 0],
      bottom: [0, 0, -1],
      left: [-1, 0, 0],
    }[view] || [1, -1.5, 1.15];
    const horizontal = view === "top" || view === "bottom";
    this.camera.up.set(0, horizontal ? 1 : 0, horizontal ? 0 : 1);
    this.camera.position
      .copy(this.controls.target)
      .add(
        new THREE.Vector3(...dir)
          .normalize()
          .multiplyScalar((this.span || 160) * 3),
      );
    this.controls.update();
  }
  zoomToFace() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      [...this.bodies.values()]
        .filter((g) => g.visible)
        .map((g) => g.userData.mesh),
      false,
    );
    const hit = hits.find(
      (h) => !this.section || this.clipPlane.distanceToPoint(h.point) >= 0,
    );
    if (!hit) return false;
    const normal = hit.face.normal
      .clone()
      .transformDirection(hit.object.matrixWorld);
    const box = new THREE.Box3().setFromObject(hit.object),
      size = box.getSize(new THREE.Vector3());
    this.controls.target.copy(hit.point);
    this.span = Math.max(20, size.length() * 1.15);
    this.camera.zoom = 1;
    this.camera.up.set(
      0,
      Math.abs(normal.z) > 0.95 ? 1 : 0,
      Math.abs(normal.z) > 0.95 ? 0 : 1,
    );
    this.camera.position.copy(hit.point).addScaledVector(normal, this.span * 3);
    this.resize();
    this.controls.update();
    return true;
  }
  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.gridGroup.visible = this.showGrid;
    return this.showGrid;
  }
  toggleEdges() {
    this.showEdges = !this.showEdges;
    for (const g of this.bodies.values())
      g.userData.lines.visible = this.showEdges;
    return this.showEdges;
  }
  setVisible(id, visible) {
    const g = this.bodies.get(id);
    if (g) g.visible = visible;
  }
  updateClipping() {
    const b = this.modelBounds();
    if (!b.isEmpty())
      this.clipPlane.constant = b.getCenter(new THREE.Vector3()).y;
  }
  setSection(enabled) {
    this.section = enabled;
    this.updateClipping();
    for (const g of this.bodies.values()) {
      for (const m of [g.userData.mesh.material, g.userData.lines.material]) {
        m.clippingPlanes = enabled ? [this.clipPlane] : [];
        m.needsUpdate = true;
      }
    }
    this.onStatus?.(
      enabled ? "Section view · visual clipping only" : "Design up to date",
    );
  }
  setBed(printer) {
    if (this.bed) {
      this.scene.remove(this.bed);
      this.clearGroup(this.bed);
      this.bed = null;
    }
    if (!printer) return;
    const { width: w, depth: d, height: h } = printer;
    const group = new THREE.Group();
    const geom = new THREE.BoxGeometry(w, d, h);
    const edge = new THREE.EdgesGeometry(geom);
    geom.dispose();
    const box = new THREE.LineSegments(
      edge,
      new THREE.LineDashedMaterial({
        color: 0x8ba9c7,
        dashSize: 3,
        gapSize: 3,
        transparent: true,
        opacity: 0.65,
      }),
    );
    box.position.z = h / 2;
    box.computeLineDistances();
    group.add(box);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({
        color: 0xc4d8ec,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    plane.position.z = -0.18;
    group.add(plane);
    this.scene.add(group);
    this.bed = group;
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (!w || !h) return;
    const aspect = w / h,
      span = this.span || 180;
    this.camera.left = (-span * aspect) / 2;
    this.camera.right = (span * aspect) / 2;
    this.camera.top = span / 2;
    this.camera.bottom = -span / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  animate() {
    this.frame = requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.clearGroup(this.modelGroup);
    this.clearGroup(this.gridGroup);
    if (this.bed) this.clearGroup(this.bed);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

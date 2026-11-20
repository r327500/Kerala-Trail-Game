import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const mapRoot = document.getElementById('keralaLiveMap');
const tripStops = [
  { name: 'Thiruvananthapuram', coords: [76.9366, 8.5241] },
  { name: 'Varkala', coords: [76.7163, 8.7379] },
  { name: 'Alappuzha', coords: [76.3388, 9.4981] },
  { name: 'Kochi', coords: [76.2799, 9.9816] },
  { name: 'Munnar', coords: [77.0595, 10.0889] },
  { name: 'Kozhikode', coords: [75.7804, 11.2588] },
  { name: 'Wayanad', coords: [76.083, 11.605] },
];

if (mapRoot && window.maplibregl) {
  const liveMap = document.querySelector('.land');
  const mapHint = document.querySelector('.maphint');
  const loading = mapRoot.querySelector('.liveMapLoading');
  const failed = mapRoot.querySelector('.liveMapFailed');
  const savedHint = mapHint?.textContent || '';
  let map;
  let mapReady = false;
  let pendingJourney;
  let activeStop = 0;
  let desiredStop = 0;
  let journeyReady = false;
  let ride = null;
  let routeCoordinates = [];
  let routeRequestId = 0;
  let tripLayer;
  let shownFallback = false;
  let currentVehicle = 'bike';
  let currentRider = 'Traveler';

  function showDiorama(reason) {
    if (shownFallback) return;
    shownFallback = true;
    mapRoot.style.display = 'none';
    const diorama = document.getElementById('kerala3d');
    if (diorama) diorama.style.display = 'block';
    if (loading) loading.style.display = 'none';
    if (mapHint) mapHint.textContent = reason || 'SCENIC MAP · DRAG TO ROTATE';
    const modeButton = document.getElementById('mapMode');
    if (modeButton) modeButton.textContent = '🎨 SCENIC 3D';
    window.dispatchEvent(new Event('resize'));
  }

  function setHint(text) {
    if (!shownFallback && mapHint) mapHint.textContent = text;
  }

  function clearDriveInput() {
    driveKeys.clear();
    driveHud?.querySelectorAll('.active').forEach((button) => button.classList.remove('active'));
  }

  function showDriveHud(show) {
    if (!driveHud) return;
    driveHud.hidden = !show;
    if (!show) {
      clearDriveInput();
      driveSpeed = 0;
      if (driveSpeedReadout) driveSpeedReadout.textContent = '0';
    }
  }

  const driveKeys = new Set();
  const controlForKey = new Map([
    ['w', 'accelerate'], ['arrowup', 'accelerate'],
    ['s', 'brake'], ['arrowdown', 'brake'],
    ['a', 'left'], ['arrowleft', 'left'],
    ['d', 'right'], ['arrowright', 'right'],
  ]);
  let driveHud;
  let driveSpeedReadout;
  let driveMessage;
  let driveSpeed = 0;

  function createDriveHud() {
    if (driveHud) return;
    driveHud = document.createElement('div');
    driveHud.className = 'kerala-drive-hud';
    driveHud.hidden = true;
    driveHud.innerHTML = `<div class="kerala-drive-readout"><strong id="keralaDriveSpeed">0</strong><span>km/h</span><small id="keralaDriveMessage">HOLD W / ↑ OR ▲ TO DRIVE</small></div><div class="kerala-drive-controls"><button data-drive-control="left" aria-label="Steer left">◀</button><button data-drive-control="brake" aria-label="Brake">▼</button><button data-drive-control="accelerate" aria-label="Accelerate">▲</button><button data-drive-control="right" aria-label="Steer right">▶</button></div>`;
    const style = document.createElement('style');
    style.textContent = `
      .kerala-drive-hud{position:absolute;z-index:15;left:50%;bottom:45px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:6px;border:1px solid #ffffffd8;border-radius:16px;background:#fffdf0eF;box-shadow:0 4px 14px #234e3c35;touch-action:none}
      .kerala-drive-hud[hidden]{display:none}
      .kerala-drive-readout{min-width:57px;text-align:center;color:#315d48;line-height:1}
      .kerala-drive-readout strong{font:1000 17px Nunito,system-ui,sans-serif}
      .kerala-drive-readout span{font:900 8px Nunito,system-ui,sans-serif;margin-left:3px}
      .kerala-drive-readout small{display:block;max-width:110px;margin-top:4px;font:900 7px/1.2 Nunito,system-ui,sans-serif;letter-spacing:.2px;color:#748278}
      .kerala-drive-controls{display:flex;gap:5px}
      .kerala-drive-controls button{width:37px;height:37px;border:1px solid #e4dfd1;border-radius:11px;background:linear-gradient(#fff,#f1f5e9);color:#355f4a;font:1000 15px system-ui,sans-serif;box-shadow:0 2px 0 #d7ddcf;touch-action:none;user-select:none;-webkit-user-select:none}
      .kerala-drive-controls button.active{background:linear-gradient(#f8cd66,#efa64a);transform:translateY(2px);box-shadow:none}
      @media(min-width:681px){.kerala-drive-hud{bottom:43px}.kerala-drive-controls button{width:40px;height:38px}}
    `;
    document.head.appendChild(style);
    liveMap?.appendChild(driveHud);
    window.keralaManualDriving = true;
    driveSpeedReadout = driveHud.querySelector('#keralaDriveSpeed');
    driveMessage = driveHud.querySelector('#keralaDriveMessage');
    driveHud.querySelectorAll('[data-drive-control]').forEach((button) => {
      const key = button.dataset.driveControl;
      const press = (event) => {
        if (!ride) return;
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        driveKeys.add(key);
        button.classList.add('active');
      };
      const release = (event) => {
        event.preventDefault();
        driveKeys.delete(key);
        button.classList.remove('active');
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
  }

  createDriveHud();
  window.addEventListener('keydown', (event) => {
    if (!ride) return;
    if (document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    const action = controlForKey.get(event.key.toLowerCase());
    if (!action) return;
    event.preventDefault();
    driveKeys.add(action);
  });
  window.addEventListener('keyup', (event) => {
    const action = controlForKey.get(event.key.toLowerCase());
    if (action) driveKeys.delete(action);
  });
  window.addEventListener('blur', clearDriveInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearDriveInput(); });

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function bearingBetween(a, b) {
    const toRad = Math.PI / 180;
    const lat1 = a[1] * toRad, lat2 = b[1] * toRad;
    const dLng = (b[0] - a[0]) * toRad;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function coordinateAtDistance(points, fraction) {
    if (points.length < 2) return points[0] || tripStops[0].coords;
    const lengths = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = (points[i][0] - points[i - 1][0]) * Math.cos(points[i][1] * Math.PI / 180);
      const dy = points[i][1] - points[i - 1][1];
      const d = Math.hypot(dx, dy);
      lengths.push(d);
      total += d;
    }
    let left = total * clamp(fraction, 0, 1);
    for (let i = 0; i < lengths.length; i++) {
      if (left <= lengths[i] || i === lengths.length - 1) {
        const t = lengths[i] > 0 ? left / lengths[i] : 0;
        return [
          points[i][0] + (points[i + 1][0] - points[i][0]) * t,
          points[i][1] + (points[i + 1][1] - points[i][1]) * t,
        ];
      }
      left -= lengths[i];
    }
    return points[points.length - 1];
  }

  function lineFeature(points) {
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: points.length > 1 ? points : [tripStops[0].coords, tripStops[1].coords] },
    };
  }

  function makeMat(color, roughness = 0.68, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function addBox(group, size, position, material, name) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (name) mesh.name = name;
    group.add(mesh);
    return mesh;
  }

  function addLimb(group, start, end, radius, material) {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const direction = to.clone().sub(from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius, direction.length(), 10), material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }

  function makeRider(name, sitting = true) {
    const root = new THREE.Group();
    const skin = makeMat(0xb97859, 0.78);
    const shirt = makeMat(0x1f846d, 0.72);
    const pants = makeMat(0x31445a, 0.83);
    const dark = makeMat(0x2b2b2b, 0.48);
    const cream = makeMat(0xf0e5d1, 0.62);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 7, 12), shirt);
    body.position.set(0, 1.02, sitting ? -0.08 : 0);
    if (sitting) body.rotation.x = -0.42;
    body.castShadow = true;
    root.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), skin);
    head.position.set(0, 1.49, sitting ? -0.13 : 0.03);
    head.castShadow = true;
    root.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.177, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), dark);
    hair.position.set(0, 1.54, sitting ? -0.13 : 0.02);
    root.add(hair);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), makeMat(0xffc542, 0.28, 0.1));
    helmet.scale.set(1.14, 0.76, 1.15);
    helmet.position.copy(hair.position);
    helmet.position.y += 0.055;
    root.add(helmet);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.16), makeMat(0x506a73, 0.2, 0.24));
    visor.position.set(0, 1.49, sitting ? 0.035 : 0.19);
    root.add(visor);

    const legZ = sitting ? -0.08 : 0;
    for (const side of [-1, 1]) {
      const armStart = [side * 0.16, 1.22, sitting ? -0.04 : 0.02];
      const armMid = [side * 0.27, 1.02, sitting ? 0.25 : 0.02];
      const hand = [side * 0.29, 0.94, sitting ? 0.5 : 0.02];
      addLimb(root, armStart, armMid, 0.068, shirt);
      addLimb(root, armMid, hand, 0.045, skin);
      const knee = [side * 0.15, 0.59, legZ + (sitting ? 0.24 : 0)];
      const ankle = [side * 0.19, 0.22, legZ + (sitting ? 0.39 : 0.02)];
      addLimb(root, [side * 0.12, 0.77, legZ], knee, 0.075, pants);
      addLimb(root, knee, ankle, 0.055, pants);
      addBox(root, [0.12, 0.08, 0.22], [side * 0.19, 0.17, ankle[2] + 0.04], dark);
    }
    addBox(root, [0.34, 0.08, 0.07], [0, 0.14, sitting ? 0.39 : 0], cream, `name:${name}`);
    root.scale.setScalar(0.92);
    return root;
  }

  function makeBike() {
    const bike = new THREE.Group();
    const tire = makeMat(0x202427, 0.9);
    const metal = makeMat(0x899795, 0.3, 0.48);
    const body = makeMat(0xc44436, 0.35, 0.08);
    for (const z of [-0.76, 0.76]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 9, 22), tire);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(0, 0.38, z);
      wheel.userData.rollingWheel = true;
      wheel.userData.wheelAxis = 'x';
      bike.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.11, 14), metal);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(0, 0.38, z);
      bike.add(hub);
    }
    addBox(bike, [0.27, 0.27, 0.48], [0, 0.66, 0.05], body);
    addBox(bike, [0.33, 0.09, 0.43], [0, 0.88, -0.24], makeMat(0x272b2e, 0.45));
    addBox(bike, [0.23, 0.12, 0.27], [0, 0.95, 0.12], makeMat(0xf2b74c, 0.3, 0.1));
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.64, 10), metal);
    fork.position.set(0, 0.68, 0.61);
    fork.rotation.x = -0.18;
    bike.add(fork);
    addBox(bike, [0.48, 0.045, 0.06], [0, 1.02, 0.52], metal);
    addBox(bike, [0.12, 0.12, 0.08], [0, 0.81, 0.82], makeMat(0xffefad, 0.2, 0.05));
    bike.add(makeRider(currentRider));
    return bike;
  }

  function makeCar() {
    const car = new THREE.Group();
    const paint = makeMat(0x258c69, 0.32, 0.08);
    const trim = makeMat(0x22292b, 0.68);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9bd7df, metalness: 0.16, roughness: 0.2, transparent: true, opacity: 0.56 });
    addBox(car, [1.5, 0.45, 2.48], [0, 0.53, 0], paint);
    addBox(car, [1.42, 0.22, 0.72], [0, 0.78, 0.72], paint);
    addBox(car, [1.3, 0.18, 0.5], [0, 0.76, -0.91], paint);
    addBox(car, [1.18, 0.55, 1.22], [0, 1.04, -0.2], trim);
    addBox(car, [1.08, 0.4, 0.035], [0, 1.08, 0.43], glass);
    addBox(car, [1.08, 0.39, 0.035], [0, 1.08, -0.82], glass);
    for (const side of [-1, 1]) {
      addBox(car, [0.035, 0.37, 0.86], [side * 0.594, 1.08, -0.2], glass);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.17, 16), trim);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.72, 0.33, 0.82);
      wheel.userData.rollingWheel = true;
      wheel.userData.wheelAxis = 'x';
      car.add(wheel);
      const rearWheel = wheel.clone();
      rearWheel.position.z = -0.82;
      car.add(rearWheel);
      addBox(car, [0.13, 0.09, 0.04], [side * 0.52, 0.75, 1.105], makeMat(0xffefb7, 0.22, 0.05));
    }
    addBox(car, [1.48, 0.1, 0.08], [0, 0.39, 1.25], trim);
    addBox(car, [1.48, 0.1, 0.08], [0, 0.39, -1.25], trim);
    const driver = makeRider(currentRider);
    driver.scale.setScalar(0.5);
    driver.position.set(-0.12, 0.25, -0.28);
    car.add(driver);
    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 18), makeMat(0x313536, 0.42));
    steering.position.set(-0.12, 0.77, 0.43);
    steering.rotation.x = 0.32;
    car.add(steering);
    return car;
  }

  function makeAutoFallback() {
    const auto = new THREE.Group();
    addBox(auto, [1.16, 0.46, 1.82], [0, 0.68, 0], makeMat(0x17201e, 0.62));
    addBox(auto, [1.2, 0.76, 1.7], [0, 1.25, -0.08], makeMat(0xf4bd2d, 0.4, 0.04));
    addBox(auto, [1.08, 0.38, 0.06], [0, 1.26, 0.79], makeMat(0x94d6da, 0.22, 0.12));
    const wheel = makeMat(0x222729, 0.92);
    for (const [x, z] of [[-0.53, -0.55], [0.53, -0.55], [0, 0.74]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.15, 14), wheel);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.3, z);
      auto.add(w);
    }
    const rider = makeRider(currentRider);
    rider.scale.setScalar(0.5);
    rider.position.set(0, 0.5, 0.2);
    auto.add(rider);
    return auto;
  }

  function makeBus() {
    const bus = new THREE.Group();
    const yellow = makeMat(0xe6ab3f, 0.4, 0.04);
    const glass = makeMat(0x78bac5, 0.25, 0.12);
    addBox(bus, [1.55, 1.42, 3.1], [0, 1.15, 0], yellow);
    addBox(bus, [1.35, 0.62, 0.04], [0, 1.49, 1.57], glass);
    addBox(bus, [1.36, 0.58, 0.04], [0, 1.47, -1.57], glass);
    for (const side of [-1, 1]) for (const z of [-0.95, -0.12, 0.71]) {
      addBox(bus, [0.04, 0.56, 0.58], [side * 0.785, 1.5, z], glass);
    }
    const tire = makeMat(0x202427, 0.92);
    for (const side of [-1, 1]) for (const z of [-0.98, 1.02]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12), tire);
      w.rotation.z = Math.PI / 2;
      w.position.set(side * 0.76, 0.35, z);
      bus.add(w);
    }
    const driver = makeRider(currentRider, false);
    driver.scale.setScalar(0.46);
    driver.position.set(0.27, 0.24, 0.87);
    bus.add(driver);
    return bus;
  }

  function fitAsset(model, targetLength = 2.5) {
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z) || 1;
    model.scale.multiplyScalar(targetLength / longest);
    model.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(model);
    const center = scaled.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaled.min.y;
  }

  class KeralaRideLayer {
    id = 'kerala-trip-rider';
    type = 'custom';
    renderingMode = '3d';
    constructor() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.Camera();
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x584738, 2.1));
      const sunlight = new THREE.DirectionalLight(0xfff1d1, 3.2);
      sunlight.position.set(-40, 80, 70);
      this.scene.add(sunlight);
      this.anchor = new THREE.Group();
      this.anchor.name = 'traveller-and-ride';
      this.scene.add(this.anchor);
      this.vehicleModel = null;
      this.loadedAuto = null;
      this.renderer = null;
      this.currentCoords = tripStops[0].coords.slice();
      this.heading = 0;
      this.bob = 0;
    }
    onAdd(mapInstance, gl) {
      this.map = mapInstance;
      this.renderer = new THREE.WebGLRenderer({ canvas: mapInstance.getCanvas(), context: gl, antialias: true, alpha: true });
      this.renderer.autoClear = false;
      this.renderer.setPixelRatio(1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      new GLTFLoader().load('kerala-trial-auto-rickshaw.glb', (gltf) => {
        this.loadedAuto = gltf.scene;
        fitAsset(this.loadedAuto, 2.3);
        if (currentVehicle === 'auto') this.setVehicle('auto');
        this.map?.triggerRepaint();
      }, undefined, () => {});
      this.setVehicle(currentVehicle);
    }
    setVehicle(type) {
      currentVehicle = type;
      if (this.vehicleModel) this.anchor.remove(this.vehicleModel);
      if (type === 'auto') {
        this.vehicleModel = this.loadedAuto?.clone(true) || makeAutoFallback();
        this.vehicleModel.add(makeRider(currentRider));
      } else if (type === 'car') {
        this.vehicleModel = makeCar();
      } else if (type === 'bus') this.vehicleModel = makeBus();
      else this.vehicleModel = makeBike();
      this.vehicleModel.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      this.anchor.add(this.vehicleModel);
      this.map?.triggerRepaint();
    }
    setRider(name) {
      if (!name || name === currentRider) return;
      currentRider = String(name).slice(0, 18);
      this.setVehicle(currentVehicle);
    }
    setPose(coords, heading, bob = 0, lean = 0) {
      this.currentCoords = coords.slice();
      this.heading = heading;
      this.bob = bob;
      this.anchor.rotation.z = lean;
      this.map?.triggerRepaint();
    }
    spinWheels(amount) {
      this.vehicleModel?.traverse((node) => {
        if (!node.userData.rollingWheel) return;
        if (node.userData.wheelAxis === 'x') node.rotateX(amount);
        else node.rotateZ(amount);
      });
    }
    render(gl, matrix) {
      if (!this.renderer || !this.vehicleModel) return;
      let ground = 0;
      try { ground = this.map?.queryTerrainElevation(this.currentCoords, { exaggerated: false }) || 0; } catch (_) {}
      const mercator = window.maplibregl.MercatorCoordinate.fromLngLat(this.currentCoords, ground + 0.1 + this.bob);
      const units = mercator.meterInMercatorCoordinateUnits();
      const rotationX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      const headingY = new THREE.Matrix4().makeRotationY(Math.PI - this.heading * Math.PI / 180);
      const modelTransform = new THREE.Matrix4()
        .makeTranslation(mercator.x, mercator.y, mercator.z)
        .scale(new THREE.Vector3(units, -units, units))
        .multiply(rotationX)
        .multiply(headingY);
      this.camera.projectionMatrix.fromArray(matrix).multiply(modelTransform);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.renderer.resetState();
    }
    onRemove() {
      this.renderer?.dispose();
    }
  }

  function routeSource() {
    return map?.getSource('trip-current-leg');
  }

  function setRoute(points) {
    routeCoordinates = points;
    routeSource()?.setData({ type: 'FeatureCollection', features: [lineFeature(points)] });
  }

  async function findRoadRoute(from, to, requestId, targetStop) {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
      if (!response.ok) return;
      const body = await response.json();
      const coords = body?.routes?.[0]?.geometry?.coordinates;
      if (requestId !== routeRequestId || !Array.isArray(coords) || coords.length < 2) return;
      if (ride && ride.toStop === targetStop) ride.path = coords;
      setRoute(coords);
    } catch (_) {
      // Keep the local route fallback if live directions are offline.
    }
  }

  function lookAhead(coords, heading, metres = 52) {
    const lat = coords[1] + Math.cos(heading * Math.PI / 180) * metres / 111111;
    const lng = coords[0] + Math.sin(heading * Math.PI / 180) * metres / (111111 * Math.cos(coords[1] * Math.PI / 180));
    return [lng, lat];
  }

  function animateRideFrame(now) {
    if (!map || !ride) return;
    const dt = clamp((now - ride.lastFrame) / 1000, 0, 0.05);
    ride.lastFrame = now;
    const controls = {
      accelerate: driveKeys.has('accelerate'),
      brake: driveKeys.has('brake'),
      steer: Number(driveKeys.has('right')) - Number(driveKeys.has('left')),
    };
    const maxSpeed = ({ car: 126, bike: 108, bus: 82, auto: 68 })[currentVehicle] || 90;
    if (controls.accelerate) driveSpeed = Math.min(maxSpeed, driveSpeed + maxSpeed * 0.46 * dt);
    else driveSpeed = Math.max(0, driveSpeed - maxSpeed * (controls.brake ? 0.9 : 0.13) * dt);
    if (controls.brake && controls.accelerate) driveSpeed = Math.max(0, driveSpeed - maxSpeed * 0.65 * dt);
    const speedFactor = driveSpeed / maxSpeed;
    ride.laneOffset = clamp(ride.laneOffset + controls.steer * dt * 3.8, -4.5, 4.5);
    if (!controls.steer) ride.laneOffset *= Math.max(0, 1 - dt * 0.28);
    ride.progress = clamp(ride.progress + dt * speedFactor / ride.duration, 0, 1);
    const progress = ride.progress;
    const coords = coordinateAtDistance(ride.path, progress);
    const next = coordinateAtDistance(ride.path, Math.min(1, progress + 0.006));
    const heading = bearingBetween(coords, next);
    const sideBearing = (heading + 90) * Math.PI / 180;
    const offsetMetres = ride.laneOffset;
    const positioned = [
      coords[0] + Math.sin(sideBearing) * offsetMetres / (111111 * Math.max(0.15, Math.cos(coords[1] * Math.PI / 180))),
      coords[1] + Math.cos(sideBearing) * offsetMetres / 111111,
    ];
    const lean = currentVehicle === 'bike' ? -controls.steer * 0.14 : -controls.steer * 0.035;
    tripLayer?.setPose(positioned, heading + controls.steer * 5, Math.sin(now * 0.014) * (0.015 + speedFactor * 0.025), lean);
    tripLayer?.spinWheels(dt * speedFactor * 12);
    if (driveSpeedReadout) driveSpeedReadout.textContent = String(Math.round(driveSpeed));
    if (driveMessage) driveMessage.textContent = controls.accelerate ? 'STEER WITH A/D OR ◀ ▶' : speedFactor > 0.02 ? 'COASTING · SLOW WITH S / ▼' : 'HOLD W / ↑ OR ▲ TO DRIVE';
    window.dispatchEvent(new CustomEvent('kerala-drive-frame', { detail: { progress, speed: speedFactor, laneOffset: ride.laneOffset, steer: controls.steer, vehicle: currentVehicle } }));
    const cameraTarget = lookAhead(coords, heading, 44);
    map.jumpTo({ center: cameraTarget, bearing: heading, pitch: 67, zoom: 18.7 });
    if (progress < 1) requestAnimationFrame(animateRideFrame);
    else {
      activeStop = ride.toStop;
      const arrived = tripStops[activeStop];
      const nextStop = tripStops[Math.min(activeStop + 1, tripStops.length - 1)];
      const arrivalHeading = activeStop < tripStops.length - 1
        ? bearingBetween(arrived.coords, nextStop.coords)
        : bearingBetween(tripStops[activeStop - 1].coords, arrived.coords);
      tripLayer?.setPose(arrived.coords, arrivalHeading);
      if (window.dispatchEvent) {
        document.dispatchEvent(new CustomEvent('kerala-live-arrival', { detail: arrived.name }));
      }
      ride = null;
      showDriveHud(false);
      window.dispatchEvent(new CustomEvent('kerala-drive-arrival', { detail: { progress: 1 } }));
      setHint('3D STREETS · DRAG TO EXPLORE');
      if (desiredStop > activeStop) startRide(desiredStop);
    }
  }

  function startRide(toStop) {
    const target = clamp(toStop, 0, tripStops.length - 1);
    const fromCoords = tripStops[activeStop].coords;
    const toCoords = tripStops[target].coords;
    if (target <= activeStop) {
      activeStop = target;
      const heading = bearingBetween(tripStops[target].coords, tripStops[Math.min(target + 1, tripStops.length - 1)].coords);
      tripLayer?.setPose(tripStops[target].coords, heading);
      map?.flyTo({ center: lookAhead(tripStops[target].coords, heading, 44), zoom: 18.7, pitch: 67, bearing: heading, duration: 1300 });
      return;
    }
    const path = [fromCoords, toCoords];
    ride = { fromStop: activeStop, toStop: target, path, progress: 0, lastFrame: performance.now(), laneOffset: 0, duration: Math.min(22, 9 + (target - activeStop) * 3) };
    const requestId = ++routeRequestId;
    setRoute(path);
    showDriveHud(true);
    if (driveMessage) driveMessage.textContent = 'HOLD W / ↑ OR ▲ TO DRIVE';
    setHint('DRIVE · W / ↑ / ▲ ACCELERATE · A / D / ◀ ▶ STEER');
    findRoadRoute(fromCoords, toCoords, requestId, target);
    requestAnimationFrame(animateRideFrame);
  }

  function applyJourney(state = {}) {
    if (!mapReady) {
      pendingJourney = state;
      return;
    }
    const nextStop = clamp((Number(state.places) || 1) - 1, 0, tripStops.length - 1);
    const names = state.members?.map((member) => member.name).filter(Boolean) || [];
    desiredStop = Math.max(desiredStop, nextStop);
    if (!journeyReady) {
      journeyReady = true;
      activeStop = nextStop;
      desiredStop = nextStop;
      currentVehicle = ['bike', 'auto', 'bus', 'car'].includes(state.vehicle) ? state.vehicle : 'bike';
      currentRider = names[0] || currentRider;
      tripLayer?.setVehicle(currentVehicle);
      const next = tripStops[Math.min(activeStop + 1, tripStops.length - 1)];
      const here = tripStops[activeStop];
      const heading = bearingBetween(here.coords, next.coords);
      tripLayer?.setPose(here.coords, heading);
      map?.jumpTo({ center: lookAhead(here.coords, heading, 44), zoom: 18.7, pitch: 67, bearing: heading });
      if (activeStop < tripStops.length - 1) {
        const requestId = ++routeRequestId;
        setRoute([here.coords, next.coords]);
        findRoadRoute(here.coords, next.coords, requestId, activeStop + 1);
      }
      return;
    }
    if (names.length && tripLayer && names[0] !== currentRider) tripLayer.setRider(names[0]);
    if (['bike', 'auto', 'bus', 'car'].includes(state.vehicle) && tripLayer && state.vehicle !== currentVehicle) tripLayer.setVehicle(state.vehicle);
    if (nextStop > activeStop && !ride) startRide(nextStop);
  }

  try {
    map = new window.maplibregl.Map({
      container: mapRoot,
      style: 'kerala-live-style.json',
      center: tripStops[0].coords,
      zoom: 18.7,
      pitch: 67,
      bearing: -25,
      maxPitch: 80,
      minZoom: 5,
      maxZoom: 20,
      antialias: true,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
      touchPitch: true,
    });
    map.addControl(new window.maplibregl.AttributionControl({
      compact: true,
      customAttribution: '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">© OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>',
    }), 'bottom-right');

    const loadTimer = window.setTimeout(() => {
      if (!map.loaded()) showDiorama('LIVE MAP OFFLINE · SCENIC TOUR MAP');
    }, 18000);
    map.on('load', () => {
      clearTimeout(loadTimer);
      if (loading) loading.style.display = 'none';
      map.setTerrain({ source: 'terrainSource', exaggeration: 1.05 });
      map.setFog({ color: '#e7f3e6', 'high-color': '#9fd5d1', 'space-color': '#d6eddf', 'horizon-blend': 0.12, 'star-intensity': 0 });

      if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none');
      const buildingLayer = {
        id: 'trip-3d-buildings',
        source: 'openmaptiles',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 13,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'render_height'], ['get', 'height'], 8]], 0, '#f0d9bd', 9, '#e9cfad', 28, '#c3d2c9', 75, '#aebfcb'],
          'fill-extrusion-height': ['max', ['to-number', ['coalesce', ['get', 'render_height'], ['get', 'height'], 7]], 4],
          'fill-extrusion-base': ['to-number', ['coalesce', ['get', 'render_min_height'], 0]],
          'fill-extrusion-opacity': 0.95,
          'fill-extrusion-vertical-gradient': true,
        },
      };
      const before = map.getLayer('road_label') ? 'road_label' : undefined;
      map.addLayer(buildingLayer, before);
      map.addSource('trip-current-leg', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'trip-leg-outline', type: 'line', source: 'trip-current-leg',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fff9dc', 'line-width': 8, 'line-opacity': 0.9 },
      }, before);
      map.addLayer({
        id: 'trip-leg-line', type: 'line', source: 'trip-current-leg',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f7bd4d', 'line-width': 4, 'line-dasharray': [1.1, 1.25] },
      }, before);

      tripLayer = new KeralaRideLayer();
      map.addLayer(tripLayer);
      mapReady = true;
      applyJourney(pendingJourney || window.getKeralaTripState?.() || {});
      mapRoot.classList.add('liveMapReady');
      if (failed) failed.style.display = 'none';
      setHint('3D STREETS · DRAG TO EXPLORE');
      if (liveMap) liveMap.classList.add('hasLiveMap');
    });

    map.on('error', (event) => {
      if (!map.loaded() && failed) failed.textContent = 'Connecting to Kerala map…';
    });
  } catch (_) {
    if (loading) loading.textContent = 'Live map unavailable · opening scenic 3D map…';
    window.setTimeout(() => showDiorama('SCENIC MAP · DRAG TO ROTATE'), 900);
  }

  window.addEventListener('kerala-trip-state', (event) => applyJourney(event.detail || {}));
  document.getElementById('mapMode')?.addEventListener('click', () => {
    if (shownFallback) {
      shownFallback = false;
      mapRoot.style.display = 'block';
      const diorama = document.getElementById('kerala3d');
      if (diorama) diorama.style.display = 'none';
      mapHint.textContent = savedHint;
      document.getElementById('mapMode').textContent = '🌍 LIVE 3D';
      map?.resize();
    } else {
      showDiorama('SCENIC MAP · DRAG TO ROTATE');
      document.getElementById('mapMode').textContent = '🎨 SCENIC 3D';
    }
  });
  document.getElementById('resetMapView')?.addEventListener('click', () => {
    if (!map || shownFallback) return;
    const here = tripStops[activeStop] || tripStops[0];
    const next = tripStops[Math.min(activeStop + 1, tripStops.length - 1)];
    const heading = bearingBetween(here.coords, next.coords);
    map.flyTo({ center: lookAhead(here.coords, heading, 44), zoom: 18.7, pitch: 67, bearing: heading, duration: 900 });
  });
  document.getElementById('expandMap')?.addEventListener('click', (event) => {
    const expanded = liveMap?.classList.toggle('mapExpanded');
    event.currentTarget.setAttribute('aria-label', expanded ? 'Close expanded 3D map' : 'Expand 3D map');
    event.currentTarget.textContent = expanded ? '×' : '⛶';
    window.setTimeout(() => map?.resize(), 80);
  });
} else if (mapRoot) {
  const loading = mapRoot.querySelector('.liveMapLoading');
  if (loading) loading.textContent = '3D map library unavailable · opening scenic tour map…';
  window.setTimeout(() => {
    mapRoot.style.display = 'none';
    const diorama = document.getElementById('kerala3d');
    if (diorama) diorama.style.display = 'block';
    window.dispatchEvent(new Event('resize'));
  }, 1000);
}

window.addEventListener('kerala-live-arrival', (event) => {
  const name = event.detail;
  const speech = document.getElementById('speech');
  if (speech && name) speech.textContent = `We reached ${name}! The live 3D map is ready to explore.`;
});

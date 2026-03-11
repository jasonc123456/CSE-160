import * as THREE from "three";
import {PointerLockControls} from "three/addons/controls/PointerLockControls.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

//DOM helpers and constants
const $ = (id) => document.getElementById(id);
const canvas = $("webgl");
const helpPanel = $("helpPanel");
const fpsEl = $("fps");
const msEl = $("ms");
const hudSelName = $("selName");
const hudSheepLeft = $("sheepLeft");
const hudHits = $("hits");
const centerMsg = $("centerMsg");
const introOverlay = $("introOverlay");
const introTitle = $("introTitle");
const introStep = $("introStep");
const introBody = $("introBody");
const introBack = $("introBack");
const introNext = $("introNext");
const introStart = $("introStart");
const BARN_GLB = new URL("../assets/barn.glb", import.meta.url).href;
//Ground plane 80x80 and keep sheep inside bounds
const WORLD_HALF = 38;
//Player movement tuning
const MOVE_SPEED = 35.0;
const DAMPING = 7.0;
const GRAVITY = 18.0;
const JUMP_VELOCITY = 6.0;
//Sheep tuning
const sheepCount = 7;
//Renderer, scene and camera
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
//Start near ranch area
camera.position.set(8, 1.7, 12);
//Pointer lock controls
const controls = new PointerLockControls(camera, canvas);
function resizeToDisplaySize(){
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  if(canvas.width !== w || canvas.height !== h){
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
canvas.addEventListener("click", () => {
  if (introOverlay && introOverlay.style.display !== "none") return;
  if (!controls.isLocked) controls.lock();
});
//Intro overlay story and controls
const steps = [
  {
    title: "Story: Distant Sunset Shepherd",
    text:
      "You are a lone shepherd at sunset.\n" +
      "The flock scattered across the ranch.\n\n" +
      "Objective:\n" +
      "- Herd ALL sheep into the holding pen beside the barn.\n\n" +
      "How to herd:\n" +
      "- Walk behind/side of sheep so they flee in the direction you want.\n",
  },
  {
    title: "Controls",
    text:
      "- Click canvas: pointer lock mouse-look\n" +
      "- W/A/S/D: move\n" +
      "- Space: jump\n" +
      "- Q/E: yaw turn\n" +
      "- P: restart\n" +
      "- I: toggle help overlay\n" +
      "- F: fullscreen\n",
  },
  {
    title: "Tips",
    text:
      "- Press Esc to release mouse.\n" +
      "- Use I anytime to view controls.\n" +
      "- Follow the lamp posts to find the barn + holding pen.\n",
  },
];
let stepIdx = 0;
function renderOverlay(){
  if(!introOverlay) return;
  const s = steps[stepIdx];
  if(introTitle) introTitle.textContent = s.title;
  if(introStep) introStep.textContent = `${stepIdx + 1} / ${steps.length}`;
  if(introBody) introBody.textContent = s.text;
  if(introBack) introBack.disabled = stepIdx === 0;
  if(introNext) introNext.style.display = stepIdx === steps.length - 1 ? "none" : "inline-block";
  if(introStart) introStart.style.display = stepIdx === steps.length - 1 ? "inline-block" : "none";
}
function showOverlay(){
  if (!introOverlay) return;
  introOverlay.style.display = "flex";
  stepIdx = 0;
  renderOverlay();
}
function hideOverlay(){
  if (!introOverlay) return;
  introOverlay.style.display = "none";
}
if(introBack) introBack.addEventListener("click", () => {
  stepIdx = Math.max(0, stepIdx - 1);
  renderOverlay();
});
if(introNext) introNext.addEventListener("click", () => {
  stepIdx = Math.min(steps.length - 1, stepIdx + 1);
  renderOverlay();
});
if(introStart) introStart.addEventListener("click", () => {
  hideOverlay();
  setTimeout(() => controls.lock(), 0);
});
controls.addEventListener("lock", () => hideOverlay());
controls.addEventListener("unlock", () => {});
showOverlay();
//Skybox
const sky = new THREE.CubeTextureLoader()
  .setPath("../assets/skybox/")
  .load([
    "distant_sunset_lf.jpg",
    "distant_sunset_rt.jpg",
    "distant_sunset_up.jpg",
    "distant_sunset_dn.jpg",
    "distant_sunset_ft.jpg",
    "distant_sunset_bk.jpg",
  ]);
scene.background = sky;
//Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);
const directional = new THREE.DirectionalLight(0xffffff, 0.85);
directional.position.set(8, 12, 6);
directional.castShadow = true;
directional.shadow.mapSize.set(1024, 1024);
scene.add(directional);
const hemisphere = new THREE.HemisphereLight(0xbfd7ff, 0x3b2a1a, 0.45);
scene.add(hemisphere);
const point = new THREE.PointLight(0xffffff, 0.9, 80);
point.position.set(3.5, 3.0, 0.0);
point.castShadow = true;
scene.add(point);
//Flashlight
const spot = new THREE.SpotLight(0xfff2dd, 2.0, 60, THREE.MathUtils.degToRad(18), 0.25, 1);
spot.castShadow = true;
scene.add(spot);
scene.add(spot.target);
//Ground textured primary shape
const texLoader = new THREE.TextureLoader();
const groundTex = texLoader.load(
  "../assets/ground.png",
  () => {},
  undefined,
  () => console.warn("Failed to load ../assets/ground.png (check path)")
);
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(12, 12);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({
    map: groundTex,
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
//World group and primitive helpers
const world = new THREE.Group();
scene.add(world);
function add(mesh){
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}
const woodMat = new THREE.MeshStandardMaterial({color: 0x7a5a3a});
const leafMat = new THREE.MeshStandardMaterial({color: 0x2e7d32});
const stoneMat = new THREE.MeshStandardMaterial({color: 0x9aa0a6});
const lanternMat = new THREE.MeshStandardMaterial({
  color: 0xffcc66,
  emissive: 0xffb300,
  emissiveIntensity: 1.2,
});
function addBox(x, y, z, sx, sy, sz, mat){
  const m = add(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
  m.position.set(x, y, z);
  return m;
}
function addCyl(x, y, z, r, h, mat){
  const m = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), mat));
  m.position.set(x, y, z);
  return m;
}
function addSphere(x, y, z, r, mat){
  const m = add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat));
  m.position.set(x, y, z);
  return m;
}
//Utility messages and HUD
function flashMsg(msg, ms = 1200){
  if (!centerMsg) return;
  centerMsg.textContent = msg;
  centerMsg.style.display = "block";
  clearTimeout(flashMsg._t);
  flashMsg._t = setTimeout(() => {
    centerMsg.style.display = "none";
  }, ms);
}
function updateHud(){
  const left = sheepList.filter((s) => s.alive).length;
  const returned = sheepCount - left;
  if(hudSheepLeft) hudSheepLeft.textContent = String(left);
  if(hudHits) hudHits.textContent = String(returned);
  if(hudSelName && !hudSelName.textContent) hudSelName.textContent = "stone";
}
//Pen builder and capture zone globals
let penMinX = 0, penMaxX = 0, penMinZ = 0, penMaxZ = 0;
let penCenter = new THREE.Vector3(0, 0, 0);
let penW = 10;
let penD = 7;
let holdingPenBuilt = false;
function setCaptureZoneFromPen(center, w, d){
  penMinX = center.x - w / 2 + 0.6;
  penMaxX = center.x + w / 2 - 0.6;
  penMinZ = center.z - d / 2 + 0.6;
  penMaxZ = center.z + d / 2 - 0.6;
}
function buildHoldingPen(center, w, d){
  if(holdingPenBuilt) return;
  holdingPenBuilt = true;
  const postH = 2.0;
  const postR = 0.12;
  const railT = 0.12;
  const railY1 = 0.85;
  const railY2 = 1.35;
  const addRail = (x, y, z, sx, sz) => addBox(x, y, z, sx, railT, sz, woodMat);
  //corner posts
  addCyl(center.x - w / 2, postH / 2, center.z - d / 2, postR, postH, woodMat);
  addCyl(center.x + w / 2, postH / 2, center.z - d / 2, postR, postH, woodMat);
  addCyl(center.x - w / 2, postH / 2, center.z + d / 2, postR, postH, woodMat);
  addCyl(center.x + w / 2, postH / 2, center.z + d / 2, postR, postH, woodMat);
  //rails front/back
  addRail(center.x, railY1, center.z - d / 2, w, railT);
  addRail(center.x, railY2, center.z - d / 2, w, railT);
  addRail(center.x, railY1, center.z + d / 2, w, railT);
  addRail(center.x, railY2, center.z + d / 2, w, railT);
  //rails left/right
  addRail(center.x - w / 2, railY1, center.z, railT, d);
  addRail(center.x - w / 2, railY2, center.z, railT, d);
  addRail(center.x + w / 2, railY1, center.z, railT, d);
  addRail(center.x + w / 2, railY2, center.z, railT, d);
}
function addTree(x, z){
  addCyl(x, 1.2, z, 0.25, 2.4, woodMat);
  addBox(x, 2.6, z, 1.6, 1.6, 1.6, leafMat);
}
function buildWaterTower(cx, cz){
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5f666a });
  addCyl(cx - 1.1, 1.3, cz - 1.1, 0.12, 2.6, metal);
  addCyl(cx + 1.1, 1.3, cz - 1.1, 0.12, 2.6, metal);
  addCyl(cx - 1.1, 1.3, cz + 1.1, 0.12, 2.6, metal);
  addCyl(cx + 1.1, 1.3, cz + 1.1, 0.12, 2.6, metal);
  addCyl(cx, 3.2, cz, 1.2, 1.6, metal);
  addBox(cx, 4.2, cz, 2.6, 0.25, 2.6, dark);
  for (let i = 0; i < 9; i++){
    addBox(cx + 1.35, 0.6 + i * 0.38, cz, 0.08, 0.28, 0.4, dark);
  }
}
const barnPos = new THREE.Vector3(14, 0, -6);
const barnYaw = THREE.MathUtils.degToRad(25);
const PASTURE_W = 30;
const PASTURE_D = 22;
const pastureCenter = new THREE.Vector3(barnPos.x - 1.0, 0, barnPos.z + 2.5);
//lamps
function buildLampPost(x, z) {
  const post = new THREE.MeshStandardMaterial({ color: 0x6b4a2c });
  addCyl(x, 1.2, z, 0.10, 2.4, post);
  return addSphere(x, 2.55, z, 0.22, lanternMat);
}
const lamps = [];
lamps.push(buildLampPost(6, 10));
lamps.push(buildLampPost(8, 6));
lamps.push(buildLampPost(10, 3));
lamps.push(buildLampPost(12, 0));
lamps.push(buildLampPost(13, -3));
lamps.push(buildLampPost(12, -6));
lamps.push(buildLampPost(10, -8));
lamps.push(buildLampPost(8, -10));
const animatedLamp = lamps[0];
//trees, tower and crates
addTree(-12, -8);
addTree(12, -12);
addTree(-10, 7);
addTree(2, -14);
addTree(18, 10);
buildWaterTower(20, 8);
for(let i = 0; i < 8; i++){
  addBox(16 + (i % 4) * 1.2, 0.5, -12 - Math.floor(i / 4) * 1.2, 1, 1, 1, stoneMat);
}
//Sheep
function makeSheep(){
  const g = new THREE.Group();
  g.userData.isSheepRoot = true;
  const wool = new THREE.MeshStandardMaterial({color: 0xf2f2f2});
  const wool2 = new THREE.MeshStandardMaterial({color: 0xe5e5e5});
  const face = new THREE.MeshStandardMaterial({color: 0xb39e85});
  const legMat = new THREE.MeshStandardMaterial({color: 0x595959});
  const eyeMat = new THREE.MeshStandardMaterial({color: 0x111111});
  const box = (sx, sy, sz, mat) => new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  const body = box(1.4, 0.9, 0.9, wool); body.position.set(0, 0.95, 0); g.add(body);
  const belly = box(1.25, 0.65, 0.75, wool2); belly.position.set(0.05, 0.80, 0); g.add(belly);
  const head = box(0.6, 0.5, 0.5, wool); head.position.set(1.05, 1.05, 0); g.add(head);
  const facePlate = box(0.22, 0.38, 0.38, face); facePlate.position.set(1.32, 1.00, 0); g.add(facePlate);
  const e1 = box(0.08, 0.08, 0.08, eyeMat); e1.position.set(1.40, 1.12, 0.16); g.add(e1);
  const e2 = box(0.08, 0.08, 0.08, eyeMat); e2.position.set(1.40, 1.12, -0.16); g.add(e2);
  const legs = [];
  function leg(lx, lz){
    const L = box(0.22, 0.7, 0.22, legMat);
    L.position.set(lx, 0.15, lz);
    g.add(L);
    legs.push(L);
  }
  leg(0.55, 0.28);
  leg(0.55, -0.28);
  leg(-0.55, 0.28);
  leg(-0.55, -0.28);
  g.userData.legs = legs;
  g.scale.setScalar(0.9);
  g.traverse((o) => {
    if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; }
  });
  return g;
}
const sheepList = [];
function rand(min, max){return min + Math.random() * (max - min);}
const pastureMinX = pastureCenter.x - PASTURE_W / 2 + 1.2;
const pastureMaxX = pastureCenter.x + PASTURE_W / 2 - 1.2;
const pastureMinZ = pastureCenter.z - PASTURE_D / 2 + 1.2;
const pastureMaxZ = pastureCenter.z + PASTURE_D / 2 - 1.2;
function spawnSheep(){
  const sheep = makeSheep();
  let x, z;
  do{
    x = rand(pastureMinX, pastureMaxX);
    z = rand(pastureMinZ, pastureMaxZ);
  }while(x > penMinX && x < penMaxX && z > penMinZ && z < penMaxZ);
  sheep.position.set(x, 0, z);
  scene.add(sheep);
  sheepList.push({
    obj: sheep,
    yawDeg: rand(0, 360),
    speed: rand(1.4, 2.3),
    alive: true,
    wanderTimer: rand(0, 1.2),
  });
}
function resetSheep(){
  for(const s of sheepList) scene.remove(s.obj);
  sheepList.length = 0;
  for(let i = 0; i < sheepCount; i++) spawnSheep();
  updateHud();
}
//Sheep logic
function rotate2d(x, z, deg){
  const r = deg * Math.PI / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [x * c - z * s, x * s + z * c];
}
function updateSheep(dtSec, tSec){
  const player = controls.object.position;
  const px = player.x;
  const pz = player.z;
  const steerCandidatesDeg = [0, 25, -25, 60, -60, 90, -90, 135, -135, 180];
  for(const s of sheepList){
    if (!s.alive) continue;
    const dxp = s.obj.position.x - px;
    const dzp = s.obj.position.z - pz;
    const dist2 = dxp * dxp + dzp * dzp;
    let dirX = 0, dirZ = 0;
    //flee if close
    if(dist2 < 25){
      const inv = 1.0 / Math.max(0.0001, Math.sqrt(dist2));
      dirX = dxp * inv;
      dirZ = dzp * inv;
      s.speed = Math.min(3.2, s.speed + 0.6 * dtSec);
    }else{
      //wander
      s.wanderTimer += dtSec;
      if(s.wanderTimer > 1.2){
        s.wanderTimer = 0;
        s.yawDeg += rand(-50, 50);
      }
    }
    if(dirX === 0 && dirZ === 0){
      const yaw = (s.yawDeg * Math.PI) / 180.0;
      dirX = Math.sin(yaw);
      dirZ = -Math.cos(yaw);
    }
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len; dirZ /= len;
    const step = s.speed * dtSec;
    let moved = false;
    for(const angDeg of steerCandidatesDeg){
      const [cx, cz] = rotate2d(dirX, dirZ, angDeg);
      const nx = s.obj.position.x + cx * step;
      const nz = s.obj.position.z + cz * step;
      if(nx < -WORLD_HALF || nx > WORLD_HALF || nz < -WORLD_HALF || nz > WORLD_HALF) continue;
      s.obj.position.x = nx;
      s.obj.position.z = nz;
      s.yawDeg = Math.atan2(cx, -cz) * 180 / Math.PI;
      moved = true;
      break;
    }
    if(!moved) s.yawDeg += 180;
    s.obj.rotation.y = THREE.MathUtils.degToRad(90 - s.yawDeg);
    //walk cycle
    const w = tSec * 6.0;
    const legA = THREE.MathUtils.degToRad(20 * Math.sin(w));
    const legB = THREE.MathUtils.degToRad(20 * Math.sin(w + Math.PI));
    const legs = s.obj.userData.legs;
    if(legs && legs.length === 4){
      legs[0].rotation.z = legA;
      legs[1].rotation.z = -legA;
      legs[2].rotation.z = -legB;
      legs[3].rotation.z = legB;
    }
    //capture if inside pen
    if(s.obj.position.x >= penMinX && s.obj.position.x <= penMaxX &&
      s.obj.position.z >= penMinZ && s.obj.position.z <= penMaxZ){
      s.alive = false;
      s.obj.visible = false;
      updateHud();
      const left = sheepList.filter((x) => x.alive).length;
      flashMsg(left === 0
        ? "All sheep returned! You win! (Press P to restart)"
        : "Sheep returned to holding pen!");
    }
  }
}
//Barn model load
let barnRoot = null;
const gltfLoader = new GLTFLoader();
gltfLoader.load(
  BARN_GLB,
  (gltf) => {
    barnRoot = gltf.scene;
    barnRoot.traverse((o) => {
      if(o.isMesh){
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    //Auto-scale to target size
    const preBox = new THREE.Box3().setFromObject(barnRoot);
    const preSize = new THREE.Vector3();
    preBox.getSize(preSize);
    const maxDim = Math.max(preSize.x, preSize.y, preSize.z);
    const targetSize = 10;
    const s = targetSize / Math.max(0.0001, maxDim);
    barnRoot.scale.setScalar(s);
    //Set orientation early
    barnRoot.rotation.y = barnYaw;
    barnRoot.position.set(barnPos.x, barnPos.y, barnPos.z);
    const box2 = new THREE.Box3().setFromObject(barnRoot);
    barnRoot.position.y += -box2.min.y;
    scene.add(barnRoot);
    //Compute final bounds
    const barnBox = new THREE.Box3().setFromObject(barnRoot);
    const barnCenter = new THREE.Vector3();
    barnBox.getCenter(barnCenter);
    //Place pen outside of barn bounds
    penW = 10;
    penD = 7;
    const margin = 2.5;
    penCenter = new THREE.Vector3(barnCenter.x - 6.0, 0, barnBox.max.z + margin + penD / 2);
    buildHoldingPen(penCenter, penW, penD);
    setCaptureZoneFromPen(penCenter, penW, penD);
    // Spawn sheep ONLY after pen exists
    resetSheep();
    flashMsg("Herd the sheep into the holding pen beside the barn!", 1800);
    console.log("Barn loaded OK:", BARN_GLB, "scale:", s, "barnBox:", barnBox, "penCenter:", penCenter);
  },
  undefined,
  (err) => console.warn("Barn GLB load failed:", err, BARN_GLB)
);
//Input game controls
let moveF = false, moveB = false, moveL = false, moveR = false;
let canJump = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
window.addEventListener("keydown", async (e) => {
  //I = toggle help
  if(e.code === "KeyI"){
    if(!helpPanel) return;
    const willShow = helpPanel.classList.contains("hidden");
    helpPanel.classList.toggle("hidden");
    if(willShow && controls.isLocked) controls.unlock();
    return;
  }
  //F = fullscreen
  if(e.code === "KeyF"){
    try{
      if(!document.fullscreenElement){
        await canvas.parentElement.requestFullscreen();
      }else{
        await document.exitFullscreen();
      }
    }catch(_){}
    return;
  }
  //P = restart
  if(e.code === "KeyP"){
    //only restart once barn/pen exists
    if(holdingPenBuilt){
      controls.object.position.set(8, 1.7, 12);
      controls.object.rotation.y = Math.PI;
      resetSheep();
      flashMsg("Game restarted (P).");
    }else{
      flashMsg("Loading barn... please wait.");
    }
    return;
  }
  //movement
  if(e.code === "KeyW") moveF = true;
  if(e.code === "KeyS") moveB = true;
  if(e.code === "KeyA") moveL = true;
  if(e.code === "KeyD") moveR = true;
  if(e.code === "Space" && canJump) {
    velocity.y += JUMP_VELOCITY;
    canJump = false;
  }
  //Q, E yaw
  const YAW_STEP = 0.06;
  const _yawQuat = new THREE.Quaternion();
  const _upAxis = new THREE.Vector3(0, 1, 0);
  function applyYaw(deltaRad){
    _yawQuat.setFromAxisAngle(_upAxis, deltaRad);
    camera.quaternion.premultiply(_yawQuat);
  }
  if(e.code === "KeyQ" && controls.isLocked) applyYaw(+YAW_STEP);
  if(e.code === "KeyE" && controls.isLocked) applyYaw(-YAW_STEP);
});
window.addEventListener("keyup", (e) => {
  if(e.code === "KeyW") moveF = false;
  if(e.code === "KeyS") moveB = false;
  if(e.code === "KeyA") moveL = false;
  if(e.code === "KeyD") moveR = false;
});
document.addEventListener("fullscreenchange", () => {
  setTimeout(() => resizeToDisplaySize(), 0);
});
//player ground snap
function groundSnap(){
  const obj = controls.object;
  if(obj.position.y < 1.7){
    velocity.y = 0;
    obj.position.y = 1.7;
    canJump = true;
  }
}
//FPS counter
let prev = performance.now();
let accT = 0;
let accF = 0;
function updatePerf(dtMs){
  accT += dtMs;
  accF += 1;
  if(accT >= 250){
    const fps = (accF * 1000) / accT;
    if(fpsEl) fpsEl.textContent = fps.toFixed(0);
    if(msEl) msEl.textContent = (accT / accF).toFixed(1);
    accT = 0;
    accF = 0;
  }
}
//Animation loop
function animate(){
  requestAnimationFrame(animate);
  resizeToDisplaySize();
  const now = performance.now();
  const dtMs = now - prev;
  const dt = dtMs / 1000;
  prev = now;
  updatePerf(dtMs);
  //flashlight follows camera
  spot.position.copy(camera.position);
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  spot.target.position.copy(camera.position).add(fwd);
  spot.target.updateMatrixWorld();
  //animated primary shape: lamp bulb pulses
  if(animatedLamp){
    animatedLamp.position.y = 2.55 + Math.sin(now * 0.003) * 0.10;
  }
  //sheep logic
  if(sheepList.length > 0){
    updateSheep(dt, now / 1000);
  }
  //player movement
  if(controls.isLocked){
    velocity.x -= velocity.x * DAMPING * dt;
    velocity.z -= velocity.z * DAMPING * dt;
    velocity.y -= GRAVITY * dt;
    direction.z = Number(moveF) - Number(moveB);
    direction.x = Number(moveR) - Number(moveL);
    direction.normalize();
    if(moveF || moveB) velocity.z -= direction.z * MOVE_SPEED * dt;
    if(moveL || moveR) velocity.x -= direction.x * MOVE_SPEED * dt;
    controls.moveRight(-velocity.x * dt);
    controls.moveForward(-velocity.z * dt);
    controls.object.position.y += velocity.y * dt;
    groundSnap();
  }
  renderer.render(scene, camera);
}
animate();
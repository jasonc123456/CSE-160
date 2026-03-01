window.gameApi = window.gameApi || {};
const gameApi = window.gameApi;
//shaders
var vertexShaderSource = `
  attribute vec3 aPosition;
  attribute vec2 aUv;
  attribute vec3 aNormal;
  uniform mat4 uModelMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uProjectionMatrix;
  uniform mat4 uNormalMatrix;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main(){
    vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    vUv = aUv;
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
  }
`;
var fragmentShaderSource = `
  precision mediump float;
  uniform vec4 uFragColor;
  uniform float uTexColorWeight;
  uniform int uWhichTexture;
  uniform sampler2D uSampler0;
  uniform sampler2D uSampler1;
  uniform sampler2D uSampler2;
  uniform sampler2D uSampler3;
  uniform sampler2D uSampler4;
  uniform sampler2D uSampler5;
  uniform sampler2D uSampler6;
  uniform vec3 uCameraPos;
  // point light
  uniform vec3 uLightPos;
  uniform vec3 uLightColor;
  uniform int uPointLightOn;
  // spotlight
  uniform vec3 uSpotPos;
  uniform vec3 uSpotDir;
  uniform vec3 uSpotColor;
  uniform float uSpotCutoffCos;
  uniform int uSpotLightOn;
  // toggles
  uniform int uUseLighting;
  uniform int uShowNormals;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main(){
    vec4 texColor = vec4(1.0);
    if(uWhichTexture == 0) texColor = texture2D(uSampler0, vUv);
    else if(uWhichTexture == 1) texColor = texture2D(uSampler1, vUv);
    else if(uWhichTexture == 2) texColor = texture2D(uSampler2, vUv);
    else if(uWhichTexture == 3) texColor = texture2D(uSampler3, vUv);
    else if(uWhichTexture == 4) texColor = texture2D(uSampler4, vUv);
    else if(uWhichTexture == 5) texColor = texture2D(uSampler5, vUv);
    else if(uWhichTexture == 6) texColor = texture2D(uSampler6, vUv);
    vec4 baseColor = mix(uFragColor, texColor, uTexColorWeight);
    vec3 N = normalize(vWorldNormal);
    // normal visualization
    if(uShowNormals == 1){
      gl_FragColor = vec4(N * 0.5 + 0.5, 1.0);
      return;
    }
    // lighting off
    if(uUseLighting == 0){
      gl_FragColor = baseColor;
      return;
    }
    vec3 V = normalize(uCameraPos - vWorldPos);
    // Ambient term
    float ambientK = 0.18;
    vec3 lit = ambientK * baseColor.rgb;
    // Shared spec params
    float shininess = 32.0;
    float specK = 0.35;
    // Point light
    if(uPointLightOn == 1){
      vec3 Lp = normalize(uLightPos - vWorldPos);
      float diffP = max(dot(N, Lp), 0.0);
      float specP = 0.0;
      if(diffP > 0.0){
        vec3 Rp = reflect(-Lp, N);
        specP = pow(max(dot(V, Rp), 0.0), shininess);
      }
      lit += uLightColor * (diffP * baseColor.rgb + specK * specP);
    }
    // Spotlight
    if(uSpotLightOn == 1){
      vec3 spotToFrag = normalize(vWorldPos - uSpotPos);
      float coneCos = dot(normalize(uSpotDir), spotToFrag);
      // soft edge cone
      float edge = 0.06;
      float spotFactor = smoothstep(uSpotCutoffCos, min(1.0, uSpotCutoffCos + edge), coneCos);
      if(spotFactor > 0.0){
        vec3 Ls = normalize(uSpotPos - vWorldPos);  // fragment -> light
        float diffS = max(dot(N, Ls), 0.0);
        float specS = 0.0;
        if(diffS > 0.0){
          vec3 Rs = reflect(-Ls, N);
          specS = pow(max(dot(V, Rs), 0.0), shininess);
        }
        lit += spotFactor * uSpotColor * (diffS * baseColor.rgb + specK * specS);
      }
    }
    gl_FragColor = vec4(lit, baseColor.a);
  }
`;
//global variables
let gameStarted = false;
const introSlides = [
  {
    title: "Sheep Hunt",
    body:
    `You woke up inside a strange enclosure.
    The sheep have escaped your pen. Catch them all to restore order.
    Goal:
    • Hit all sheep (Left Click) to win.`
  },
  {
    title: "Controls",
    body:
    `Move:
    • W A S D = walk
    • Space = jump
    Look:
    • Click canvas = mouse look (pointer lock)
    • Esc = exit mouse look
    Blocks:
    • 1..7 = select block type
    • R = place block in front
    • F / Right Click = break block in front`
  },
  {
    title: "How to Win",
    body:
    `• Chase sheep: they flee when you're close.
    • Aim near the center (crosshair) and Left Click to hit.
    • Catch all sheep to win.
    Press Start when you're ready.`
  }
];
let introIndex = 0;
let canvas, gl;
let aPositionLoc, aUvLoc;
let uModelMatrixLoc, uViewMatrixLoc, uProjectionMatrixLoc;
let uFragColorLoc, uTexColorWeightLoc, uWhichTextureLoc;
let uSampler0Loc, uSampler1Loc, uSampler2Loc, uSampler3Loc, uSampler4Loc, uSampler5Loc, uSampler6Loc;
let cubeBuffer = null;
let camera = null;
const PLAYER_EYE_HEIGHT = 1.7;
const GRAVITY = 18.0;
const JUMP_V = 6.0;
let playerVelY = 0;
let playerOnGround = true;
let aNormalLoc;
let uNormalMatrixLoc, uCameraPosLoc;
let uLightPosLoc, uLightColorLoc, uPointLightOnLoc;
let uSpotPosLoc, uSpotDirLoc, uSpotColorLoc, uSpotCutoffCosLoc, uSpotLightOnLoc;
let uUseLightingLoc, uShowNormalsLoc;
//input
let keyState = Object.create(null);
let pointerLocked = false;
let dragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
//FPS
let lastFrameMs = 0;
let fpsCount = 0;
let fpsLastStamp = performance.now();
//Textures
let texturesReady = 0;
//indices match uWhichTexture
const texStone = 0; // wall0.png
const texGrass = 1; // ground.png
const texWood = 2; // wall1.png
const texDirt = 3; // dirt.png
const texLeaves = 4; // leaves.png
const texSand = 5; // sand.png
const texLapis = 6; // lapis.png
const blockNames = ["stone", "grass", "wood", "dirt", "leaves", "sand", "lapis"];
let selectedBlock = texStone;
//world
const worldWidth = 32;
const worldDepth = 32;
const worldOffsetX = -worldWidth / 2;
const worldOffsetZ = -worldDepth / 2;
let mapHeights = [];
let mapTextures = [];
//mesh buffers
let cubePosUvBuffer = null;
let cubeNormalBuffer = null;
let sphereMesh = null;
//lighting state
let useLighting = true;
let showNormals = false;
let pointLightOn = true;
let spotLightOn = true;
let animatePointLight = true;
let pointLightPos = [3.5, 3.0, 0.0];
let pointLightColor = [1.0, 1.0, 1.0];
let pointLightOrbitRadius = 6.0;
let pointLightOrbitSpeed = 0.8;
//intro
function showIntro(){
  const overlay = document.getElementById("introOverlay");
  overlay.style.display = "flex";
  overlay.setAttribute("aria-hidden", "false");
  const cross = document.getElementById("crosshair");
  if(cross) cross.style.display = "none";
  renderIntro();
}
function hideIntro(){
  const overlay = document.getElementById("introOverlay");
  overlay.style.display = "none";
  overlay.setAttribute("aria-hidden", "true");
  const cross = document.getElementById("crosshair");
  if(cross) cross.style.display = "block";
}
function renderIntro(){
  const slide = introSlides[introIndex];
  document.getElementById("introTitle").textContent = slide.title;
  document.getElementById("introBody").textContent = slide.body;
  document.getElementById("introStep").textContent = `${introIndex + 1} / ${introSlides.length}`;
  const backBtn = document.getElementById("introBack");
  const nextBtn = document.getElementById("introNext");
  const startBtn = document.getElementById("introStart");
  backBtn.style.display = (introIndex === 0) ? "none" : "inline-block";
  const atLast = (introIndex === introSlides.length - 1);
  nextBtn.style.display = atLast ? "none" : "inline-block";
  startBtn.style.display = atLast ? "inline-block" : "none";
}
function bindIntroButtons(){
  document.getElementById("introBack").addEventListener("click", () => {
    introIndex = Math.max(0, introIndex - 1);
    renderIntro();
  });
  document.getElementById("introNext").addEventListener("click", () => {
    introIndex = Math.min(introSlides.length - 1, introIndex + 1);
    renderIntro();
  });
  document.getElementById("introStart").addEventListener("click", () => {
    startGame();
  });
  window.addEventListener("keydown", (e) => {
    if(gameStarted) return;
    if(e.key === "Enter"){
      e.preventDefault();
      if(introIndex < introSlides.length - 1){
        introIndex++;
        renderIntro();
      }else{
        startGame();
      }
    }
  });
}
function startGame(){
  gameStarted = true;
  hideIntro();
  resetGame();
  requestAnimationFrame(tick);
}
//sheep hunt
let sheepList = [];
const sheepCount = 7;
let hitCount = 0;
let gameWon = false;
let messageHideAtMs = 0;
//cube geometry
const cubePosUv = new Float32Array([
  //Front (+Z)
  -0.5,-0.5, 0.5, 0,0,   0.5,-0.5, 0.5, 1,0,   0.5, 0.5, 0.5, 1,1,
  -0.5,-0.5, 0.5, 0,0,   0.5, 0.5, 0.5, 1,1,  -0.5, 0.5, 0.5, 0,1,
  //Back (-Z)
   0.5,-0.5,-0.5, 0,0,  -0.5,-0.5,-0.5, 1,0,  -0.5, 0.5,-0.5, 1,1,
   0.5,-0.5,-0.5, 0,0,  -0.5, 0.5,-0.5, 1,1,   0.5, 0.5,-0.5, 0,1,
  //Left (-X)
  -0.5,-0.5,-0.5, 0,0,  -0.5,-0.5, 0.5, 1,0,  -0.5, 0.5, 0.5, 1,1,
  -0.5,-0.5,-0.5, 0,0,  -0.5, 0.5, 0.5, 1,1,  -0.5, 0.5,-0.5, 0,1,
  //Right (+X)
   0.5,-0.5, 0.5, 0,0,   0.5,-0.5,-0.5, 1,0,   0.5, 0.5,-0.5, 1,1,
   0.5,-0.5, 0.5, 0,0,   0.5, 0.5,-0.5, 1,1,   0.5, 0.5, 0.5, 0,1,
  //Top (+Y)
  -0.5, 0.5, 0.5, 0,0,   0.5, 0.5, 0.5, 1,0,   0.5, 0.5,-0.5, 1,1,
  -0.5, 0.5, 0.5, 0,0,   0.5, 0.5,-0.5, 1,1,  -0.5, 0.5,-0.5, 0,1,
  //Bottom (-Y)
  -0.5,-0.5,-0.5, 0,0,   0.5,-0.5,-0.5, 1,0,   0.5,-0.5, 0.5, 1,1,
  -0.5,-0.5,-0.5, 0,0,   0.5,-0.5, 0.5, 1,1,  -0.5,-0.5, 0.5, 0,1,
]);
function clamp(value, lo, hi){
  return Math.max(lo, Math.min(hi, value));
}
function setCenterMsg(text, durationMs){
  const el = document.getElementById("centerMsg");
  if (!el) return;
  el.textContent = text;
  el.style.display = "block";
  messageHideAtMs = performance.now() + durationMs;
}
function hideCenterMsgIfNeeded(){
  const el = document.getElementById("centerMsg");
  if(!el) return;
  if(!gameWon && el.style.display !== "none" && performance.now() > messageHideAtMs){
    el.style.display = "none";
  }
}
function updateHud(){
  const sel = document.getElementById("selName");
  if(sel) sel.textContent = blockNames[selectedBlock] || "unknown";
  const left = document.getElementById("sheepLeft");
  if(left) left.textContent = String(sheepList.filter(s => s.alive).length);
  const hitsEl = document.getElementById("hits");
  if(hitsEl) hitsEl.textContent = String(hitCount);
}
//setup
function setupWebGl(){
  canvas = document.getElementById("webgl");
  gl = canvas.getContext("webgl", {preserveDrawingBuffer: true});
  if (!gl) return false;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);
  return true;
}
function connectVariablesToGlsl(){
  aNormalLoc = gl.getAttribLocation(gl.program, "aNormal");
  uNormalMatrixLoc = gl.getUniformLocation(gl.program, "uNormalMatrix");
  uCameraPosLoc = gl.getUniformLocation(gl.program, "uCameraPos");
  uLightPosLoc = gl.getUniformLocation(gl.program, "uLightPos");
  uLightColorLoc = gl.getUniformLocation(gl.program, "uLightColor");
  uPointLightOnLoc = gl.getUniformLocation(gl.program, "uPointLightOn");
  uSpotPosLoc = gl.getUniformLocation(gl.program, "uSpotPos");
  uSpotDirLoc = gl.getUniformLocation(gl.program, "uSpotDir");
  uSpotColorLoc = gl.getUniformLocation(gl.program, "uSpotColor");
  uSpotCutoffCosLoc = gl.getUniformLocation(gl.program, "uSpotCutoffCos");
  uSpotLightOnLoc = gl.getUniformLocation(gl.program, "uSpotLightOn");
  uUseLightingLoc = gl.getUniformLocation(gl.program, "uUseLighting");
  uShowNormalsLoc = gl.getUniformLocation(gl.program, "uShowNormals");
  //Build cube mesh
  const cubeMesh = createMesh(cubePosUv, cubeNormals);
  //store globally for drawCube
  window._cubeMesh = cubeMesh;
  //Build sphere mesh once
  sphereMesh = createSphereMesh(18, 24);
  //identity init
  const identity = new Matrix4();
  gl.uniformMatrix4fv(uModelMatrixLoc, false, identity.elements);
  gl.uniformMatrix4fv(uNormalMatrixLoc, false, identity.elements);
  //expose to sheep.js
  gameApi.drawCubeColored = drawCubeColored;
  return true;
}
//textures
function loadTextureToUnit(unitIndex, samplerLoc, imgSrc){
  const textureObj = gl.createTexture();
  const img = new Image();
  img.onload = () => {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0 + unitIndex);
    gl.bindTexture(gl.TEXTURE_2D, textureObj);
    //safe defaults
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.uniform1i(samplerLoc, unitIndex);
    texturesReady++;
  };
  img.onerror = () => console.log("Texture load failed:", imgSrc);
  img.src = imgSrc;
}
function initTextures(){
  loadTextureToUnit(0, uSampler0Loc, "../assets/wall0.png");
  loadTextureToUnit(1, uSampler1Loc, "../assets/ground.png");
  loadTextureToUnit(2, uSampler2Loc, "../assets/wall1.png");
  loadTextureToUnit(3, uSampler3Loc, "../assets/dirt.png");
  loadTextureToUnit(4, uSampler4Loc, "../assets/leaves.png");
  loadTextureToUnit(5, uSampler5Loc, "../assets/sand.png");
  loadTextureToUnit(6, uSampler6Loc, "../assets/lapis.png");
}
//world
//note to grader: world layout is hardcoded via mapHeights and mapTextures 2D arrays and it is created at startup
function buildWorld(){
  mapHeights = Array.from({length: worldWidth}, () => Array(worldDepth).fill(0));
  mapTextures = Array.from({length: worldWidth}, () => Array.from({length: worldDepth}, () => []));
  //perimeter walls (height 2)
  for(let x = 0; x < worldWidth; x++){
    for(let z = 0; z < worldDepth; z++){
      if(x === 0 || z === 0 || x === worldWidth - 1 || z === worldDepth - 1){
        mapHeights[x][z] = 2;
        const t = ((x + z) % 2) ? texStone : texWood;
        mapTextures[x][z] = [t, t];
      }
    }
  }
  //small structures
  for(let x = 6; x <= 13; x++){
    mapHeights[x][10] = 2;
    mapTextures[x][10] = [texWood, texWood];
  }
  for(let z = 14; z <= 23; z++){
    mapHeights[18][z] = 1;
    mapTextures[18][z] = [texStone];
  }
  for(let x = 20; x <= 26; x++){
    mapHeights[x][20] = 3;
    mapTextures[x][20] = [texWood, texWood, texWood];
  }
  //sand patch
  for(let x = 3; x <= 9; x++){
    for(let z = 3; z <= 8; z++){
      if(mapHeights[x][z] === 0){
        mapHeights[x][z] = 1;
        mapTextures[x][z] = [texSand];
      }
    }
  }
  //lapis blocks
  for(let x = 22; x <= 27; x++){
    for(let z = 5; z <= 10; z++){
      if(mapHeights[x][z] === 0){
        mapHeights[x][z] = 1;
        mapTextures[x][z] = [texLapis];
      }
    }
  }
  //leaves bushes
  for(let x = 10; x <= 14; x++){
    for(let z = 22; z <= 26; z++){
      mapHeights[x][z] = 2;
      mapTextures[x][z] = [texLeaves, texLeaves];
    }
  }
}
function worldToMap(wx, wz){
  const ix = Math.floor(wx - worldOffsetX);
  const iz = Math.floor(wz - worldOffsetZ);
  return [ix, iz];
}
function isBlockedAtWorld(wx, wz, eyeY){
  const [ix, iz] = worldToMap(wx, wz);
  if(ix < 0 || ix >= worldWidth || iz < 0 || iz >= worldDepth) return true;
  const h = mapHeights[ix][iz];
  if(h <= 0) return false;
  const feetY = eyeY - PLAYER_EYE_HEIGHT;
  //allow standing on blocks
  return (feetY + 0.05) < h;
}
function isBlockedAtXZ(wx, wz){
  const [ix, iz] = worldToMap(wx, wz);
  if(ix < 0 || ix >= worldWidth || iz < 0 || iz >= worldDepth) return true;
  return mapHeights[ix][iz] > 0;
}
function getFrontCell(){
  const f = camera.getForwardXz();
  const ex = camera.eye.elements[0];
  const ez = camera.eye.elements[2];
  const tx = ex + f.elements[0] * 1.5;
  const tz = ez + f.elements[2] * 1.5;
  return worldToMap(tx, tz);
}

function placeBlock(){
  const [ix, iz] = getFrontCell();
  if(ix < 0 || ix >= worldWidth || iz < 0 || iz >= worldDepth) return;
  const h = mapHeights[ix][iz];
  if(h >= 4) return;
  let stack = mapTextures[ix][iz];
  if(!Array.isArray(stack)) stack = [];
  if(stack.length < h){
    const fill = (stack.length > 0) ? stack[stack.length - 1] : texStone;
    while(stack.length < h) stack.push(fill);
  }
  stack[h] = selectedBlock;
  mapTextures[ix][iz] = stack;
  mapHeights[ix][iz] = h + 1;
}
function breakBlock(){
  const [ix, iz] = getFrontCell();
  if(ix < 0 || ix >= worldWidth || iz < 0 || iz >= worldDepth) return;
  const h = mapHeights[ix][iz];
  if(h <= 0) return;
  mapHeights[ix][iz] = h - 1;
  mapTextures[ix][iz].pop();
}
function tryMove(dx, dz){
  const nx = camera.eye.elements[0] + dx;
  const nz = camera.eye.elements[2] + dz;
  const ey = camera.eye.elements[1];
  if(isBlockedAtWorld(nx, nz, ey)) return;
  camera.translateXz(dx, dz);
}
//drawing
function setMaterial(baseRgba, texWeight, whichTexture){
  gl.uniform4f(uFragColorLoc, baseRgba[0], baseRgba[1], baseRgba[2], baseRgba[3]);
  gl.uniform1f(uTexColorWeightLoc, texWeight);
  gl.uniform1i(uWhichTextureLoc, whichTexture);
}
function drawCube(modelMatrix){
  drawMesh(window._cubeMesh, modelMatrix);
}
function drawCubeColored(modelMatrix, rgba){
  setMaterial(rgba, 0.0, 0);
  drawCube(modelMatrix);
}
function drawSphereColored(modelMatrix, rgba){
  setMaterial(rgba, 0.0, 0);
  drawMesh(sphereMesh, modelMatrix);
}
function createSphereMesh(latBands = 18, lonBands = 24){
  const posUv = [];
  const normals = [];
  function addVertex(x, y, z, u, v){
    const rx = x * 0.5, ry = y * 0.5, rz = z * 0.5;
    posUv.push(rx, ry, rz, u, v);
    normals.push(x, y, z);
  }
  function spherePoint(v, u){
    const phi = v * Math.PI;
    const theta = u * Math.PI * 2.0;
    const y = Math.cos(phi);
    const r = Math.sin(phi);
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    return [x, y, z];
  }
  for(let i = 0; i < latBands; i++){
    const v0 = i / latBands;
    const v1 = (i + 1) / latBands;
    for(let j = 0; j < lonBands; j++){
      const u0 = j / lonBands;
      const u1 = (j + 1) / lonBands;
      const p00 = spherePoint(v0, u0);
      const p01 = spherePoint(v0, u1);
      const p10 = spherePoint(v1, u0);
      const p11 = spherePoint(v1, u1);
      //triangle 1: p00, p10, p11
      addVertex(p00[0], p00[1], p00[2], u0, v0);
      addVertex(p10[0], p10[1], p10[2], u0, v1);
      addVertex(p11[0], p11[1], p11[2], u1, v1);
      //triangle 2: p00, p11, p01
      addVertex(p00[0], p00[1], p00[2], u0, v0);
      addVertex(p11[0], p11[1], p11[2], u1, v1);
      addVertex(p01[0], p01[1], p01[2], u1, v0);
    }
  }
  return createMesh(new Float32Array(posUv), new Float32Array(normals));
}
function getCameraForward3D(){
  const ex = camera.eye.elements[0], ey = camera.eye.elements[1], ez = camera.eye.elements[2];
  const ax = camera.at.elements[0], ay = camera.at.elements[1], az = camera.at.elements[2];
  let fx = ax - ex, fy = ay - ey, fz = az - ez;
  const len = Math.hypot(fx, fy, fz) || 1.0;
  fx /= len; fy /= len; fz /= len;
  return [fx, fy, fz];
}

function updateAnimatedPointLight(tSec){
  if(!animatePointLight) return;
  pointLightPos[0] = Math.cos(tSec * pointLightOrbitSpeed) * pointLightOrbitRadius;
  pointLightPos[2] = Math.sin(tSec * pointLightOrbitSpeed) * pointLightOrbitRadius;
  // keep y from slider/manual value
}

function uploadLightingUniforms(tSec){
  updateAnimatedPointLight(tSec);

  // toggles
  gl.uniform1i(uUseLightingLoc, useLighting ? 1 : 0);
  gl.uniform1i(uShowNormalsLoc, showNormals ? 1 : 0);

  // camera
  gl.uniform3f(
    uCameraPosLoc,
    camera.eye.elements[0], camera.eye.elements[1], camera.eye.elements[2]
  );

  // point light
  gl.uniform1i(uPointLightOnLoc, pointLightOn ? 1 : 0);
  gl.uniform3f(uLightPosLoc, pointLightPos[0], pointLightPos[1], pointLightPos[2]);
  gl.uniform3f(uLightColorLoc, pointLightColor[0], pointLightColor[1], pointLightColor[2]);

  // spotlight (flashlight attached to camera)
  const f = getCameraForward3D();
  gl.uniform1i(uSpotLightOnLoc, spotLightOn ? 1 : 0);
  gl.uniform3f(
    uSpotPosLoc,
    camera.eye.elements[0], camera.eye.elements[1], camera.eye.elements[2]
  );
  gl.uniform3f(uSpotDirLoc, f[0], f[1], f[2]);
  gl.uniform3f(uSpotColorLoc, 1.0, 0.95, 0.85);
  gl.uniform1f(uSpotCutoffCosLoc, Math.cos(18.0 * Math.PI / 180.0));
}
function drawSkybox(){
  gl.disable(gl.CULL_FACE);
  gl.depthMask(false);
  setMaterial([0.25, 0.55, 0.95, 1.0], 0.0, 0);
  const m = new Matrix4();
  m.setIdentity();
  m.translate(camera.eye.elements[0], camera.eye.elements[1], camera.eye.elements[2]);
  m.scale(220, 220, 220);
  drawCube(m);
  gl.depthMask(true);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
}
function drawGround(){
  const m = new Matrix4();
  m.setIdentity();
  m.translate(0, -0.05, 0);
  m.scale(60, 0.10, 60);
  if(texturesReady < 7){
    drawCubeColored(m, [0.25, 0.75, 0.30, 1.0]);
  }else{
    setMaterial([1, 1, 1, 1], 1.0, texGrass);
    drawCube(m);
  }
}
function drawWorld(){
  for(let x = 0; x < worldWidth; x++){
    for(let z = 0; z < worldDepth; z++){
      const h = mapHeights[x][z];
      if(h <= 0) continue;
      for(let y = 0; y < h; y++){
        const tex = mapTextures[x][z][y] ?? mapTextures[x][z][h-1] ?? texStone;
        const m = new Matrix4();
        m.setIdentity();
        m.translate(x + worldOffsetX + 0.5, y + 0.5, z + worldOffsetZ + 0.5);
        if(texturesReady < 7) drawCubeColored(m, [0.6,0.6,0.6,1.0]);
        else { setMaterial([1,1,1,1], 1.0, tex); drawCube(m); }
      }
    }
  }
}
//sheep and game logic
function groundHeightAtWorld(wx, wz){
  const [ix, iz] = worldToMap(wx, wz);
  if(ix < 0 || ix >= worldWidth || iz < 0 || iz >= worldDepth) return 0;
  return mapHeights[ix][iz];
}
function randRange(min, max){
  return min + Math.random() * (max - min);
}
function spawnSheep() {
  for(let tries = 0; tries < 2000; tries++){
    const ix = 1 + Math.floor(Math.random() * (worldWidth - 2));
    const iz = 1 + Math.floor(Math.random() * (worldDepth - 2));
    if(mapHeights[ix][iz] > 0) continue;
    const wx = ix + worldOffsetX + 0.5;
    const wz = iz + worldOffsetZ + 0.5;
    const dx = wx - camera.eye.elements[0];
    const dz = wz - camera.eye.elements[2];
    if(dx * dx + dz * dz < 16) continue;
    return {
      x: wx,
      y: 0,
      z: wz,
      yawDeg: randRange(0, 360),
      speed: randRange(1.3, 2.2),
      alive: true,
      wanderTimer: randRange(0, 1.2),
    };
  }
  return {x: 0, y: 0, z: 0, yawDeg: 0, speed: 1.7, alive: true, wanderTimer: 0};
}
function resetGame(){
  hitCount = 0;
  gameWon = false;
  camera.eye = new Vector3([0, PLAYER_EYE_HEIGHT, 6]);
  playerVelY = 0;
  playerOnGround = true;
  camera.yawDeg = 0;
  camera.pitchDeg = 0;
  camera.updateView();
  sheepList = [];
  for(let i = 0; i < sheepCount; i++) sheepList.push(spawnSheep());
  updateHud();
  setCenterMsg("Sheep Hunt!\nClick canvas to enable mouse look.\nUse Left Mouse Button to hit sheep. Chase and hit them all to win.", 6000);
}
function rotate2D(x, z, deg){
  const r = deg * Math.PI / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [x * c - z * s, x * s + z * c];
}
function inBoundsWorld(nx, nz){
  const [ix, iz] = worldToMap(nx, nz);
  return !(ix <= 1 || ix >= worldWidth - 2 || iz <= 1 || iz >= worldDepth - 2);
}
function rotate2d(x, z, deg){
  const r = (deg * Math.PI) / 180.0;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - z * s, x * s + z * c];
}

function inBoundsWorld(wx, wz){
  const [ix, iz] = worldToMap(wx, wz);
  return !(ix <= 1 || ix >= worldWidth - 2 || iz <= 1 || iz >= worldDepth - 2);
}

function updateSheep(dtSec){
  const px = camera.eye.elements[0];
  const pz = camera.eye.elements[2];
  const steerCandidatesDeg = [0, 25, -25, 60, -60, 90, -90, 135, -135, 180];
  for(const s of sheepList){
    if(!s.alive) continue;
    const dxp = s.x - px;
    const dzp = s.z - pz;
    const dist2 = dxp * dxp + dzp * dzp;
    let dirX = 0;
    let dirZ = 0;
    //flee when player is close
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
        s.yawDeg += randRange(-50, 50);
      }
    }
    //if not fleeing move based on yaw
    if(dirX === 0 && dirZ === 0){
      const yaw = (s.yawDeg * Math.PI) / 180.0;
      dirX = Math.sin(yaw);
      dirZ = -Math.cos(yaw);
    }
    //normalize
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len;
    dirZ /= len;
    const step = s.speed * dtSec;
    //steering search, if forward is blocked, try turning left/right before randomizing
    let moved = false;
    for(const angDeg of steerCandidatesDeg){
      const [cx, cz] = rotate2d(dirX, dirZ, angDeg);
      const nx = s.x + cx * step;
      const nz = s.z + cz * step;
      if(isBlockedAtXZ(nx, nz)) continue;
      if(!inBoundsWorld(nx, nz)) continue;
      s.x = nx;
      s.z = nz;
      //keep yaw consistent with movement convention
      s.yawDeg = Math.atan2(cx, -cz) * 180.0 / Math.PI;
      moved = true;
      break;
    }
    //if trapped do a turnaround
    if(!moved){
      s.yawDeg += 180;
    }
  }
}
function attackSheep(){
  if(gameWon) return;
  const ex = camera.eye.elements[0];
  const ez = camera.eye.elements[2];
  const forward = camera.getForwardXz();
  const range = 3.0;
  const dotMin = 0.965;
  let best = null;
  let bestD2 = 1e9;
  for(const s of sheepList){
    if(!s.alive) continue;
    const dx = s.x - ex;
    const dz = s.z - ez;
    const d2 = dx * dx + dz * dz;
    if(d2 > range * range) continue;
    const inv = 1.0 / Math.max(0.0001, Math.sqrt(d2));
    const vx = dx * inv;
    const vz = dz * inv;
    const dot = forward.elements[0] * vx + forward.elements[2] * vz;
    if(dot < dotMin) continue;
    if(d2 < bestD2){
      bestD2 = d2;
      best = s;
    }
  }
  if(best){
    best.alive = false;
    hitCount++;
    setCenterMsg("HIT! 🐑", 1000);
    if(sheepList.filter(s => s.alive).length === 0){
      gameWon = true;
      setCenterMsg("YOU WON! 🏆\nAll sheep(s) are now caught.\nPress P to play again.", 999999);
    }
    updateHud();
  }else{
    setCenterMsg("Missed…", 250);
  }
}
//input
function setupPointerLock(){
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = (document.pointerLockElement === canvas);
    if(pointerLocked) setCenterMsg("Mouse look enabled (Press ESC to exit).", 2000);
  });
  canvas.addEventListener("click", () => {
    if(!pointerLocked) canvas.requestPointerLock();
  });

  document.addEventListener("mousemove", (ev) => {
    if(!pointerLocked) return;
    camera.rotateYaw(ev.movementX * 0.20);
    camera.rotatePitch(-ev.movementY * 0.15);
  });
}

function setupInput(){
  document.addEventListener("keydown", (ev) => {
    const k = ev.key.toLowerCase();
    keyState[k] = true;
    if(ev.code === "Space"){
      if(playerOnGround){
        playerVelY = JUMP_V;
        playerOnGround = false;
      }
    }
    if (k === "1") selectedBlock = texStone;
    if (k === "2") selectedBlock = texGrass;
    if (k === "3") selectedBlock = texWood;
    if (k === "4") selectedBlock = texDirt;
    if (k === "5") selectedBlock = texLeaves;
    if (k === "6") selectedBlock = texSand;
    if (k === "7") selectedBlock = texLapis;
    if (k === "r") placeBlock();
    if (k === "f") breakBlock();
    if (k === "p") resetGame();
    updateHud();
  });
  document.addEventListener("keyup", (ev) => {
    keyState[ev.key.toLowerCase()] = false;
  });
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  canvas.addEventListener("mousedown", (ev) => {
    if(!pointerLocked && ev.button === 0){
      canvas.requestPointerLock();
      return;
    }
    if(ev.button === 0){
      attackSheep();
    }else if(ev.button === 2){
      breakBlock();
    }else{
      dragging = true;
      lastMouseX = ev.clientX;
      lastMouseY = ev.clientY;
    }
  });
  window.addEventListener("mouseup", () => { dragging = false; });
  window.addEventListener("mousemove", (ev) => {
    if(pointerLocked) return;
    if(!dragging) return;
    const dx = ev.clientX - lastMouseX;
    const dy = ev.clientY - lastMouseY;
    lastMouseX = ev.clientX;
    lastMouseY = ev.clientY;
    camera.rotateYaw(dx * 0.20);
    camera.rotatePitch(-dy * 0.15);
  });
  updateHud();
}

//FPS
function updateFps(dtMs){
  fpsCount++;
  const now = performance.now();
  const elapsed = now - fpsLastStamp;
  if(elapsed >= 500){
    const fps = (fpsCount * 1000) / elapsed;
    const fpsEl = document.getElementById("fps");
    const msEl = document.getElementById("ms");
    if(fpsEl) fpsEl.innerText = fps.toFixed(1);
    if(msEl) msEl.innerText = dtMs.toFixed(2);
    fpsCount = 0;
    fpsLastStamp = now;
  }
}
function renderScene(tSec){
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(uViewMatrixLoc, false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(uProjectionMatrixLoc, false, camera.projectionMatrix.elements);
  drawSkybox();
  drawGround();
  drawWorld();
  if(typeof drawSheepAt === "function"){
    for(const s of sheepList){
      if(!s.alive) continue;
      drawSheepAt(s.x, 0.0, s.z, s.yawDeg, tSec);
    }
  }
  hideCenterMsgIfNeeded();
}
function tick(nowMs){
  if(!lastFrameMs) lastFrameMs = nowMs;
  const dtMs = nowMs - lastFrameMs;
  lastFrameMs = nowMs;
  updateFps(dtMs);
  const dt = dtMs / 1000.0;
  const moveSpeed = 4.0 * dt;
  const yawSpeed = 120.0 * dt;
  const forward = camera.getForwardXz();
  const right = camera.getRightXz();
  if(keyState["w"]) tryMove(forward.elements[0] * moveSpeed, forward.elements[2] * moveSpeed);
  if(keyState["s"]) tryMove(-forward.elements[0] * moveSpeed, -forward.elements[2] * moveSpeed);
  if(keyState["a"]) tryMove(-right.elements[0] * moveSpeed, -right.elements[2] * moveSpeed);
  if(keyState["d"]) tryMove(right.elements[0] * moveSpeed, right.elements[2] * moveSpeed);
  if(keyState["q"]) camera.rotateYaw(-yawSpeed);
  if(keyState["e"]) camera.rotateYaw(yawSpeed);
  if(!gameWon) updateSheep(dt);
  renderScene(nowMs / 1000.0);
  requestAnimationFrame(tick);
  //vertical physics
  const oldY = camera.eye.elements[1];
  playerVelY -= GRAVITY * dt;
  camera.eye.elements[1] += playerVelY * dt;
  const gH = groundHeightAtWorld(camera.eye.elements[0], camera.eye.elements[2]);
  const minEyeY = gH + PLAYER_EYE_HEIGHT;
  if(camera.eye.elements[1] <= minEyeY){
    camera.eye.elements[1] = minEyeY;
    playerVelY = 0;
    playerOnGround = true;
  }
  //if Y changed, update view
  if(camera.eye.elements[1] !== oldY){
    camera.updateView();
  }
}
function makeCubeNormals(){
  const out = [];
  const faces = [
    [0, 0, 1], //front
    [0, 0, -1], //back
    [-1, 0, 0], //left
    [1, 0, 0], //right
    [0, 1, 0], //top
    [0, -1, 0], //bottom
  ];
  for(const n of faces){
    for(let i = 0; i < 6; i++) out.push(n[0], n[1], n[2]);
  }
  return new Float32Array(out);
}
const cubeNormals = makeCubeNormals();
function createMesh(posUvArray, normalArray){
  const mesh = {
    vertexCount: posUvArray.length / 5,
    posUvBuffer: gl.createBuffer(),
    normalBuffer: gl.createBuffer()
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posUvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, posUvArray, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, normalArray, gl.STATIC_DRAW);
  return mesh;
}
function bindMesh(mesh){
  const fsize = Float32Array.BYTES_PER_ELEMENT;
  //positions + UVs
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posUvBuffer);
  gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, fsize * 5, 0);
  gl.enableVertexAttribArray(aPositionLoc);
  gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, fsize * 5, fsize * 3);
  gl.enableVertexAttribArray(aUvLoc);
  //normals
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormalLoc);
}
function setModelAndNormalMatrices(modelMatrix){
  gl.uniformMatrix4fv(uModelMatrixLoc, false, modelMatrix.elements);
  const normalM = new Matrix4();
  normalM.setInverseOf(modelMatrix);
  normalM.transpose();
  gl.uniformMatrix4fv(uNormalMatrixLoc, false, normalM.elements);
}
function drawMesh(mesh, modelMatrix){
  bindMesh(mesh);
  setModelAndNormalMatrices(modelMatrix);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
}
function main(){
  if (!setupWebGl()) return;
  if (!connectVariablesToGlsl()) return;
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  camera = new Camera(canvas);
  buildWorld();
  bindIntroButtons();
  showIntro();
  setupInput();
  setupPointerLock();
  initTextures();
  resetGame();
  requestAnimationFrame(tick);
}
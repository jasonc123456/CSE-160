window.gameApi = window.gameApi || {};
const gameApi = window.gameApi;
//shaders
var vertexShaderSource = `
  attribute vec3 aPosition;
  attribute vec2 aUv;
  uniform mat4 uModelMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uProjectionMatrix;
  varying vec2 vUv;
  void main(){
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
    vUv = aUv;
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
  varying vec2 vUv;
  void main(){
    vec4 texColor = vec4(1.0);
    if(uWhichTexture == 0) texColor = texture2D(uSampler0, vUv);
    else if(uWhichTexture == 1) texColor = texture2D(uSampler1, vUv);
    else if(uWhichTexture == 2) texColor = texture2D(uSampler2, vUv);
    else if(uWhichTexture == 3) texColor = texture2D(uSampler3, vUv);
    else if(uWhichTexture == 4) texColor = texture2D(uSampler4, vUv);
    else if(uWhichTexture == 5) texColor = texture2D(uSampler5, vUv);
    else if(uWhichTexture == 6) texColor = texture2D(uSampler6, vUv);
    float t = uTexColorWeight;
    gl_FragColor = (1.0 - t) * uFragColor + t * texColor;
  }
`;
//global variables
let canvas, gl;
let aPositionLoc, aUvLoc;
let uModelMatrixLoc, uViewMatrixLoc, uProjectionMatrixLoc;
let uFragColorLoc, uTexColorWeightLoc, uWhichTextureLoc;
let uSampler0Loc, uSampler1Loc, uSampler2Loc, uSampler3Loc, uSampler4Loc, uSampler5Loc, uSampler6Loc;
let cubeBuffer = null;
let camera = null;
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
// indices match uWhichTexture
const texStone = 0; // wall0.png
const texGrass = 1; // ground.png
const texWood = 2; // wall1.png
const texDirt = 3; // dirt.png
const texLeaves = 4; // leaves.png
const texSand = 5; // sand.png
const texWater = 6; // water.png
const blockNames = ["stone", "grass", "wood", "dirt", "leaves", "sand", "water"];
let selectedBlock = texStone;
//world
const worldWidth = 32;
const worldDepth = 32;
const worldOffsetX = -worldWidth / 2;
const worldOffsetZ = -worldDepth / 2;
let mapHeights = [];
let mapTextures = [];
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
  if(!initShaders(gl, vertexShaderSource, fragmentShaderSource)) return false;
  aPositionLoc = gl.getAttribLocation(gl.program, "aPosition");
  aUvLoc = gl.getAttribLocation(gl.program, "aUv");
  uModelMatrixLoc = gl.getUniformLocation(gl.program, "uModelMatrix");
  uViewMatrixLoc = gl.getUniformLocation(gl.program, "uViewMatrix");
  uProjectionMatrixLoc = gl.getUniformLocation(gl.program, "uProjectionMatrix");
  uFragColorLoc = gl.getUniformLocation(gl.program, "uFragColor");
  uTexColorWeightLoc = gl.getUniformLocation(gl.program, "uTexColorWeight");
  uWhichTextureLoc = gl.getUniformLocation(gl.program, "uWhichTexture");
  uSampler0Loc = gl.getUniformLocation(gl.program, "uSampler0");
  uSampler1Loc = gl.getUniformLocation(gl.program, "uSampler1");
  uSampler2Loc = gl.getUniformLocation(gl.program, "uSampler2");
  uSampler3Loc = gl.getUniformLocation(gl.program, "uSampler3");
  uSampler4Loc = gl.getUniformLocation(gl.program, "uSampler4");
  uSampler5Loc = gl.getUniformLocation(gl.program, "uSampler5");
  uSampler6Loc = gl.getUniformLocation(gl.program, "uSampler6");
  cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cubePosUv, gl.STATIC_DRAW);
  const fsize = cubePosUv.BYTES_PER_ELEMENT;
  gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, fsize * 5, 0);
  gl.enableVertexAttribArray(aPositionLoc);
  gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, fsize * 5, fsize * 3);
  gl.enableVertexAttribArray(aUvLoc);
  const identity = new Matrix4();
  gl.uniformMatrix4fv(uModelMatrixLoc, false, identity.elements);
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
  loadTextureToUnit(6, uSampler6Loc, "../assets/water.png");
}
//world
function buildWorld(){
  mapHeights = Array.from({length: worldWidth}, () => Array(worldDepth).fill(0));
  mapTextures = Array.from({length: worldWidth}, () => Array(worldDepth).fill(texStone));
  //perimeter walls
  for(let x = 0; x < worldWidth; x++){
    for(let z = 0; z < worldDepth; z++){
      if(x === 0 || z === 0 || x === worldWidth - 1 || z === worldDepth - 1){
        mapHeights[x][z] = 2;
        mapTextures[x][z] = ((x + z) % 2) ? texStone : texWood;
      }
    }
  }
  //small structures
  for(let x = 6; x <= 13; x++){ mapHeights[x][10] = 2; mapTextures[x][10] = texWood;}
  for(let z = 14; z <= 23; z++){ mapHeights[18][z] = 1; mapTextures[18][z] = texStone;}
  for(let x = 20; x <= 26; x++){ mapHeights[x][20] = 3; mapTextures[x][20] = texWood;}
  //sand patch
  for(let x = 3; x <= 9; x++){
    for(let z = 3; z <= 8; z++){
      if(mapHeights[x][z] === 0){
        mapHeights[x][z] = 1;
        mapTextures[x][z] = texSand;
      }
    }
  }
  //water pond
  for(let x = 22; x <= 27; x++){
    for(let z = 5; z <= 10; z++){
      if(mapHeights[x][z] === 0){
        mapHeights[x][z] = 1;
        mapTextures[x][z] = texWater;
      }
    }
  }
  //leaves bushes
  for(let x = 10; x <= 14; x++){
    for(let z = 22; z <= 26; z++){
      mapHeights[x][z] = 2;
      mapTextures[x][z] = texLeaves;
    }
  }
}
function worldToMap(wx, wz){
  const ix = Math.floor(wx - worldOffsetX);
  const iz = Math.floor(wz - worldOffsetZ);
  return [ix, iz];
}
function isBlockedAtWorld(wx, wz){
  const [ix, iz] = worldToMap(wx, wz);
  if(ix < 0 || ix >= worldWidth || iz < 0 || iz >= worldDepth) return true;
  return mapHeights[ix][iz] > 0;
}
function getFrontCell(){
  const forward = camera.getForwardXz();
  const p = new Vector3(camera.eye.elements);
  forward.mul(1.5);
  p.add(forward);
  return worldToMap(p.elements[0], p.elements[2]);
}
function placeBlock(){
  const [ix, iz] = getFrontCell();
  if(ix < 0 || ix >= worldWidth || iz < 0 || iz >= worldDepth) return;
  mapHeights[ix][iz] = clamp(mapHeights[ix][iz] + 1, 0, 4);
  mapTextures[ix][iz] = selectedBlock;
}
function breakBlock(){
  const [ix, iz] = getFrontCell();
  if(ix < 0 || ix >= worldWidth || iz < 0 || iz >= worldDepth) return;
  mapHeights[ix][iz] = clamp(mapHeights[ix][iz] - 1, 0, 4);
}
function tryMove(dx, dz){
  const nx = camera.eye.elements[0] + dx;
  const nz = camera.eye.elements[2] + dz;
  if(isBlockedAtWorld(nx, nz)) return;
  camera.translateXz(dx, dz);
}
//drawing
function setMaterial(baseRgba, texWeight, whichTexture){
  gl.uniform4f(uFragColorLoc, baseRgba[0], baseRgba[1], baseRgba[2], baseRgba[3]);
  gl.uniform1f(uTexColorWeightLoc, texWeight);
  gl.uniform1i(uWhichTextureLoc, whichTexture);
}
function drawCube(modelMatrix){
  gl.uniformMatrix4fv(uModelMatrixLoc, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}
function drawCubeColored(modelMatrix, rgba){
  setMaterial(rgba, 0.0, 0);
  drawCube(modelMatrix);
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
      const tex = mapTextures[x][z];
      for(let y = 0; y < h; y++){
        const m = new Matrix4();
        m.setIdentity();
        m.translate(x + worldOffsetX + 0.5, y + 0.5, z + worldOffsetZ + 0.5);
        if(texturesReady < 7){
          drawCubeColored(m, [0.6, 0.6, 0.6, 1.0]);
        }else{
          setMaterial([1, 1, 1, 1], 1.0, tex);
          drawCube(m);
        }
      }
    }
  }
}

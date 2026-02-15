window.ASG3 = window.ASG3 || {};
const ASG3 = window.ASG3;
var vertexShaderSource = `
  attribute vec3 a_Position;
  attribute vec2 a_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  varying vec2 v_UV;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(a_Position, 1.0);
    v_UV = a_UV;
  }
`;
var fragmentShaderSource = `
  precision mediump float;
  uniform vec4 u_FragColor;
  uniform float u_texColorWeight;
  uniform int u_whichTexture;

  uniform sampler2D uSampler0;
  uniform sampler2D uSampler1;
  uniform sampler2D uSampler2;
  uniform sampler2D uSampler3;
  uniform sampler2D uSampler4;
  uniform sampler2D uSampler5;
  uniform sampler2D uSampler6;

  varying vec2 vUV;
  void main() {
    vec4 texColor = vec4(1.0);
    if(u_whichTexture == 0) texColor = texture2D(uSampler0, vUV);
    else if(u_whichTexture == 1) texColor = texture2D(uSampler1, vUV);
    else if(u_whichTexture == 2) texColor = texture2D(uSampler2, vUV);
    else if(u_whichTexture == 3) texColor = texture2D(uSampler3, vUV);
    else if(u_whichTexture == 4) texColor = texture2D(uSampler4, vUV);
    else if(u_whichTexture == 5) texColor = texture2D(uSampler5, vUV);
    else if(u_whichTexture == 6) texColor = texture2D(uSampler6, vUV);

    float t = u_texColorWeight;
    gl_FragColor = (1.0 - t) * u_FragColor + t * texColor;
  }
  }
`;
//global variables
let canvas, gl;
let aPosition, aUv;
let uModelMatrix, uViewMatrix, uProjectionMatrix;
let uFragColor, uTexColorWeight, uWhichTexture;
let uSampler0, uSampler1, uSampler2;
let cubeBuffer = null;
let camera = null;
let keyState = Object.create(null);
//pointer lock mouse look
let pointerLocked = false;
//fallback drag look
let dragging = false;
let lastX = 0;
let lastY = 0;
//FPS
let lastFrameMs = 0;
let fpsCount = 0;
let fpsLastStamp = performance.now();
//textures loaded count (3)
let texturesReady = 0;
//Texture indices
const texStone = 0; //wall0.png
const texGrass = 1; //ground.png
const texWood = 2; //wall1.png
const texDirt = 3; //dirt.png
const texLeaves = 4; //leaves.png
const texSand = 5; //sand.png
const texWater = 6; //water.png
const blockNames = ["stone","grass","wood","dirt","leaves","sand","water"];
let selectedBlock = texStone;
//World
const worldW = 32;
const worldD = 32;
const offX = -worldW / 2;
const offZ = -worldD / 2;
let mapHeights = [];
let mapTextures = [];

// Game: sheep hunt
let sheepList = [];
const sheepCount = 7;
let hitCount = 0;
let gameWon = false;
let msgUntil = 0;
//Cube geometry
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
function clamp(v, lo, hi){
  return Math.max(lo, Math.min(hi, v));
}
function setCenterMsg(text, durationMs){
  const el = document.getElementById("centerMsg");
  if (!el) return;
  el.textContent = text;
  el.style.display = "block";
  msgUntil = performance.now() + durationMs;
}
function hideCenterMsgIfNeeded(){
  const el = document.getElementById("centerMsg");
  if(!el) return;
  if(el.style.display !== "none" && performance.now() > msgUntil && !gameWon){
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
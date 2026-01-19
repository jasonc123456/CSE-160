
// HelloPoint1.js (c) 2012 matsuda
// Vertex shader program
var vertexShaderSource = 
  'attribute vec4 a_Position;'+
  'uniform float u_Size;'+
  'void main() {\n' +
  '  gl_Position = a_Position;\n' + // Set the vertex coordinates of the point
  '  gl_PointSize = u_Size;' +                    // Set the point size
  '}';

// Fragment shader program
var fragmentShaderSource =
  'precision mediump float;'+
  'uniform vec4 u_FragColor;'+
  'void main() {' +
  '  gl_FragColor = u_FragColor;' + // Set the point color
  '}';
// global variables
let canvas, gl, aPosition, uFragColor, uPointSize;
let triangleVertexBuffer = null;
//Brush modes
const brushSquare = 0;
const brushTriangle = 1;
const brushCircle = 2;
// Default brush and settings
let selectedBrushType = brushSquare;
let selectedColorRgba = [1, 1, 1, 1];
let selectedSize = 10;
let selectedCircleSegments = 12;
//List holding all shapes that needs to be rendered
let shapes = [];
function setupWebGl(){
  canvas = document.getElementById("webgl");
  gl = canvas.getContext("webgl", {preserveDrawingBuffer: true});
  if(!gl){
    console.log("Failed to get WebGL context");
    return;
  }
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
}
function connectVariablesToGlsl(){
  if(!initShaders(gl, vertexShaderSource, fragmentShaderSource)){
    console.log("Failed to initialize shaders");
    return;
  }
  aPosition = gl.getAttribLocation(gl.program, "a_Position");
  if(aPosition < 0){
    console.log("Failed to get attribute location: a_Position");
    return;
  }
  uFragColor = gl.getUniformLocation(gl.program, "u_FragColor");
  if(!uFragColor){
    console.log("Failed to get uniform location: u_FragColor");
    return;
  }
  uPointSize = gl.getUniformLocation(gl.program, "u_Size");
  if(!uPointSize){
    console.log("Failed to get uniform location: u_Size");
    return;
  }
  triangleVertexBuffer = gl.createBuffer();
  if (!triangleVertexBuffer) {
    console.log("Failed to create shared triangle buffer");
    return;
  }
}
function renderAllShapes(){
  gl.clear(gl.COLOR_BUFFER_BIT);
  for(const shape of shapes){
    shape.render();
  }
}
function handleCanvasDraw(mouseEvent){
  const [clipX, clipY] = mouseEventToClipSpace(mouseEvent);
  let shapeToAdd;
  if (selectedBrushType === brushSquare) {
    shapeToAdd = new SquareShape();
  } else if (selectedBrushType === brushTriangle) {
    shapeToAdd = new TriangleShape();
  } else {
    shapeToAdd = new CircleShape();
    shapeToAdd.segments = selectedCircleSegments;
  }
  shapeToAdd.position = [clipX, clipY];
  shapeToAdd.color = [...selectedColorRgba];
  shapeToAdd.size = selectedSize;
  shapes.push(shapeToAdd);
  renderAllShapes();
}
function mouseEventToClipSpace(mouseEvent){
  const rect = mouseEvent.target.getBoundingClientRect();
  const pixelX = mouseEvent.clientX - rect.left;
  const pixelY = mouseEvent.clientY - rect.top;
  const clipX = (pixelX - canvas.width / 2) / (canvas.width / 2);
  const clipY = (canvas.height / 2 - pixelY) / (canvas.height / 2);
  return [clipX, clipY];
}
function addActionsForHtmlUi(){
  document.getElementById("clearButton").onclick = function () {
    shapes = [];
    renderAllShapes();
  };
  document.getElementById("squareButton").onclick = () => {
    selectedBrushType = brushSquare;
  };
  document.getElementById("triButton").onclick = () => {
    selectedBrushType = brushTriangle;
  };
  document.getElementById("circleButton").onclick = () => {
    selectedBrushType = brushCircle;
  };
  const updateSelectedColorFromSliders = () => {
    const r = document.getElementById("redSlide").value / 100;
    const g = document.getElementById("greenSlide").value / 100;
    const b = document.getElementById("blueSlide").value / 100;
    selectedColorRgba = [r, g, b, 1];
  };
  document.getElementById("redSlide").addEventListener("input", updateSelectedColorFromSliders);
  document.getElementById("greenSlide").addEventListener("input", updateSelectedColorFromSliders);
  document.getElementById("blueSlide").addEventListener("input", updateSelectedColorFromSliders);
  updateSelectedColorFromSliders();
  document.getElementById("sizeSlide").addEventListener("input", (ev) => {
    selectedSize = Number(ev.target.value);
  });
  document.getElementById("segSlide").addEventListener("input", (ev) => {
    selectedCircleSegments = Number(ev.target.value);
  });
}
function main(){
  setupWebGl();
  connectVariablesToGlsl();
  addActionsForHtmlUi();
  canvas.onmousedown = handleCanvasDraw;
  canvas.onmousemove = function (ev) {
    if (ev.buttons === 1) {
      handleCanvasDraw(ev);
    }
  };
  renderAllShapes();
}
class SquareShape{
  constructor(){
    this.position = [0, 0];
    this.color = [1, 1, 1, 1];
    this.size = 10;
  }
  render(){
    gl.uniform4f(uFragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1f(uPointSize, this.size);

    gl.vertexAttrib3f(aPosition, this.position[0], this.position[1], 0);
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}
function drawTriangleVertices(vertices){
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
class TriangleShape{
  constructor(){
    this.position = [0, 0];
    this.color = [1, 1, 1, 1];
    this.size = 10;
  }
  render(){
    gl.uniform4f(uFragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    const centerX = this.position[0];
    const centerY = this.position[1];
    const halfSize = this.size / 200;
    const vertices = [
      centerX,             centerY + halfSize,
      centerX - halfSize,  centerY - halfSize,
      centerX + halfSize,  centerY - halfSize,
    ];
    drawTriangleVertices(vertices);
  }
}
class CircleShape{
  constructor() {
    this.position = [0, 0];
    this.color = [1, 1, 1, 1];
    this.size = 10;
    this.segments = 12;
  }
  render(){
    gl.uniform4f(uFragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    const centerX = this.position[0];
    const centerY = this.position[1];
    const radius = this.size / 200;
    const angleStep = (2 * Math.PI) / this.segments;
    for (let i = 0; i < this.segments; i++){
      const angle0 = i * angleStep;
      const angle1 = (i + 1) * angleStep;
      const x0 = centerX + radius * Math.cos(angle0);
      const y0 = centerY + radius * Math.sin(angle0);
      const x1 = centerX + radius * Math.cos(angle1);
      const y1 = centerY + radius * Math.sin(angle1);
      drawTriangleVertices([centerX, centerY, x0, y0, x1, y1]);
    }
  }
}
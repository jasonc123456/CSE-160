
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
//Brush modes
const brushSquare = 0;
const brushTriangle = 1;
const brushCircle = 2;
// Default brush and settings
let selectedBrushType = brushSquare;
let selectedColorRgba = [1, 1, 1, 1];
let selectedSize = 10;
let selectedCircleSegments = 12;
function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Draw a point
  gl.drawArrays(gl.POINTS, 0, 1);
}

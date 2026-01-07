var ctx;
function main() {  
  // Retrieve <canvas> element
  var canvas = document.getElementById('example');  
  if (!canvas) { 
    console.log('Failed to retrieve the <canvas> element');
    return false; 
  } 

  // Get the rendering context for 2DCG
  ctx = canvas.getContext('2d');
  const v1 = new Vector3([2.25, 2.25, 0]);
  // Draw a blue rectangle
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 400, 400);        // Fill a rectangle with the color 400 x 400
  drawVector(v1, "red");
}
function drawVector(v, color){
  const xOrigin = ctx.canvas.width / 2;
  const yOrigin = ctx.canvas.height / 2;
  const scaleFactor = 20;
  const x1 = xOrigin + v.elements[0] * scaleFactor;
  const y1 = yOrigin - v.elements[1] * scaleFactor;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(xOrigin,yOrigin);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
class Camera {
  constructor(canvas) {
    this.fov = 60;
    this.eye = new Vector3([0, 1.7, 6]);
    this.yawDeg = 0;
    this.pitchDeg = 0;
    this.up = new Vector3([0, 1, 0]);
    this.at = new Vector3([0, 1.7, 5]);
    this.viewMatrix = new Matrix4();
    this.projectionMatrix = new Matrix4();
    this.projectionMatrix.setPerspective(this.fov, canvas.width / canvas.height, 0.1, 1000);
    this._updateAtAndView();
  }
  _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  _forward() {
    const yaw = this.yawDeg * Math.PI / 180.0;
    const pit = this.pitchDeg * Math.PI / 180.0;
    const fx = Math.sin(yaw) * Math.cos(pit);
    const fy = Math.sin(pit);
    const fz = -Math.cos(yaw) * Math.cos(pit);
    return new Vector3([fx, fy, fz]);
  }
  forwardXZ() {
    const f = this._forward();
    f.elements[1] = 0;
    f.normalize();
    return f;
  }
  rightXZ() {
    // right = forward x up
    const f = this.forwardXZ().elements;
    const u = this.up.elements;
    const rx = f[1]*u[2] - f[2]*u[1];
    const ry = f[2]*u[0] - f[0]*u[2];
    const rz = f[0]*u[1] - f[1]*u[0];
    const r = new Vector3([rx, ry, rz]);
    r.normalize();
    return r;
  }
  _updateAtAndView() {
    const f = this._forward();
    const ex = this.eye.elements[0];
    const ey = this.eye.elements[1];
    const ez = this.eye.elements[2];
    this.at = new Vector3([
      ex + f.elements[0],
      ey + f.elements[1],
      ez + f.elements[2],
    ]);
    this.viewMatrix.setLookAt(
      ex, ey, ez,
      this.at.elements[0], this.at.elements[1], this.at.elements[2],
      this.up.elements[0], this.up.elements[1], this.up.elements[2]
    );
  }
  rotateYaw(deltaDeg) {
    this.yawDeg += deltaDeg;
    this._updateAtAndView();
  }
  rotatePitch(deltaDeg) {
    this.pitchDeg = this._clamp(this.pitchDeg + deltaDeg, -85, 85);
    this._updateAtAndView();
  }
  translateXZ(dx, dz) {
    this.eye.elements[0] += dx;
    this.eye.elements[2] += dz;
    this._updateAtAndView();
  }
  getForwardXz() {return this.forwardXZ();}
  getRightXz() {return this.rightXZ();}
  translateXz(dx, dz) {return this.translateXZ(dx, dz);}
  updateView() {return this._updateAtAndView();}
}
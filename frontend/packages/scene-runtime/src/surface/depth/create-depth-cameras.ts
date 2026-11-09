import { Matrix4, PerspectiveCamera, Vector3 } from "three";
import { DEPTH_CUBE_FACES, DEPTH_FAR, DEPTH_NEAR } from "./constants";

export function createDepthCameras(sensorWorldMatrix: Matrix4) {
  // Sensor scale does not change measured meters.
  const pose = new Matrix4().extractRotation(sensorWorldMatrix);
  pose.setPosition(new Vector3().setFromMatrixPosition(sensorWorldMatrix));
  return DEPTH_CUBE_FACES.map(({ forward, up }) => {
    const camera = new PerspectiveCamera(90, 1, DEPTH_NEAR, DEPTH_FAR);
    camera.up.fromArray(up);
    camera.lookAt(new Vector3().fromArray(forward));
    camera.updateMatrix();
    camera.applyMatrix4(pose);
    camera.updateMatrixWorld(true);
    return camera;
  });
}

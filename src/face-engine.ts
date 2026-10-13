import * as faceapi from "@vladmandic/face-api";
import type { FaceObservation } from "./face-demo";
import { isDescriptor } from "./profile-store";

export interface FaceEngine {
  load(): Promise<void>;
  observe(video: HTMLVideoElement): Promise<FaceObservation>;
  dispose(): void;
}

export function createFaceEngine(): FaceEngine {
  let loaded: Promise<void> | null = null;
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });

  return {
    load() {
      loaded ??= Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ])
        .then(() => undefined)
        .catch((error: unknown) => {
          loaded = null;
          throw error;
        });
      return loaded;
    },
    async observe(video) {
      const faces = await faceapi
        .detectAllFaces(video, options)
        .withFaceLandmarks(true)
        .withFaceDescriptors();
      if (faces.length === 0) return { kind: "no-face" };
      if (faces.length > 1) return { kind: "multiple-faces" };
      const [face] = faces;
      const descriptor = Array.from(face.descriptor);
      if (!isDescriptor(descriptor))
        throw new Error("โมเดลส่งข้อมูลใบหน้าที่ใช้ไม่ได้");
      const { x, y, width, height } = face.detection.box;
      return { kind: "single-face", descriptor, box: { x, y, width, height } };
    },
    dispose() {
      faceapi.nets.tinyFaceDetector.dispose();
      faceapi.nets.faceLandmark68TinyNet.dispose();
      faceapi.nets.faceRecognitionNet.dispose();
    },
  };
}

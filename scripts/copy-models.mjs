import { copyFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model.bin",
  "face_landmark_68_tiny_model-weights_manifest.json",
  "face_landmark_68_tiny_model.bin",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model.bin",
];
const destination = path.join(root, "public", "models");
await mkdir(destination, { recursive: true });
for (const file of files) {
  const source = path.join(
    root,
    "node_modules",
    "@vladmandic",
    "face-api",
    "model",
    file,
  );
  try {
    await stat(source);
  } catch {
    throw new Error(
      `Missing model asset ${source}. Run npm install with @vladmandic/face-api 1.7.15.`,
    );
  }
  await copyFile(source, path.join(destination, file));
}
console.info(`Copied ${files.length} local model files to public/models.`);

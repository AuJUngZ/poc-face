# Face recognition POC architecture

## Problem

Build a small browser app with Register and Recognition tabs. A person captures three samples under one name, then the browser compares live camera frames against the local samples. The app stores only face descriptors and names in this browser. It does not upload images, videos, or descriptors. The workspace is empty, so there is no existing application design to preserve. Camera use requires localhost or HTTPS and user permission. A match is a similarity result, not proof of identity or liveness.

## Usage

The user opens the static Vite app, enters a name in Register, starts the camera, and captures three samples of one person. The app rejects empty or duplicate names, missing or multiple faces, and inconsistent samples. Saving writes the profile to this browser. In Recognition, the user starts the camera and sees a matched name or an unknown result. Removing a profile or resetting the local list deletes its descriptor.

```ts
const demo = createFaceDemo();
demo.subscribe(render);
await demo.initialize();
await demo.setMode('register');
await demo.startCamera(video);
await demo.captureSample();
await demo.saveProfile('Nong');
await demo.setMode('recognition');
await demo.startCamera(video);
demo.stop();
await demo.removeProfile(profileId);
await demo.resetProfiles();
demo.dispose();
```

## Shape

Use Vite, React, and TypeScript. One `FaceDemo` workbench owns tab mode, camera lifetime, enrollment state, and recognition scheduling. `FaceEngine` owns the library and face descriptors. `ProfileStore` owns browser storage and validates saved JSON at the storage boundary. `App.tsx` renders snapshots and sends user actions. It does not access descriptors or storage directly.

The browser app uses one state machine for its active session. This prevents enrollment and recognition from running at the same time, and gives every camera start and stop a clear state. A generation token discards results from an inference call that finishes after the user stops the camera. A late camera permission result must stop its tracks if the session has already ended.

```ts
type Mode = 'register' | 'recognition';
type ModelState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'failed'; message: string };
type SessionState =
  | { kind: 'idle' }
  | { kind: 'starting-camera'; mode: Mode }
  | { kind: 'register-ready'; sampleCount: 0 | 1 | 2 | 3 }
  | { kind: 'capturing-sample'; sampleCount: 0 | 1 | 2 }
  | { kind: 'saving-profile' }
  | { kind: 'recognizing'; result: RecognitionResult }
  | { kind: 'failed'; mode: Mode; message: string };
type RecognitionResult =
  | { kind: 'idle' }
  | { kind: 'no-face' }
  | { kind: 'multiple-faces' }
  | { kind: 'unknown' }
  | { kind: 'match'; profile: ProfileSummary; distance: number };
type ProfileSummary = Readonly<{ id: string; name: string; createdAt: number }>;
type FaceProfile = ProfileSummary & Readonly<{
  modelId: 'face-api-recognition-v1';
  descriptors: readonly [FaceDescriptor, FaceDescriptor, FaceDescriptor];
}>;
type FaceObservation =
  | { kind: 'no-face' }
  | { kind: 'multiple-faces' }
  | { kind: 'single-face'; descriptor: FaceDescriptor; box: { x: number; y: number; width: number; height: number } };
type FaceDescriptor = readonly number[];
type DemoSnapshot = Readonly<{
  mode: Mode;
  model: ModelState;
  session: SessionState;
  profiles: readonly ProfileSummary[];
}>;
type EnrollmentOutcome =
  | { kind: 'saved'; profile: ProfileSummary }
  | { kind: 'invalid-name' | 'duplicate-name' | 'no-face' | 'multiple-faces' | 'small-face' | 'inconsistent-samples' }
  | { kind: 'storage-failed'; message: string };
type CaptureOutcome =
  | { kind: 'sample-captured'; count: 1 | 2 | 3 }
  | { kind: 'no-face' | 'multiple-faces' | 'small-face' | 'inconsistent-samples' | 'camera-failed'; message?: string };
interface FaceEngine {
  load(): Promise<void>;
  observe(video: HTMLVideoElement): Promise<FaceObservation>;
  dispose(): void;
}
interface ProfileStore {
  list(): readonly FaceProfile[];
  add(profile: FaceProfile): void;
  remove(id: string): void;
  clear(): void;
}
interface FaceDemo {
  subscribe(listener: (snapshot: DemoSnapshot) => void): () => void;
  initialize(): Promise<void>;
  setMode(mode: Mode): Promise<void>;
  startCamera(video: HTMLVideoElement): Promise<void>;
  captureSample(): Promise<CaptureOutcome>;
  saveProfile(rawName: string): Promise<EnrollmentOutcome>;
  removeProfile(id: string): Promise<void>;
  resetProfiles(): Promise<void>;
  stop(): void;
  dispose(): void;
}
```

Profiles hold three descriptors but no source images. Enrollment validates all three descriptors and rejects captures whose pairwise distance exceeds a private consistency limit. Matching compares a recognition descriptor to the three saved samples and reports the closest average distance under one fixed POC threshold. The UI does not show that distance as a confidence percentage. `ProfileStore` persists a versioned profile list in one localStorage key. It parses unknown JSON once at that boundary and rejects incompatible model IDs. The list is small, so a single key is enough for this POC; cross-tab edits are outside its scope.

The implementation pins `@vladmandic/face-api` at 1.7.15 behind `FaceEngine`. The package includes browser ESM builds and pretrained model assets, and exposes face descriptors for comparison. Its upstream repository was archived on 2025-02-05, so this choice is limited to the POC. Review maintenance and model quality before extending it beyond a demo. Copy only `tiny_face_detector_model-weights_manifest.json`, `tiny_face_detector_model.bin`, `face_landmark_68_tiny_model-weights_manifest.json`, `face_landmark_68_tiny_model.bin`, `face_recognition_model-weights_manifest.json`, and `face_recognition_model.bin` into `public/models` with a deterministic script. Load them from the app's own origin. No remote fonts, analytics, CDN scripts, or model fallback belong in the runtime.

## Module map

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | Accessible tabs, camera view, enrollment form, result state, and local profile controls |
| `src/face-demo.ts` | Session state, camera cleanup, enrollment policy, recognition loop, and view snapshots |
| `src/face-engine.ts` | Model loading, face observations, descriptor validation, and face-library adaptation |
| `src/profile-store.ts` | Versioned localStorage data, JSON parsing, and local profile changes |
| `src/main.tsx` | React entry point |
| `src/index.css` | Responsive layout, camera frame, statuses, and focus states |
| `scripts/copy-models.mjs` | Copy the pinned model files from the package into the static app |
| `public/models/` | Same-origin model assets required at runtime |

## Synthesis decision

Candidate A is the base because its session state groups mutually exclusive camera and face-recognition actions. The cross-judge scored A 23/25, B 20/25, and C 19/25, and also selected A. The implementation uses React for clear UI updates and keeps A's single controller and model adapter. It adopts B's small-face rejection and tagged enrollment outcomes. It adopts C's case-insensitive name uniqueness, descriptor validation, and inconsistent-sample rejection. It uses localStorage instead of IndexedDB because a POC stores only a few small descriptors and does not need per-record transactions or cross-tab synchronization. It rejects the cross-tab message channel, separate camera interface, public model API, and worker design as unneeded for this scope.

## Tradeoffs accepted

- We accept three deliberate captures in exchange for keeping several views of one person's face in the local profile.
- We accept a fixed POC match threshold in exchange for a small first version; the result is not an accuracy or identity guarantee.
- We accept localStorage's same-origin access and tab-scoped update limits in exchange for a small local persistence layer.
- We accept an archived model package in exchange for a known browser API and included model assets; revisit this choice before expanding the POC.
- We accept a static Vite server during development because it serves files only; the app has no application backend.

## Alternatives considered

Candidate B puts workbench state behind one controller, but its independent mode, camera, recognition, and busy fields allow contradictory snapshots. It also enrolls one sample and separates the matcher without a clear benefit for this app.

Candidate C has strong descriptor types, but it asks the UI to coordinate camera sessions and model calls. Its camera adapter, IndexedDB vault, in-memory cache, and multiple capture abstractions add code beyond this POC.

IndexedDB would support larger profiles and transactional per-record edits. It exposes more storage lifecycle behavior than this browser demo needs. A service would enable profile sync but would violate the no-backend requirement.

## Implementation reconciliation

The implementation keeps the three-descriptor profile shape, tagged session state, and local-only storage boundary. It uses a serial observation queue: each queued request checks its session generation before invoking the face engine, and model tensors are disposed after the queue and model loading settle. Model files are copied from the pinned package into `public/models` and shipped with the static build.

## Open questions and risks

- The upstream model library is archived. A later product version needs a supported package and representative accuracy evaluation.
- A photo or video replay may match because this POC has no liveness detection.
- LocalStorage is not encrypted and is readable by scripts on the same origin. The page must state that descriptors stay in the browser and let users remove them.
- Model thresholds have not been calibrated for the user's camera, lighting, or participant set. The UI must not show a percentage or claim universal accuracy.
- Camera access works only after permission on localhost or HTTPS.

## Verification status

- `npm run build` succeeds and includes the application assets and all six local model files.
- The browser UI and model loading are verified on the local preview.
- Camera capture and recognition were not exercised because camera permission was not granted during review. Matching thresholds also remain uncalibrated against a representative dataset.

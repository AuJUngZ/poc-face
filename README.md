# Run Face Lab locally

Face Lab is a browser face recognition POC with **Register** and **Recognition** tabs. It processes camera frames in the browser and stores three face descriptors per profile in localStorage. It has no application backend.

## Start the app

Use Node.js 22.12 or later and npm.

```sh
npm install
npm run dev
```

Open the localhost URL that Vite prints. The app loads its models first. Click **เปิดกล้อง** to request camera access. Camera access requires localhost or HTTPS.

## Register a face

1. Open **Register**.
2. Enter a unique name with 1 to 60 characters.
3. Click **เปิดกล้อง** and allow camera access.
4. Keep one face in view, close to the camera, with even lighting.
5. Click **เก็บตัวอย่าง** three times. Change your face angle slightly between captures.
6. Click **บันทึกโปรไฟล์**.

The app rejects missing faces, multiple faces, small faces, and inconsistent samples. Name matching ignores leading spaces, trailing spaces, and case.

## Recognize a face

1. Open **Recognition**.
2. Click **เปิดกล้อง**.
3. Keep one face in view and wait for the result.

The result names the closest local profile below the POC distance threshold, or reports an unknown face. The app also reports missing faces and multiple faces. Click **หยุดกล้อง** to stop. Switching tabs, hiding the page, or leaving the page stops its camera tracks.

To remove one profile, click its delete button. To remove all profiles for this app, click **ล้างข้อมูลทั้งหมด** and confirm the dialog. If stored data cannot be read, the reset action also removes the incompatible data.

## Build static files

```sh
npm run build
npm run preview
```

The build writes the app to `dist/`. Serve that directory through HTTPS for camera access outside localhost. Vite serves static application files during development and preview.

The `predev` and `prebuild` scripts copy six model assets from the pinned package into `public/models/`. The script overwrites the same files on each run and fails if an asset is missing. The build includes those files in `dist/models/`. Keep that directory next to `dist/index.html` when hosting at the origin root.

## Data and POC limits

The app stores names, generated profile IDs, creation times, a model ID, and three 128-number descriptors per profile under `face-lab.profiles.v1`. It does not save camera images or videos. Profiles belong to the current browser and origin. They do not sync across devices or tabs.

LocalStorage is not encrypted. Scripts on the same origin can read the profiles. Clearing browser site data also removes them. The runtime loads scripts and models from its own origin and uses system fonts. It has no CDN, analytics, or remote model fallback.

A match is a similarity result. This POC does not prove identity or detect liveness. A photo or replay can match. Recognition quality depends on the camera, lighting, face angle, and participants. The thresholds have not been calibrated against a representative dataset, and the interface does not show a confidence percentage.

`@vladmandic/face-api` is pinned to `1.7.15`. Its upstream repository is archived. Its usage stays behind `src/face-engine.ts`; assess maintenance, model quality, and consent requirements before extending this POC into a product. The app uses TinyFaceDetector, the tiny 68-point landmark model, and the face recognition model.

For the selected data types and module ownership, read [the architecture contract](docs/architecture.md).

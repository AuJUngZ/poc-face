import { createFaceEngine, type FaceEngine } from "./face-engine";
import {
  createProfileStore,
  MODEL_ID,
  type ProfileStore,
} from "./profile-store";

export type Mode = "register" | "recognition";
export type FaceDescriptor = readonly number[];
export type ProfileSummary = Readonly<{
  id: string;
  name: string;
  createdAt: number;
}>;
export type FaceProfile = ProfileSummary &
  Readonly<{
    modelId: typeof MODEL_ID;
    descriptors: readonly [FaceDescriptor, FaceDescriptor, FaceDescriptor];
  }>;
export type ModelState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "failed"; message: string };
export type RecognitionResult =
  | { kind: "idle" }
  | { kind: "no-face" }
  | { kind: "multiple-faces" }
  | { kind: "unknown" }
  | { kind: "match"; profile: ProfileSummary; distance: number };
export type SessionState =
  | { kind: "idle" }
  | { kind: "starting-camera"; mode: Mode }
  | { kind: "register-ready"; sampleCount: 0 | 1 | 2 | 3 }
  | { kind: "capturing-sample"; sampleCount: 0 | 1 | 2 }
  | { kind: "saving-profile" }
  | { kind: "recognizing"; result: RecognitionResult }
  | { kind: "failed"; mode: Mode; message: string };
export type FaceObservation =
  | { kind: "no-face" }
  | { kind: "multiple-faces" }
  | {
      kind: "single-face";
      descriptor: FaceDescriptor;
      box: { x: number; y: number; width: number; height: number };
    };
export type DemoSnapshot = Readonly<{
  mode: Mode;
  model: ModelState;
  session: SessionState;
  profiles: readonly ProfileSummary[];
}>;
export type EnrollmentOutcome =
  | { kind: "saved"; profile: ProfileSummary }
  | {
      kind:
        | "invalid-name"
        | "duplicate-name"
        | "no-face"
        | "multiple-faces"
        | "small-face"
        | "inconsistent-samples";
    }
  | { kind: "storage-failed"; message: string };
export type CaptureOutcome =
  | { kind: "sample-captured"; count: 1 | 2 | 3 }
  | {
      kind:
        | "no-face"
        | "multiple-faces"
        | "small-face"
        | "inconsistent-samples"
        | "camera-failed";
      message?: string;
    };
export interface FaceDemo {
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

const MATCH_DISTANCE = 0.5;
const CONSISTENCY_DISTANCE = 0.45;
type Samples =
  | readonly []
  | readonly [FaceDescriptor]
  | readonly [FaceDescriptor, FaceDescriptor]
  | readonly [FaceDescriptor, FaceDescriptor, FaceDescriptor];

function distance(left: FaceDescriptor, right: FaceDescriptor): number {
  return Math.sqrt(
    left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0),
  );
}

function summary({ id, name, createdAt }: FaceProfile): ProfileSummary {
  return { id, name, createdAt };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด ลองอีกครั้ง";
}

function cameraMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError")
      return "ไม่อนุญาตให้ใช้กล้อง เปิดสิทธิ์กล้องใน Browser แล้วลองอีกครั้ง";
    if (error.name === "NotFoundError")
      return "ไม่พบกล้อง เชื่อมต่อกล้องแล้วลองอีกครั้ง";
    if (error.name === "NotReadableError")
      return "เปิดกล้องไม่ได้ ปิดแอปอื่นที่ใช้กล้องแล้วลองอีกครั้ง";
  }
  return message(error);
}

export function createFaceDemo(
  engine: FaceEngine = createFaceEngine(),
  store: ProfileStore = createProfileStore(),
): FaceDemo {
  let snapshot: DemoSnapshot = {
    mode: "register",
    model: { kind: "loading" },
    session: { kind: "idle" },
    profiles: [],
  };
  let profiles: readonly FaceProfile[] = [];
  let samples: Samples = [];
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let inference: Promise<FaceObservation> | null = null;
  const listeners = new Set<(value: DemoSnapshot) => void>();

  function update(changes: Partial<DemoSnapshot>): void {
    if (disposed) return;
    snapshot = { ...snapshot, ...changes };
    listeners.forEach((listener) => listener(snapshot));
  }

  function stop(): void {
    generation += 1;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (video) video.srcObject = null;
    video = null;
    samples = [];
    update({ session: { kind: "idle" } });
  }

  function fail(error: unknown): void {
    stop();
    update({
      session: {
        kind: "failed",
        mode: snapshot.mode,
        message: cameraMessage(error),
      },
    });
  }

  async function observe(target: HTMLVideoElement): Promise<FaceObservation> {
    // Tensor inference cannot be cancelled, so a new session waits for the previous call.
    if (inference) await inference.catch(() => undefined);
    const pending = engine.observe(target);
    inference = pending;
    try {
      return await pending;
    } finally {
      if (inference === pending) inference = null;
    }
  }

  function match(observation: FaceObservation): RecognitionResult {
    if (observation.kind !== "single-face") return observation;
    let best: { profile: FaceProfile; distance: number } | null = null;
    for (const profile of profiles) {
      const average =
        profile.descriptors.reduce(
          (sum, sample) => sum + distance(sample, observation.descriptor),
          0,
        ) / 3;
      if (!best || average < best.distance)
        best = { profile, distance: average };
    }
    return best && best.distance < MATCH_DISTANCE
      ? {
          kind: "match",
          profile: summary(best.profile),
          distance: best.distance,
        }
      : { kind: "unknown" };
  }

  async function recognize(
    token: number,
    target: HTMLVideoElement,
  ): Promise<void> {
    if (token !== generation || disposed) return;
    try {
      const observation = await observe(target);
      if (token !== generation || disposed) return;
      update({ session: { kind: "recognizing", result: match(observation) } });
      timer = setTimeout(() => {
        void recognize(token, target);
      }, 350);
    } catch (error) {
      if (token === generation && !disposed) fail(error);
    }
  }

  function refreshProfiles(): void {
    profiles = store.list();
    update({ profiles: profiles.map(summary) });
    if (snapshot.session.kind === "recognizing") {
      update({ session: { kind: "recognizing", result: { kind: "idle" } } });
    }
  }

  const hide = () => {
    if (document.hidden) stop();
  };
  const pageHide = () => stop();
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("pagehide", pageHide);

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    async initialize() {
      update({ model: { kind: "loading" } });
      try {
        refreshProfiles();
      } catch (error) {
        update({
          session: {
            kind: "failed",
            mode: snapshot.mode,
            message: `อ่านข้อมูลใน Browser ไม่ได้ · ${message(error)}`,
          },
        });
      }
      try {
        await engine.load();
        update({ model: { kind: "ready" } });
      } catch (error) {
        update({
          model: {
            kind: "failed",
            message: `โหลดโมเดลไม่ได้ · ${message(error)}`,
          },
        });
      }
    },
    async setMode(mode) {
      if (mode !== snapshot.mode) {
        stop();
        update({ mode });
      }
    },
    async startCamera(target) {
      if (disposed || snapshot.model.kind !== "ready") return;
      stop();
      const token = generation;
      update({ session: { kind: "starting-camera", mode: snapshot.mode } });
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("กล้องต้องเปิดผ่าน localhost หรือ HTTPS");
        }
        const acquired = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (token !== generation || disposed) {
          acquired.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = acquired;
        video = target;
        target.srcObject = acquired;
        acquired.getVideoTracks().forEach((track) => {
          track.addEventListener(
            "ended",
            () => {
              if (token === generation && !disposed)
                fail(new Error("กล้องหยุดทำงาน กดเปิดกล้องอีกครั้ง"));
            },
            { once: true },
          );
        });
        await target.play();
        if (token !== generation || disposed) return;
        if (snapshot.mode === "register")
          update({ session: { kind: "register-ready", sampleCount: 0 } });
        else {
          update({
            session: { kind: "recognizing", result: { kind: "idle" } },
          });
          void recognize(token, target);
        }
      } catch (error) {
        if (token === generation && !disposed) fail(error);
      }
    },
    async captureSample() {
      if (
        snapshot.session.kind !== "register-ready" ||
        snapshot.session.sampleCount === 3 ||
        !video ||
        samples.length === 3
      ) {
        return { kind: "camera-failed", message: "เปิดกล้องก่อนเก็บตัวอย่าง" };
      }
      const token = generation;
      const target = video;
      update({
        session: { kind: "capturing-sample", sampleCount: samples.length },
      });
      try {
        const observation = await observe(target);
        if (token !== generation || disposed)
          return { kind: "camera-failed", message: "การเก็บตัวอย่างถูกยกเลิก" };
        let outcome: CaptureOutcome;
        if (observation.kind !== "single-face") outcome = observation;
        else if (
          observation.box.width < target.videoWidth * 0.18 ||
          observation.box.height < target.videoHeight * 0.18
        )
          outcome = { kind: "small-face" };
        else if (
          samples.some(
            (sample) =>
              distance(sample, observation.descriptor) > CONSISTENCY_DISTANCE,
          )
        )
          outcome = { kind: "inconsistent-samples" };
        else {
          switch (samples.length) {
            case 0:
              samples = [observation.descriptor];
              break;
            case 1:
              samples = [samples[0], observation.descriptor];
              break;
            case 2:
              samples = [samples[0], samples[1], observation.descriptor];
              break;
          }
          outcome = { kind: "sample-captured", count: samples.length };
        }
        update({
          session: { kind: "register-ready", sampleCount: samples.length },
        });
        return outcome;
      } catch (error) {
        if (token === generation && !disposed) fail(error);
        return { kind: "camera-failed", message: cameraMessage(error) };
      }
    },
    async saveProfile(rawName) {
      const name = rawName.trim();
      if (!name || name.length > 60) return { kind: "invalid-name" };
      if (
        profiles.some(
          (profile) =>
            profile.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      )
        return { kind: "duplicate-name" };
      if (snapshot.session.kind !== "register-ready" || samples.length !== 3)
        return { kind: "no-face" };
      const profile: FaceProfile = {
        id: crypto.randomUUID(),
        name,
        createdAt: Date.now(),
        modelId: MODEL_ID,
        descriptors: samples,
      };
      update({ session: { kind: "saving-profile" } });
      try {
        store.add(profile);
        refreshProfiles();
        samples = [];
        update({ session: { kind: "register-ready", sampleCount: 0 } });
        return { kind: "saved", profile: summary(profile) };
      } catch (error) {
        update({ session: { kind: "register-ready", sampleCount: 3 } });
        return {
          kind: "storage-failed",
          message: `บันทึกข้อมูลใน Browser ไม่ได้ · ${message(error)}`,
        };
      }
    },
    async removeProfile(id) {
      store.remove(id);
      refreshProfiles();
    },
    async resetProfiles() {
      store.clear();
      refreshProfiles();
      stop();
    },
    stop,
    dispose() {
      stop();
      disposed = true;
      listeners.clear();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", pageHide);
      // Keep model tensors alive until an uncancellable inference or load finishes.
      void Promise.allSettled([inference, engine.load()]).then(() =>
        engine.dispose(),
      );
    },
  };
}

import type { FaceDescriptor, FaceProfile } from "./face-demo";

export const MODEL_ID = "face-api-recognition-v1";
const STORAGE_KEY = "face-lab.profiles.v1";

export interface ProfileStore {
  list(): readonly FaceProfile[];
  add(profile: FaceProfile): void;
  remove(id: string): void;
  clear(): void;
}

export function isDescriptor(value: unknown): value is FaceDescriptor {
  return (
    Array.isArray(value) &&
    value.length === 128 &&
    value.every(
      (entry: unknown) => typeof entry === "number" && Number.isFinite(entry),
    )
  );
}

function isProfile(value: unknown): value is FaceProfile {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    "name" in value &&
    typeof value.name === "string" &&
    value.name.trim() === value.name &&
    value.name.length > 0 &&
    value.name.length <= 60 &&
    "createdAt" in value &&
    typeof value.createdAt === "number" &&
    Number.isFinite(value.createdAt) &&
    "modelId" in value &&
    value.modelId === MODEL_ID &&
    "descriptors" in value &&
    Array.isArray(value.descriptors) &&
    value.descriptors.length === 3 &&
    value.descriptors.every(isDescriptor)
  );
}

export function createProfileStore(): ProfileStore {
  let cache: readonly FaceProfile[] | null = null;

  function list(): readonly FaceProfile[] {
    if (cache) return cache;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return (cache = []);
    const data: unknown = JSON.parse(raw);
    if (
      typeof data !== "object" ||
      data === null ||
      !("version" in data) ||
      data.version !== 1 ||
      !("profiles" in data) ||
      !Array.isArray(data.profiles) ||
      !data.profiles.every(isProfile)
    ) {
      throw new Error(
        "ข้อมูลที่บันทึกไว้ไม่เข้ากับโมเดลนี้ กดล้างข้อมูลทั้งหมดเพื่อเริ่มใหม่",
      );
    }
    const profiles = data.profiles;
    const names = new Set(
      profiles.map((profile) => profile.name.toLocaleLowerCase()),
    );
    const ids = new Set(profiles.map((profile) => profile.id));
    if (names.size !== profiles.length || ids.size !== profiles.length) {
      throw new Error(
        "ข้อมูลที่บันทึกไว้มีรายการซ้ำ กดล้างข้อมูลทั้งหมดเพื่อเริ่มใหม่",
      );
    }
    cache = profiles;
    return cache;
  }

  function write(profiles: readonly FaceProfile[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, profiles }));
    cache = profiles;
  }

  return {
    list,
    add(profile) {
      write([...list(), profile]);
    },
    remove(id) {
      write(list().filter((profile) => profile.id !== id));
    },
    clear() {
      localStorage.removeItem(STORAGE_KEY);
      cache = [];
    },
  };
}

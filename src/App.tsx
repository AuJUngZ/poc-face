import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  createFaceDemo,
  type CaptureOutcome,
  type DemoSnapshot,
  type EnrollmentOutcome,
  type Mode,
  type RecognitionResult,
} from "./face-demo";

function Icon({
  kind,
  size = 20,
}: {
  kind: "face" | "shield" | "camera" | "stop" | "plus" | "trash" | "check";
  size?: number;
}) {
  const paths = {
    face: (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
        <path d="M8 10h.01M16 10h.01M8 15c2 2 6 2 8 0" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    camera: (
      <>
        <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  );
}

function captureText(outcome: CaptureOutcome): string {
  switch (outcome.kind) {
    case "sample-captured":
      return `เก็บตัวอย่างที่ ${outcome.count} แล้ว ${outcome.count < 3 ? "เปลี่ยนมุมใบหน้าเล็กน้อยแล้วเก็บอีกครั้ง" : "พร้อมบันทึกโปรไฟล์"}`;
    case "no-face":
      return "ยังไม่พบใบหน้า มองกล้องแล้วลองอีกครั้ง";
    case "multiple-faces":
      return "พบมากกว่าหนึ่งใบหน้า ให้เหลือคนเดียวในภาพ";
    case "small-face":
      return "ใบหน้าเล็กเกินไป ขยับเข้าหากล้องแล้วลองอีกครั้ง";
    case "inconsistent-samples":
      return "ตัวอย่างไม่สอดคล้องกัน ใช้ใบหน้าคนเดิมและแสงใกล้เคียงเดิม";
    case "camera-failed":
      return outcome.message ?? "กล้องไม่พร้อม เปิดกล้องแล้วลองอีกครั้ง";
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

function enrollmentText(outcome: EnrollmentOutcome): string {
  switch (outcome.kind) {
    case "saved":
      return `บันทึก ${outcome.profile.name} ใน Browser นี้แล้ว`;
    case "invalid-name":
      return "ใส่ชื่อระหว่าง 1 ถึง 60 ตัวอักษร";
    case "duplicate-name":
      return "มีชื่อนี้แล้ว ใช้ชื่ออื่นหรือลบโปรไฟล์เดิม";
    case "no-face":
      return "เก็บตัวอย่างใบหน้าให้ครบ 3 ครั้งก่อนบันทึก";
    case "multiple-faces":
      return "ให้เหลือคนเดียวในภาพ";
    case "small-face":
      return "ขยับเข้าหากล้องแล้วเก็บตัวอย่างใหม่";
    case "inconsistent-samples":
      return "ตัวอย่างไม่สอดคล้องกัน เก็บตัวอย่างคนเดิมใหม่";
    case "storage-failed":
      return outcome.message;
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

function RecognitionCard({ result }: { result: RecognitionResult }) {
  const copy = {
    idle: ["กำลังตรวจจับ", "มองกล้องและรอผลจากโมเดลใน Browser"],
    "no-face": ["ยังไม่พบใบหน้า", "จัดใบหน้าให้อยู่ในภาพและเพิ่มแสงให้เพียงพอ"],
    "multiple-faces": ["พบหลายใบหน้า", "ให้เหลือคนเดียวในภาพเพื่อเปรียบเทียบ"],
    unknown: [
      "ไม่พบโปรไฟล์ที่ตรงกัน",
      "ลองปรับแสงและมุม หรือเพิ่มโปรไฟล์ใน Register",
    ],
    match: [
      "พบโปรไฟล์ใกล้เคียง",
      "ผลเปรียบเทียบจากตัวอย่างที่บันทึกใน Browser นี้",
    ],
  };
  const [title, detail] = copy[result.kind];
  return (
    <div
      className={`result-card ${result.kind === "match" ? "matched" : ""}`}
      role="status"
    >
      <div className="result-symbol">
        <Icon kind={result.kind === "match" ? "check" : "face"} size={26} />
      </div>
      <div>
        <span className="eyebrow">LIVE RESULT</span>
        <h3>{result.kind === "match" ? result.profile.name : title}</h3>
        <p>{result.kind === "match" ? `${title} · ${detail}` : detail}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [demo] = useState(createFaceDemo);
  const [snapshot, setSnapshot] = useState<DemoSnapshot>({
    mode: "register",
    model: { kind: "loading" },
    session: { kind: "idle" },
    profiles: [],
  });
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [resetOpen, setResetOpen] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const { mode, model, session, profiles } = snapshot;
  const active =
    session.kind === "register-ready" ||
    session.kind === "capturing-sample" ||
    session.kind === "saving-profile" ||
    session.kind === "recognizing";
  const starting = session.kind === "starting-camera";
  const sampleCount =
    session.kind === "register-ready" || session.kind === "capturing-sample"
      ? session.sampleCount
      : 0;

  useEffect(() => {
    const unsubscribe = demo.subscribe(setSnapshot);
    void demo.initialize();
    return () => {
      unsubscribe();
      demo.dispose();
    };
  }, [demo]);

  useEffect(() => {
    if (resetOpen) dialog.current?.showModal();
    else if (dialog.current?.open) {
      dialog.current.close();
      resetButton.current?.focus();
    }
  }, [resetOpen]);

  async function changeMode(next: Mode) {
    setNotice(null);
    await demo.setMode(next);
  }

  function tabKey(event: KeyboardEvent<HTMLButtonElement>, next: Mode) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    )
      return;
    event.preventDefault();
    const target =
      event.key === "Home"
        ? "register"
        : event.key === "End"
          ? "recognition"
          : next;
    void changeMode(target);
    document.getElementById(`tab-${target}`)?.focus();
  }

  async function capture() {
    setNotice(null);
    const outcome = await demo.captureSample();
    setNotice({
      text: captureText(outcome),
      error: outcome.kind !== "sample-captured",
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const outcome = await demo.saveProfile(name);
    setNotice({
      text: enrollmentText(outcome),
      error: outcome.kind !== "saved",
    });
    if (outcome.kind === "saved") setName("");
  }

  async function storageAction(action: () => Promise<void>) {
    try {
      await action();
      setNotice(null);
    } catch (error) {
      setNotice({
        text: `เปลี่ยนข้อมูลใน Browser ไม่ได้ · ${error instanceof Error ? error.message : "ลองอีกครั้ง"}`,
        error: true,
      });
    }
  }

  const status = starting
    ? "กำลังขอสิทธิ์กล้อง"
    : active
      ? "กล้องกำลังทำงาน"
      : "กล้องปิดอยู่";

  return (
    <div className="app-shell">
      <header className="header">
        <a className="brand" href="#">
          <span className="brand-icon">
            <Icon kind="face" size={25} />
          </span>
          <span>
            Face<span className="brand-light">Lab</span>
          </span>
          <span className="poc-tag">POC</span>
        </a>
        <div className="local-badge">
          <span className="dot" />
          100% client-side
        </div>
      </header>

      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">BROWSER FACE RECOGNITION</div>
            <h1>ให้ Browser จำใบหน้าคุณ</h1>
            <p>
              ลงทะเบียนใบหน้า แล้วลองเปรียบเทียบผ่านกล้อง
              <br className="mobile-break" /> ทุกขั้นตอนประมวลผลบนอุปกรณ์ของคุณ
            </p>
          </div>
          <div className="intro-mark">
            <Icon kind="face" size={72} />
          </div>
        </div>

        <div className="privacy-banner">
          <Icon kind="shield" />
          <p>
            <strong>ข้อมูลอยู่ใน Browser นี้</strong>{" "}
            ไม่มีการส่งภาพหรือข้อมูลใบหน้าออกจากอุปกรณ์ โมเดลโหลดจากเว็บไซต์นี้
          </p>
          <span className="privacy-label">LOCAL ONLY</span>
        </div>

        <div className="workbench">
          <section className="workspace-card">
            <div
              className="tabs"
              role="tablist"
              aria-label="Face recognition modes"
            >
              <button
                id="tab-register"
                role="tab"
                aria-selected={mode === "register"}
                aria-controls="face-panel"
                tabIndex={mode === "register" ? 0 : -1}
                className={mode === "register" ? "selected" : ""}
                onClick={() => void changeMode("register")}
                onKeyDown={(event) => tabKey(event, "recognition")}
              >
                <Icon kind="plus" />
                Register
              </button>
              <button
                id="tab-recognition"
                role="tab"
                aria-selected={mode === "recognition"}
                aria-controls="face-panel"
                tabIndex={mode === "recognition" ? 0 : -1}
                className={mode === "recognition" ? "selected" : ""}
                onClick={() => void changeMode("recognition")}
                onKeyDown={(event) => tabKey(event, "register")}
              >
                <Icon kind="face" />
                Recognition
              </button>
            </div>

            <div
              className="panel-content"
              id="face-panel"
              role="tabpanel"
              aria-labelledby={`tab-${mode}`}
            >
              <div className="section-heading">
                <div>
                  <h2>
                    {mode === "register"
                      ? "เพิ่มโปรไฟล์ใบหน้า"
                      : "ค้นหาใบหน้าที่ลงทะเบียน"}
                  </h2>
                  <p>
                    {mode === "register"
                      ? "เก็บตัวอย่าง 3 ครั้ง เพื่อบันทึกโปรไฟล์ของคุณ"
                      : "เปรียบเทียบใบหน้ากับโปรไฟล์ที่บันทึกไว้แบบสด"}
                  </p>
                </div>
                <span className="step-chip">
                  {mode === "register" ? "01 / REGISTER" : "02 / RECOGNIZE"}
                </span>
              </div>

              <div className="camera-frame">
                <video
                  ref={video}
                  muted
                  autoPlay
                  playsInline
                  aria-label="ภาพสดจากกล้อง"
                  className={active || starting ? "visible" : ""}
                />
                {!active && !starting && (
                  <div className="camera-placeholder">
                    <div className="placeholder-icon">
                      <Icon kind="camera" size={34} />
                    </div>
                    <h3>พร้อมเมื่อคุณพร้อม</h3>
                    <p>
                      กดเปิดกล้องเพื่อเริ่มใช้งาน
                      <br />
                      Browser จะขอสิทธิ์ใช้กล้องของคุณ
                    </p>
                  </div>
                )}
                {active && (
                  <div className="face-guide" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                <div className={`camera-status ${active ? "on" : ""}`}>
                  <span className="dot" />
                  {status}
                </div>
                <span className="camera-label">
                  {active ? "LIVE · LOCAL" : "CAMERA PREVIEW"}
                </span>
              </div>

              <div className="camera-toolbar">
                <span>
                  <span className={`model-dot ${model.kind}`} />
                  {model.kind === "ready"
                    ? "โมเดลพร้อมใช้งาน"
                    : model.kind === "loading"
                      ? "กำลังโหลดโมเดลในอุปกรณ์…"
                      : "โหลดโมเดลไม่สำเร็จ"}
                </span>
                <div>
                  {active || starting ? (
                    <button
                      className="button secondary compact"
                      onClick={() => {
                        demo.stop();
                        setNotice(null);
                      }}
                    >
                      <Icon kind="stop" size={16} />
                      หยุดกล้อง
                    </button>
                  ) : (
                    <button
                      className="button primary compact"
                      disabled={model.kind !== "ready"}
                      onClick={() => {
                        setNotice(null);
                        if (video.current) void demo.startCamera(video.current);
                      }}
                    >
                      <Icon kind="camera" size={17} />
                      เปิดกล้อง
                    </button>
                  )}
                </div>
              </div>

              {model.kind === "failed" && (
                <div className="alert error" role="alert">
                  <span>{model.message}</span>
                  <button onClick={() => void demo.initialize()}>
                    ลองโหลดใหม่
                  </button>
                </div>
              )}
              {session.kind === "failed" && (
                <div className="alert error" role="alert">
                  {session.message}
                </div>
              )}
              {notice && (
                <div
                  className={`alert ${notice.error ? "error" : "success"}`}
                  role="status"
                >
                  {notice.text}
                </div>
              )}

              {mode === "register" ? (
                <form
                  className="register-form"
                  onSubmit={(event) => void save(event)}
                >
                  <label htmlFor="profile-name">
                    ชื่อโปรไฟล์<span>ใช้ชื่อที่ไม่ซ้ำกับรายการเดิม</span>
                  </label>
                  <input
                    id="profile-name"
                    placeholder="เช่น Nong หรือชื่อเล่นของคุณ"
                    value={name}
                    maxLength={60}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="off"
                  />
                  <div className="sample-header">
                    <label>ตัวอย่างใบหน้า</label>
                    <span>{sampleCount} / 3 ตัวอย่าง</span>
                  </div>
                  <div className="sample-list">
                    {[1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className={`sample ${sampleCount >= step ? "complete" : ""}`}
                      >
                        <span>
                          {sampleCount >= step ? (
                            <Icon kind="check" size={17} />
                          ) : (
                            `0${step}`
                          )}
                        </span>
                        <div>
                          <strong>
                            {
                              ["มองตรง", "หันเล็กน้อย", "อีกมุมเล็กน้อย"][
                                step - 1
                              ]
                            }
                          </strong>
                          <small>
                            {sampleCount >= step
                              ? "เก็บแล้ว"
                              : "รอเก็บตัวอย่าง"}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="capture-hint">
                    ให้มีใบหน้าเดียว อยู่ใกล้กล้อง และใช้แสงสม่ำเสมอ
                  </p>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={
                        session.kind !== "register-ready" || sampleCount === 3
                      }
                      onClick={() => void capture()}
                    >
                      <Icon kind="camera" size={18} />
                      {session.kind === "capturing-sample"
                        ? "กำลังเก็บตัวอย่าง…"
                        : "เก็บตัวอย่าง"}
                    </button>
                    <button
                      className="button primary"
                      disabled={
                        session.kind !== "register-ready" ||
                        sampleCount !== 3 ||
                        !name.trim()
                      }
                    >
                      <Icon kind="plus" size={18} />
                      บันทึกโปรไฟล์
                    </button>
                  </div>
                </form>
              ) : (
                <div className="recognition-section">
                  <RecognitionCard
                    result={
                      session.kind === "recognizing"
                        ? session.result
                        : { kind: "idle" }
                    }
                  />
                  <p className="recognition-note">
                    {profiles.length === 0
                      ? "ยังไม่มีโปรไฟล์ ไปที่ Register เพื่อเพิ่มใบหน้าก่อน"
                      : `พร้อมเปรียบเทียบกับ ${profiles.length} โปรไฟล์ใน Browser นี้`}
                    <br />
                    ผลที่แสดงคือความใกล้เคียงของใบหน้า ไม่ใช่การยืนยันตัวตน
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="side-column">
            <section className="profiles-card">
              <div className="profile-heading">
                <h2>โปรไฟล์ในอุปกรณ์</h2>
                <span>{profiles.length}</span>
              </div>
              <p className="side-description">
                บันทึกไว้สำหรับ Browser และเว็บไซต์นี้
              </p>
              {profiles.length === 0 ? (
                <div className="empty-profiles">
                  <div className="empty-icon">
                    <Icon kind="face" size={29} />
                  </div>
                  <h3>เริ่มจากใบหน้าแรก</h3>
                  <p>
                    โปรไฟล์ที่ลงทะเบียนจะแสดงที่นี่
                    <br />
                    กลับมาใช้งานได้เมื่อเปิดเว็บไซต์อีกครั้ง
                  </p>
                </div>
              ) : (
                <ul className="profile-list">
                  {profiles.map((profile) => (
                    <li key={profile.id}>
                      <span className="avatar">
                        {Array.from(profile.name)[0]}
                      </span>
                      <div>
                        <strong>{profile.name}</strong>
                        <small>
                          3 ตัวอย่าง ·{" "}
                          {new Date(profile.createdAt).toLocaleDateString(
                            "th-TH",
                            { day: "numeric", month: "short" },
                          )}
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`ลบโปรไฟล์ ${profile.name}`}
                        onClick={() =>
                          void storageAction(() =>
                            demo.removeProfile(profile.id),
                          )
                        }
                      >
                        <Icon kind="trash" size={17} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                ref={resetButton}
                className="reset-button"
                onClick={() => setResetOpen(true)}
              >
                <Icon kind="trash" size={16} />
                ล้างข้อมูลทั้งหมด
              </button>
            </section>
            <section className="how-card">
              <span className="eyebrow">HOW IT WORKS</span>
              <h2>ทำงานในอุปกรณ์คุณ</h2>
              <ol>
                <li>
                  <span>1</span>
                  <div>
                    <strong>เปิดกล้องด้วยตัวคุณเอง</strong>
                    <p>กล้องทำงานหลังคุณกดอนุญาตเท่านั้น</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>โมเดลอ่านลักษณะใบหน้า</strong>
                    <p>เปรียบเทียบตัวเลขที่ได้ใน Browser</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>บันทึกเฉพาะชื่อและลักษณะ</strong>
                    <p>ไม่บันทึกรูปภาพหรือวิดีโอจากกล้อง</p>
                  </div>
                </li>
              </ol>
              <div className="storage-note">
                <Icon kind="shield" size={18} />
                <p>
                  ข้อมูลใน localStorage ไม่เข้ารหัส
                  และสคริปต์บนเว็บไซต์เดียวกันอ่านได้ ลบได้ทุกเมื่อจากหน้านี้
                </p>
              </div>
            </section>
          </aside>
        </div>
        <footer>
          <span>
            Face Lab <span className="footer-separator">/</span> Browser
            experiment
          </span>
          <p>
            POC สำหรับทดลอง · ไม่รับประกันความแม่นยำ · ไม่ตรวจจับ liveness
            หรือใช้ยืนยันตัวตน
          </p>
        </footer>
      </main>
      <dialog
        ref={dialog}
        className="reset-dialog"
        onCancel={() => setResetOpen(false)}
      >
        <h2>ล้างโปรไฟล์ทั้งหมด?</h2>
        <p>
          ชื่อและข้อมูลใบหน้าที่บันทึกในเว็บไซต์นี้จะถูกลบ
          คุณต้องลงทะเบียนใหม่เพื่อใช้งานอีกครั้ง
        </p>
        <div className="form-actions">
          <button
            className="button secondary"
            autoFocus
            onClick={() => setResetOpen(false)}
          >
            ยกเลิก
          </button>
          <button
            className="button danger"
            onClick={() => {
              void storageAction(() => demo.resetProfiles());
              setResetOpen(false);
            }}
          >
            ล้างข้อมูลทั้งหมด
          </button>
        </div>
      </dialog>
    </div>
  );
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import screen1Video from "./assets/screen1.mp4";
import guidingImg from "./assets/guiding.png";
import mainBgImg from "./assets/main.jpg";
import {
  LEAF_POSITIONS,
  FRAME_WIDTH,
  FRAME_HEIGHT,
} from "./leaf-positions";
import questionsFallback from "./questions-sample.json";

const MOCKAPI = import.meta.env.VITE_MOCKAPI || "";
const QUESTION_TIME = 15;
const QUESTION_TIME_MS = QUESTION_TIME * 1000;

// 'figma' = nền Figma | 'image' = ảnh main.jpg
const TREE_BACKGROUND = "figma";
const MAX_QUESTIONS = LEAF_POSITIONS.length; // 115 lá theo vị trí Figma

const _ac = (() => {
  const m = new Map();
  return {
    set(id, v) {
      m.set(id, v);
    },
    get(id) {
      return m.get(id);
    },
  };
})();

function transformApiQuestion(q, idPrefix = "") {
  if (!q || typeof q !== "object") return null;
  const opts =
    q.A != null
      ? [q.A, q.B, q.C, q.D]
      : [q.dap_anA, q.dap_anB, q.dap_anC, q.dap_anD];
  const options = opts.filter(Boolean);
  const key = (q.dap_an_dung ?? q.CautraLoi ?? "A")
    .toString()
    .toUpperCase()
    .slice(0, 1);
  const ans = q[key] ?? q["dap_an" + key] ?? options[0];
  const baseId = String(q.id ?? "").trim() || Math.random().toString(36).slice(2);
  const id = idPrefix ? `${idPrefix}-${baseId}` : baseId;
  _ac.set(id, ans ?? options[0]);
  const isHard = q.cau_hoi_kho === true || q.cau_hoi_kho === "true";
  return {
    id,
    difficulty: isHard ? "rare" : "normal",
    text: (q.noi_dung ?? q.cau_hoi ?? "").trim(),
    options: options.length ? options : ["A", "B", "C", "D"],
  };
}

const PLAYERS_API = (base) =>
  base ? `${base.replace(/\/$/, "")}/players` : "";

const FIGMA_EMBED_URL =
  "https://embed.figma.com/proto/dnX2BTrTQ810rkLJ7zfiRZ/Untitled?node-id=6-11&p=f&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&embed-host=share&hide-ui=1";

function TreeFrame({
  questions,
  usedLeafIds,
  onLeafClick,
  questionsLoading,
  containerRef,
  backgroundMode = "figma",
}) {
  const displayCount = Math.min(questions.length, LEAF_POSITIONS.length);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const sx = w / FRAME_WIDTH;
      const sy = h / FRAME_HEIGHT;
      setScale(Math.max(sx, sy));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return (
    <div
      className="tree-frame tree-frame-figma"
      style={{
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
        minWidth: FRAME_WIDTH,
        minHeight: FRAME_HEIGHT,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
      }}
    >
      {backgroundMode === "image" && (
        <img
          className="tree-frame-background"
          src={mainBgImg}
          alt=""
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: FRAME_WIDTH,
            height: FRAME_HEIGHT,
            objectFit: "cover",
            zIndex: 0,
          }}
        />
      )}
      <iframe
        className="tree-frame-iframe"
        src={FIGMA_EMBED_URL}
        title="Cây triết học - Figma"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          border: "none",
          pointerEvents: "none",
        }}
      />
      <div className="tree-frame-overlay" aria-hidden="true">
        {questionsLoading ? (
          <p className="tree-loading tree-frame-loading">Đang tải câu hỏi...</p>
        ) : (
          displayCount > 0 &&
          LEAF_POSITIONS.slice(0, displayCount).map((pos, i) => {
            const q = questions[i];
            const used = q && usedLeafIds.has(q.id);
            return (
              <React.Fragment key={q?.id ?? i}>
                <button
                  type="button"
                  className={`tree-frame-leaf ${used ? "tree-leaf-used" : ""}`}
                  style={{
                    left: pos.left,
                    top: pos.top,
                    width: pos.width,
                    height: pos.height,
                  }}
                  onClick={() => q && onLeafClick(q)}
                  title={used ? "Đã chơi" : "Chọn câu hỏi"}
                >
                  {used && <span className="tree-leaf-used-mark">✓</span>}
                </button>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}

export function HistoryGameApp() {
  const playerName = "Người chơi";
  const [scene, setScene] = useState("screen1");
  const preloadedRef = useRef(false);
  const treeFrameContainerRef = useRef(null);

  const [score, setScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [remainingMs, setRemainingMs] = useState(QUESTION_TIME_MS);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [usedLeafIds, setUsedLeafIds] = useState(new Set());
  const [showHelp, setShowHelp] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardRefresh] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [gameSession, setGameSession] = useState(0);
  const [allQuestions, setAllQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const handleStartTransition = useCallback(() => {
    if (scene !== "screen1") return;
    setScene("screen2");
  }, [scene]);

  useEffect(() => {
    if (preloadedRef.current) return;
    preloadedRef.current = true;
    const sources = [screen1Video];
    const els = sources.map((src) => {
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      v.src = src;
      try {
        v.load();
      } catch {
        // ignore
      }
      return v;
    });
    const imgs = [guidingImg, mainBgImg].map(
      (src) => {
        const im = new Image();
        im.src = src;
        return im;
      }
    );
    return () => {
      els.forEach((v) => {
        try {
          v.removeAttribute("src");
          v.load();
        } catch {
          // ignore
        }
      });
      imgs.forEach((im) => {
        im.src = "";
      });
    };
  }, []);

  useEffect(() => {
    if (scene !== "screen2") return;
    queueMicrotask(() => setQuestionsLoading(true));
    const base = MOCKAPI ? MOCKAPI.replace(/\/$/, "") : "";
    const questionsUrl = base ? `${base}/questions` : "";
    const questions2Url = base ? `${base}/questions2` : "";
    const toQuestions = (data, prefix) => {
      const list = Array.isArray(data) ? data : [];
      return list
        .map((q) => transformApiQuestion(q, prefix))
        .filter((q) => q && q.text && q.options?.length);
    };
    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
    const applyQuestions = (questionsData, questions2Data) => {
      const primary = shuffle(toQuestions(questionsData, "q1"));
      const secondary = shuffle(toQuestions(questions2Data, "q2"));
      let questions = primary.slice(0, MAX_QUESTIONS);
      if (questions.length < MAX_QUESTIONS) {
        questions = [
          ...questions,
          ...secondary.slice(0, MAX_QUESTIONS - questions.length),
        ];
      }
      if (questions.length === 0) {
        questions = shuffle(toQuestions(questionsFallback, "local")).slice(
          0,
          MAX_QUESTIONS
        );
      }
      setAllQuestions(questions);
    };
    if (questionsUrl) {
      Promise.allSettled([
        fetch(questionsUrl).then((res) => res.json()),
        fetch(questions2Url).then((res) => res.json()),
      ])
        .then(([r1, r2]) => {
          const data1 = r1.status === "fulfilled" ? r1.value : [];
          const data2 = r2.status === "fulfilled" ? r2.value : [];
          applyQuestions(data1, data2);
        })
        .catch(() => applyQuestions(questionsFallback, []))
        .finally(() => setQuestionsLoading(false));
    } else {
      applyQuestions(questionsFallback, []);
      queueMicrotask(() => setQuestionsLoading(false));
    }
  }, [scene, gameSession]);

  useEffect(() => {
    const seen = window.localStorage.getItem("history-tree-help-shown");
    if (!seen) {
      queueMicrotask(() => setShowHelp(true));
    }
  }, []);

  useEffect(() => {
    if (!showLeaderboard) return;
    queueMicrotask(() => setLeaderboardLoading(true));
    const url = PLAYERS_API(MOCKAPI);
    const applyLeaderboard = (data) => {
      const list = Array.isArray(data) ? data : [];
      const sorted = [...list]
        .sort(
          (a, b) =>
            (Number(b.Score ?? b.score) || 0) -
            (Number(a.Score ?? a.score) || 0)
        )
        .slice(0, 10);
      setLeaderboard(sorted);
    };
    if (url) {
      fetch(url)
        .then((res) => res.json())
        .then(applyLeaderboard)
        .catch(() => applyLeaderboard([]))
        .finally(() => setLeaderboardLoading(false));
    } else {
      applyLeaderboard([]);
      queueMicrotask(() => setLeaderboardLoading(false));
    }
  }, [showLeaderboard, leaderboardRefresh]);

  useEffect(() => {
    if (!currentQuestion) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const elapsed = now - start;
      const next = Math.max(0, QUESTION_TIME_MS - elapsed);
      setRemainingMs(next);
      if (next > 0) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentQuestion]);

  function openQuestion(question) {
    if (usedLeafIds.has(question.id)) return;
    setRemainingMs(QUESTION_TIME_MS);
    setSelectedAnswer("");
    setCurrentQuestion(question);
  }

  function closeQuestion() {
    setCurrentQuestion(null);
    setSelectedAnswer("");
  }

  function handlePlayAgain() {
    setShowCongrats(false);
    setScore(0);
    setUsedLeafIds(new Set());
    setCurrentQuestion(null);
    setAllQuestions([]);
    setGameSession((s) => s + 1);
    if (scene !== "screen2") setScene("screen2");
  }

  function handleViewLeaderboard() {
    setShowCongrats(false);
    setShowLeaderboard(true);
  }

  function handleSubmitAnswer(option) {
    if (!currentQuestion) return;
    if (remainingMs <= 0) return;
    setSelectedAnswer(option);
    const isCorrect = option === _ac.get(currentQuestion.id);
    const base = currentQuestion.difficulty === "rare" ? 20 : 10;
    if (isCorrect) {
      setScore((s) => s + base);
    }
    setUsedLeafIds((prev) => {
      const n = new Set(prev);
      n.add(currentQuestion.id);
      if (allQuestions.length > 0 && n.size >= allQuestions.length) {
        queueMicrotask(() => setShowCongrats(true));
      }
      return n;
    });
    setTimeout(closeQuestion, 800);
  }

  const timeRatio = currentQuestion
    ? Math.max(0, remainingMs) / QUESTION_TIME_MS
    : 0;
  const displaySeconds = Math.ceil(Math.max(0, remainingMs) / 1000);

  return (
    <div className="tree-root">
      {scene === "screen1" && (
        <video
          className="tree-screen-video tree-scene-fade-in"
          src={screen1Video}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      )}
      {scene === "screen1" && (
        <>
          <div className="tree-guiding-panel tree-scene-fade-in" aria-hidden>
            <img src={guidingImg} alt="" className="tree-guiding-img" />
            <p className="tree-guiding-caption">Ấn bất kì để vào game</p>
          </div>
          <div
            className="tree-click-overlay"
            onClick={() => {
              handleStartTransition();
            }}
            onKeyDown={(e) => {
              e.preventDefault();
              handleStartTransition();
            }}
            role="button"
            tabIndex={0}
            aria-label="Bấm hoặc nhấn phím bất kì để tiếp tục"
          />
        </>
      )}

      {showCongrats && (
        <div className="tree-dialog-backdrop tree-congrats-backdrop">
          <div className="tree-dialog tree-congrats-dialog">
            <h3 className="tree-congrats-title">Chúc mừng!</h3>
            <div className="tree-congrats-content">
              <img src={guidingImg} alt="" className="tree-congrats-img" />
              <div className="tree-congrats-score-wrap">
                <p className="tree-congrats-player">👋 {playerName}</p>
                <p className="tree-congrats-score">
                  Điểm của bạn: <strong>{score}</strong>
                </p>
              </div>
            </div>
            <p className="tree-congrats-saved">Điểm đã được lưu.</p>
            <div className="tree-congrats-actions">
              <button
                type="button"
                className="tree-button primary"
                onClick={handlePlayAgain}
              >
                Chơi lại
              </button>
              <button
                type="button"
                className="tree-button tree-leaderboard-btn"
                onClick={handleViewLeaderboard}
              >
                Xem bảng xếp hạng
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <div
          className="tree-dialog-backdrop"
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            className="tree-dialog tree-leaderboard-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tree-dialog-header">
              <h3>Bảng xếp hạng</h3>
              <button
                type="button"
                className="tree-dialog-close"
                onClick={() => setShowLeaderboard(false)}
              >
                ×
              </button>
            </div>
            {leaderboardLoading ? (
              <p className="tree-loading">Đang tải...</p>
            ) : leaderboard.length === 0 ? (
              <p className="tree-question-text">Chưa có dữ liệu.</p>
            ) : (
              <ol className="tree-leaderboard-list">
                {leaderboard.map((p, i) => (
                  <li key={p.id} className="tree-leaderboard-item">
                    <span className="tree-leaderboard-rank">{i + 1}</span>
                    <span className="tree-leaderboard-name">
                      {p.name || "—"}
                    </span>
                    <span className="tree-leaderboard-score">
                      {p.Score ?? p.score ?? 0}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {scene === "screen2" && (
        <div
          ref={treeFrameContainerRef}
          className="tree-frame-overlay-full tree-scene-fade-in-slow"
          style={
            TREE_BACKGROUND === "image"
              ? { background: `url(${mainBgImg}) center / cover no-repeat` }
              : { background: "#f5f5f0" }
          }
        >
          <TreeFrame
            containerRef={treeFrameContainerRef}
            backgroundMode={TREE_BACKGROUND}
            questions={allQuestions}
            usedLeafIds={usedLeafIds}
            onLeafClick={openQuestion}
            questionsLoading={questionsLoading}
          />
        </div>
      )}

      {showHelp && (
        <div className="tree-dialog-backdrop">
          <div className="tree-dialog">
            <div className="tree-dialog-header">
              <h3>Hướng dẫn chơi</h3>
              <button
                type="button"
                className="tree-dialog-close"
                onClick={() => {
                  setShowHelp(false);
                  window.localStorage.setItem("history-tree-help-shown", "1");
                }}
              >
                ×
              </button>
            </div>
            <p className="tree-question-text">
              Cây ở giữa màn hình là bản đồ câu hỏi lịch sử. Mỗi chiếc lá là một
              câu hỏi, bạn có 15 giây để trả lời.
            </p>
            <ul className="tree-help-list">
              <li>Điểm của bạn được lưu trên máy chủ theo tên đã nhập.</li>
              <li>Lá xanh +10 điểm, lá vàng (câu khó) +20 điểm (nhân đôi).</li>
              <li>
                Mỗi lá chỉ chơi được một lần. Hết thời gian hoặc trả lời sai thì
                lá đó cũng coi như đã dùng.
              </li>
            </ul>
            <button
              type="button"
              className="tree-button primary"
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => {
                setShowHelp(false);
                window.localStorage.setItem("history-tree-help-shown", "1");
              }}
            >
              Đã hiểu, bắt đầu chơi
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="tree-help-button"
        onClick={() => setShowHelp(true)}
      >
        Hướng dẫn chơi
      </button>

      {currentQuestion && (
        <div className="tree-dialog-backdrop">
          <div className="tree-dialog">
            <div className="tree-dialog-header">
              <h3>Câu hỏi</h3>
              <button
                type="button"
                className="tree-dialog-close"
                onClick={closeQuestion}
              >
                ×
              </button>
            </div>
            <p className="tree-question-text">{currentQuestion.text}</p>
            <div className="tree-timer-bar">
              <div
                className="tree-timer-fill"
                style={{ width: `${timeRatio * 100}%` }}
              />
            </div>
            <div className="tree-timer-label">Còn {displaySeconds}s</div>
            <div className="tree-options">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedAnswer === opt;
                const isCorrect = opt === _ac.get(currentQuestion.id);
                let cls = "tree-option";
                if (selectedAnswer) {
                  if (isCorrect) cls += " correct";
                  else if (isSelected) cls += " wrong";
                }
                return (
                  <button
                    key={opt}
                    type="button"
                    className={cls}
                    onClick={() => handleSubmitAnswer(opt)}
                    disabled={!!selectedAnswer || remainingMs <= 0}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

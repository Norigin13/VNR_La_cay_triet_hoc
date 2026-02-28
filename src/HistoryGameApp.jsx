import React, { useCallback, useEffect, useRef, useState } from "react";
import screen1Video from "./assets/screen1.mp4";
import transitionVideo from "./assets/transition.mp4";

const MOCKAPI = import.meta.env.VITE_MOCKAPI || "";

function transformApiQuestion(q) {
  const opts =
    q.A != null
      ? [q.A, q.B, q.C, q.D]
      : [q.dap_anA, q.dap_anB, q.dap_anC, q.dap_anD];
  const options = opts.filter(Boolean);
  const key = (q.dap_an_dung ?? q.CautraLoi ?? "A")
    .toString()
    .toUpperCase()
    .slice(0, 1);
  const answer = q[key] ?? q["dap_an" + key] ?? options[0];
  const isHard = q.cau_hoi_kho === true || q.cau_hoi_kho === "true";
  return {
    id: String(q.id),
    difficulty: isHard ? "rare" : "normal",
    text: (q.noi_dung ?? q.cau_hoi ?? "").trim(),
    options: options.length ? options : ["A", "B", "C", "D"],
    answer: answer ?? options[0],
  };
}
import screen2Video from "./assets/screen2.mp4";
import leafGreenImg from "./assets/laxanh-removebg-preview.png";
import leafYellowImg from "./assets/lavang-removebg-preview.png";

const QUESTION_TIME = 15; // seconds

const CANOPY_WIDTH = 800;
const CANOPY_HEIGHT = 580;
const LEAF_SIZE = 48;
/** Khoảng cách tối thiểu giữa các lá: 1–2cm ≈ 38–76px, dùng 50px */
const MIN_LEAF_GAP = 50;

function generateRandomLeafPositions(count) {
  const positions = [];
  const maxLeft = CANOPY_WIDTH - LEAF_SIZE;
  const maxTop = CANOPY_HEIGHT - LEAF_SIZE;
  const maxAttempts = 800;

  for (let i = 0; i < count; i++) {
    let pos = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = {
        left: Math.random() * maxLeft,
        top: Math.random() * maxTop,
      };
      const cx = candidate.left + LEAF_SIZE / 2;
      const cy = candidate.top + LEAF_SIZE / 2;
      const tooClose = positions.some((p) => {
        const pcx = p.left + LEAF_SIZE / 2;
        const pcy = p.top + LEAF_SIZE / 2;
        const dx = cx - pcx;
        const dy = cy - pcy;
        return Math.sqrt(dx * dx + dy * dy) < MIN_LEAF_GAP;
      });
      if (!tooClose) {
        pos = candidate;
        break;
      }
    }
    positions.push(
      pos ?? { left: Math.random() * maxLeft, top: Math.random() * maxTop }
    );
  }
  return positions;
}

const PLAYERS_API = (base) =>
  base ? `${base.replace(/\/$/, "")}/players` : "";

export function HistoryGameApp() {
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [score, setScore] = useState(0);
  const [nameSaving, setNameSaving] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [remainingTime, setRemainingTime] = useState(QUESTION_TIME);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [usedLeafIds, setUsedLeafIds] = useState(new Set());
  const [showHelp, setShowHelp] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [scene, setScene] = useState("screen1"); // screen1 | transition | screen2
  const transitionRef = useRef(null);

  const handleTransitionEnd = useCallback(() => {
    setScene("screen2");
  }, []);

  const handleStartTransition = useCallback(() => {
    if (scene !== "screen1" || !loggedIn) return;
    setScene("transition");
  }, [scene, loggedIn]);

  const [allQuestions, setAllQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [leafPositions, setLeafPositions] = useState([]);

  useEffect(() => {
    if (scene !== "screen2") return;
    setQuestionsLoading(true);
    const url = MOCKAPI ? `${MOCKAPI.replace(/\/$/, "")}/questions` : null;
    if (url) {
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          const transformed = list
            .map(transformApiQuestion)
            .filter((q) => q.text && q.options?.length);
          const shuffled = [...transformed].sort(() => Math.random() - 0.5);
          const questions = shuffled.slice(0, 20);
          setAllQuestions(questions);
          setLeafPositions(generateRandomLeafPositions(questions.length));
        })
        .catch(() => {
          setAllQuestions([]);
          setLeafPositions([]);
        })
        .finally(() => setQuestionsLoading(false));
    } else {
      setAllQuestions([]);
      setQuestionsLoading(false);
    }
  }, [scene]);

  useEffect(() => {
    const seen = window.localStorage.getItem("history-tree-help-shown");
    if (!seen) {
      setShowHelp(true);
    }
  }, []);

  useEffect(() => {
    if (!showLeaderboard || !PLAYERS_API(MOCKAPI)) return;
    setLeaderboardLoading(true);
    fetch(PLAYERS_API(MOCKAPI))
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const sorted = [...list]
          .sort(
            (a, b) =>
              (Number(b.Score ?? b.score) || 0) -
              (Number(a.Score ?? a.score) || 0)
          )
          .slice(0, 10);
        setLeaderboard(sorted);
      })
      .catch(() => setLeaderboard([]))
      .finally(() => setLeaderboardLoading(false));
  }, [showLeaderboard, score]);

  useEffect(() => {
    if (!loggedIn || !playerId || !MOCKAPI) return;
    const url = `${PLAYERS_API(MOCKAPI)}/${playerId}`;
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName, score }),
    }).catch(() => {});
  }, [loggedIn, playerId, playerName, score]);

  useEffect(() => {
    if (!currentQuestion) return;
    setRemainingTime(QUESTION_TIME);
    setSelectedAnswer("");

    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestion?.id]);

  async function handleLogin(e) {
    e.preventDefault();
    const name = playerName.trim();
    if (!name) return;
    const url = PLAYERS_API(MOCKAPI);
    if (!url) {
      setLoggedIn(true);
      return;
    }
    setNameSaving(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, Score: 0 }),
      });
      const data = await res.json();
      setPlayerId(data.id);
      setLoggedIn(true);
    } catch {
      setLoggedIn(true);
    } finally {
      setNameSaving(false);
    }
  }

  function openQuestion(question) {
    if (usedLeafIds.has(question.id)) return;
    setCurrentQuestion(question);
  }

  function closeQuestion() {
    setCurrentQuestion(null);
    setSelectedAnswer("");
  }

  function handleSubmitAnswer(option) {
    if (!currentQuestion || remainingTime === 0) return;
    setSelectedAnswer(option);

    const isCorrect = option === currentQuestion.answer;
    const base = currentQuestion.difficulty === "rare" ? 20 : 10;
    if (isCorrect) {
      setScore((s) => s + base);
      setUsedLeafIds((prev) => new Set(prev).add(currentQuestion.id));
      setTimeout(closeQuestion, 800);
    } else {
      setUsedLeafIds((prev) => new Set(prev).add(currentQuestion.id));
      setTimeout(closeQuestion, 800);
    }
  }

  const timeRatio = currentQuestion
    ? Math.max(0, remainingTime) / QUESTION_TIME
    : 0;

  return (
    <div className="tree-root">
      {scene === "screen1" && (
        <video
          className="tree-screen-video"
          src={screen1Video}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      {scene === "transition" && (
        <video
          ref={transitionRef}
          className="tree-screen-video"
          src={transitionVideo}
          autoPlay
          muted
          playsInline
          onEnded={handleTransitionEnd}
        />
      )}
      {scene === "screen2" && (
        <video
          className="tree-screen-video"
          src={screen2Video}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      {scene === "screen1" && loggedIn && (
        <div
          className="tree-click-overlay"
          onClick={handleStartTransition}
          onKeyDown={(e) => e.key === "Enter" && handleStartTransition()}
          role="button"
          tabIndex={0}
          aria-label="Bấm để tiếp tục"
        />
      )}
      <header className="tree-header">
        <div className="tree-logo">Skybound History</div>
        <div className="tree-header-right">
          {loggedIn && (
            <>
              <div className="tree-player">👋 {playerName}</div>
              <div className="tree-score">
                Điểm: <span>{score}</span>
              </div>
              <button
                type="button"
                className="tree-button tree-leaderboard-btn"
                onClick={() => setShowLeaderboard((v) => !v)}
              >
                🏆 Bảng xếp hạng
              </button>
            </>
          )}
        </div>
      </header>

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
                  <li
                    key={p.id}
                    className={
                      p.id === playerId
                        ? "tree-leaderboard-item current"
                        : "tree-leaderboard-item"
                    }
                  >
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

      <main className="tree-main">
        <section className="tree-hero tree-hero-centered">
          {scene === "screen2" ? (
            <div className="tree-canopy-zone">
              {questionsLoading ? (
                <p className="tree-loading">Đang tải câu hỏi...</p>
              ) : (
                allQuestions.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    className={`tree-leaf-btn ${
                      usedLeafIds.has(q.id) ? "tree-leaf-used" : ""
                    }`}
                    style={
                      leafPositions[i]
                        ? {
                            left: leafPositions[i].left,
                            top: leafPositions[i].top,
                          }
                        : {}
                    }
                    onClick={() => openQuestion(q)}
                    disabled={usedLeafIds.has(q.id)}
                  >
                    <img
                      src={
                        q.difficulty === "rare" ? leafYellowImg : leafGreenImg
                      }
                      alt=""
                    />
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="tree-scene" />
          )}
        </section>
      </main>

      {!loggedIn && (
        <div className="tree-dialog-backdrop">
          <div className="tree-dialog">
            <div className="tree-dialog-header">
              <h3>Chào mừng đến Skybound History</h3>
            </div>
            <p className="tree-question-text">
              Nhập tên của bạn để bắt đầu chơi và lưu điểm trên máy chủ.
            </p>
            <form
              className="tree-login-form"
              onSubmit={handleLogin}
              style={{ flexDirection: "column", gap: 12, marginTop: 16 }}
            >
              <input
                className="tree-input"
                placeholder="Nhập tên của bạn"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                disabled={nameSaving}
                autoFocus
              />
              <button
                className="tree-button primary"
                type="submit"
                disabled={!playerName.trim() || nameSaving}
                style={{ width: "100%" }}
              >
                {nameSaving ? "Đang lưu..." : "Bắt đầu chơi"}
              </button>
            </form>
          </div>
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
              <h3>
                {currentQuestion.difficulty === "rare"
                  ? "Lá vàng thử thách"
                  : "Lá xanh"}
              </h3>
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
            <div className="tree-timer-label">Còn {remainingTime}s</div>

            <div className="tree-options">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedAnswer === opt;
                const isCorrect = opt === currentQuestion.answer;
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
                    disabled={!!selectedAnswer || remainingTime === 0}
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

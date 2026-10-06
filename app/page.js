"use client";

import { useCallback, useRef, useState } from "react";
import DivyaDrishtiCore from "@/components/DivyaDrishtiCore";
import OrbitPanel from "@/components/OrbitPanel";
import ChartModal from "@/components/ChartModal";
import AnswerModal from "@/components/AnswerModal";
import { useAssemblyAISTT } from "@/hooks/useAssemblyAISTT";
import { useAskDivyaDrishti } from "@/hooks/useAskDivyaDrishti";
import styles from "./page.module.css";

const INDUSTRY_COLORS = {
  WHOLESALE_FASHION: "#4AF2A1",
  MEDICAL: "#2FE0C7",
  B2C: "#9CFF6B",
  TECH_MANUFACTURING: "#1FBF6B",
};

export default function Home() {
  const [industry, setIndustry] = useState("WHOLESALE_FASHION");
  const [lastUtterance, setLastUtterance] = useState("");
  const [modalChart, setModalChart] = useState(null);
  const [showFullAnswer, setShowFullAnswer] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textValue, setTextValue] = useState("");

  // Breaks the circular dependency between the two hooks below: useAskDivyaDrishti
  // needs the STT hook's setState, but the STT hook needs askQuestion as its
  // callback. handleUtteranceComplete stays stable and calls through this ref,
  // which always points at the latest askQuestion closure.
  const askQuestionRef = useRef(null);

  const handleUtteranceComplete = useCallback((transcript) => {
    setLastUtterance(transcript);
    setShowFullAnswer(false); // don't leave the previous answer's modal open into a new question
    askQuestionRef.current?.(transcript, industry);
  }, [industry]);

  const { state, setState, interimTranscript, error, startListening, stopListening } = useAssemblyAISTT({
    onUtteranceComplete: handleUtteranceComplete,
  });

  const { askQuestion, stopSpeaking, narrative, currentSentence, chartHistory, error: askError } = useAskDivyaDrishti({
    setCoreState: setState,
  });

  askQuestionRef.current = askQuestion;

  // "thinking" has no cancel path yet — the in-flight backend request just keeps
  // running in the background if you start a new session mid-thinking. Fine for
  // now, worth an AbortController pass later if that becomes an actual problem.
  const handleMicClick = () => {
    if (state === "listening") {
      stopListening();
    } else if (state === "speaking") {
      stopSpeaking();
    } else {
      startListening();
    }
  };

  // Text is a quick escape hatch, not a second permanent mode — only offered
  // when nothing voice-related is already in flight, and it collapses itself
  // back to the plain voice view the moment a question goes out.
  const canUseTextInput = state === "idle" || state === "data";

  const submitText = (e) => {
    e.preventDefault();
    const trimmed = textValue.trim();
    if (!trimmed) return;
    // Voice gets its "thinking" transition from inside useAssemblyAISTT, which
    // presumably sets it the moment an utterance is detected as finished,
    // before onUtteranceComplete ever fires. Typed input bypasses that hook
    // entirely, so nothing sets "thinking" for it unless we do it here.
    // TODO: confirm this actually matches what useAssemblyAISTT does - this
    // is a best guess based on the symptom, not a read of that hook's source.
    setState("thinking");
    handleUtteranceComplete(trimmed);
    setTextValue("");
    setShowTextInput(false);
  };

  // Alternate new charts between the two flanking columns so they stay roughly
  // balanced as the conversation accumulates more of them.
  const leftCharts = chartHistory.filter((_, i) => i % 2 === 0);
  const rightCharts = chartHistory.filter((_, i) => i % 2 === 1);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.wordmark}>Divya Drishti</div>
        {/* <div className={styles.industries}>
          {Object.keys(INDUSTRY_COLORS).map((key) => {
            const isActive = industry === key;
            return (
              <button
                key={key}
                onClick={() => setIndustry(key)}
                className={`${styles.industryBtn} ${isActive ? styles.industryBtnActive : ""}`}
                style={isActive ? { borderColor: INDUSTRY_COLORS[key], color: INDUSTRY_COLORS[key] } : undefined}
              >
                {key}
              </button>
            );
          })}
        </div> */}
      </header>

      <div className={styles.stage}>
        <div className={styles.chartColumn}>
          {leftCharts.map((chart) => (
            <OrbitPanel key={chart.id} chart={chart} onClick={() => setModalChart(chart)} />
          ))}
        </div>

        <div className={styles.coreWrapper}>
          <DivyaDrishtiCore state={state} color={INDUSTRY_COLORS[industry]} />
        </div>

        <div className={styles.chartColumn}>
          {rightCharts.map((chart) => (
            <OrbitPanel key={chart.id} chart={chart} onClick={() => setModalChart(chart)} />
          ))}
        </div>
      </div>

      <div className={styles.captionBar}>
        {lastUtterance && state !== "listening" && (
          <div className={styles.lastUtterance}>you asked: “{lastUtterance}”</div>
        )}
        <div className={styles.transcript}>
          {state === "listening"
            ? interimTranscript
            : state === "speaking"
              ? currentSentence
              : (error || askError ? `error: ${error || askError}` : "")}
        </div>
      </div>

      {narrative.length !== 0 && <div className={styles.answerButtonRow}>
        <button
          onClick={() => setShowFullAnswer(true)}
          disabled={!narrative || state === "listening"}
          className={styles.fullAnswerBtn}
        >
          view full answer
        </button>
      </div>}

      <div className={styles.controls}>
        {showTextInput ? (
          <form onSubmit={submitText} className={styles.textInputForm}>
            <input
              type="text"
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowTextInput(false); setTextValue(""); } }}
              placeholder="type your question…"
              className={styles.textInput}
            />
            <button type="submit" className={styles.textSubmitBtn} disabled={!textValue.trim()}>
              ask
            </button>
            <button
              type="button"
              className={styles.textCancelBtn}
              onClick={() => { setShowTextInput(false); setTextValue(""); }}
            >
              ✕
            </button>
          </form>
        ) : (
          <div className={styles.controlsRow}>
            <button onClick={handleMicClick} className={styles.micButton}>
              {state === "idle" && "start listening"}
              {state === "listening" && "listening… (tap to stop)"}
              {state === "thinking" && "thinking…"}
              {state === "speaking" && "speaking… (tap to stop)"}
              {state === "data" && "tap to ask again"}
            </button>
            {canUseTextInput && (
              <button
                onClick={() => setShowTextInput(true)}
                className={styles.typeInsteadBtn}
                aria-label="type your question instead"
                title="type instead"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />
      <AnswerModal text={showFullAnswer ? narrative : null} onClose={() => setShowFullAnswer(false)} />
    </main>
  );
}
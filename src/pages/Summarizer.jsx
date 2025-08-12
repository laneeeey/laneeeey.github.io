import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Loader2,
  Settings,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Accessibility,
} from "lucide-react";
import "../styles/summarizer.css";
import headsetIcon from "../assets/headsetIcon.png";
import axios from "axios";

export default function Summarizer({ initUrl }) {
  const [page, setPage] = useState("input");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [fontSizePx, setFontSizePx] = useState(36);

  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [voiceSettings, setVoiceSettings] = useState({
    rate: 0.8,
    pitch: 1,
    voice: "default",
  });
  const [selectedLang, setSelectedLang] = useState("ko-KR");
  const [availableVoices, setAvailableVoices] = useState([]);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isAutoRestarting, setIsAutoRestarting] = useState(false);

  // 언어 코드를 백엔드 형식으로 변환하는 함수
  const getBackendLanguage = (frontendLang) => {
    const languageMap = {
      'ko-KR': 'KOREAN',
      'en-US': 'ENGLISH', 
      'ja-JP': 'JAPANESE',
      'zh-CN': 'CHINESE'
    };
    return languageMap[frontendLang] || 'KOREAN';
  };

  // 초기 설정
  useEffect(() => {
    try {
      const saved = localStorage.getItem("accessibilitySettings");
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.zoomLevel === "number") setZoomLevel(p.zoomLevel);
        if (typeof p.fontSizePx === "number") setFontSizePx(p.fontSizePx);
        if (p.voiceSettings) {
          // volume이 없는 경우를 대비해 기본값 설정
          const savedSettings = { ...p.voiceSettings };
          if (!savedSettings.rate) savedSettings.rate = 0.8;
          if (!savedSettings.pitch) savedSettings.pitch = 1;
          if (!savedSettings.voice) savedSettings.voice = "default";
          setVoiceSettings(savedSettings);
        }
        if (p.selectedLang) setSelectedLang(p.selectedLang);
      }
    } catch (e) {
      console.error("Failed to load accessibility settings", e);
    }

    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    const handleEsc = (e) => {
      if (e.key === "Escape") setShowVoiceModal(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleSummarize = useCallback(
  async (forceUrl) => {
    const target = ((forceUrl ?? url) || "").trim();
    if (!target) return;

    try { new URL(target); } catch { alert("유효한 URL을 입력해주세요."); return; }

    setIsLoading(true);
    setSummary("");

    try {
      const form = new URLSearchParams();
      form.set('link', target);
      form.set('language', getBackendLanguage(selectedLang));

      const resp = await axios.post(`${import.meta.env.VITE_API_BASE}/summary`, form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const body = resp?.data;
      const payload = body?.data ?? body;
      const text =
        payload?.choices?.[0]?.message?.content ??
        payload?.content ??
        payload?.summary ??
        payload?.text ??
        (typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));

      setSummary(text || "요약 결과가 없습니다.");
      setPage("result");
    } catch (err) {
      console.error("요약 API 오류:", err);
      console.error("DEBUG:", err.response?.status, err.response?.data);
      setSummary(
        (err.response?.data && (err.response.data.message || JSON.stringify(err.response.data))) ||
        err.message ||
        "요약 중 오류가 발생했어요."
      );
      setPage("result");
    } finally {
      setIsLoading(false);
    }
  },
  [url, selectedLang]
);


  // initUrl
  useEffect(() => {
    if (initUrl && typeof initUrl === "string") {
      setUrl(initUrl);
      const t = setTimeout(() => handleSummarize(initUrl), 0);
      return () => clearTimeout(t);
    }
  }, [initUrl, handleSummarize]);

  // 음성 설정 변경 시 자동 재시작
  useEffect(() => {
    console.log("음성 설정 업데이트:", voiceSettings);
    
    // 재생 중일 때 설정이 변경되면 자동으로 새로운 설정으로 재시작
    if (isPlaying && currentAudio && summary && !isAutoRestarting) {
      console.log("음성 설정 변경 감지 - 새로운 설정으로 재시작");
      setIsAutoRestarting(true);
      
      // 기존 음성 완전 중지
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
      setCurrentAudio(null);
      
      // 잠시 후 새로운 설정으로 TTS API 호출
      setTimeout(() => {
        handlePlayAudio();
      }, 100);
    }
  }, [voiceSettings.rate, voiceSettings.pitch]);

  // 언어 변경 시에도 자동 재시작
  useEffect(() => {
    if (isPlaying && currentAudio && summary && !isAutoRestarting) {
      console.log("언어 변경 감지 - 새로운 언어로 재시작");
      setIsAutoRestarting(true);
      
      // 기존 음성 완전 중지
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
      setCurrentAudio(null);
      
      // 잠시 후 새로운 설정으로 TTS API 호출
      setTimeout(() => {
        handlePlayAudio();
      }, 100);
    }
  }, [selectedLang]);

  const handlePlayAudio = async () => {
    if (!summary) return;
    
    // 이미 재생 중이면 중지
    if (isPlaying && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
      setCurrentAudio(null);
      return;
    }
    
    try {
      // TTS API 호출
      console.log("🎵 TTS API 호출 시작");
      console.log("📊 현재 설정값:", {
        speed: voiceSettings.pitch,       // 음성 높이 (0.5 - 2.0)
        pitch: voiceSettings.rate,        // 읽기 속도 (0.5 - 2.0)
        language: getBackendLanguage(selectedLang)
      });
      console.log("🌐 선택된 언어:", selectedLang);
      console.log("🔊 음성 설정:", voiceSettings);
      
              const response = await axios.get("/api/tts", {
          params: {
            text: summary,
            speed: voiceSettings.pitch,       // 음성 높이 (0.5 - 2.0)
            pitch: voiceSettings.rate,        // 읽기 속도 (0.5 - 2.0)
            language: getBackendLanguage(selectedLang)
          },
          responseType: 'blob' // 음성 파일을 blob으로 받기
        });
      
      // 음성 파일 재생
      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // 재생 상태 설정
      setIsPlaying(true);
      setCurrentAudio(audio);
      
      // 재생 시작
      await audio.play();
      
      // 재생 완료 시 상태 초기화
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        setIsAutoRestarting(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      // 재생 중지 시 상태 초기화
      audio.onpause = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        setIsAutoRestarting(false);
      };
      
    } catch (error) {
      console.error("TTS API 오류:", error);
      // TTS API 실패 시 기존 브라우저 내장 음성 사용
      if (!("speechSynthesis" in window)) {
        alert("이 브라우저에서는 음성 재생을 지원하지 않아요.");
        return;
      }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        return;
      }
      const utter = new SpeechSynthesisUtterance(summary);
      utter.lang = selectedLang;
      utter.rate = voiceSettings.rate;
      utter.pitch = voiceSettings.pitch;
      utter.volume = voiceSettings.volume;

      let sel = availableVoices.find((v) => v.lang === selectedLang);
      if (!sel) {
        const base = selectedLang.split("-")[0];
        sel = availableVoices.find((v) => v.lang?.startsWith(base));
      }
      if (voiceSettings.voice !== "default") {
        const byName = availableVoices.find((v) => v.name === voiceSettings.voice);
        if (byName) sel = byName;
      }
      if (sel) utter.voice = sel;
      window.speechSynthesis.speak(utter);
    }
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 25, 75));
  const resetZoom = () => setZoomLevel(100);

  const saveSettings = () => {
    localStorage.setItem(
      "accessibilitySettings",
      JSON.stringify({ zoomLevel, fontSizePx, voiceSettings, selectedLang })
    );
    setShowVoiceModal(false);
  };

  const scale = zoomLevel / 100;
  const scaledWidth = `${100 / scale}%`;

  return (
    <div className="summarizer bg-gray-900 text-white flex flex-col" style={{ minHeight: "100vh" }}>
      <div style={{ fontSize: `${fontSizePx}px` }}>
        {/* 헤더 */}
        <header className="px-0 py-6 bg-gray-800 border-b-2 border-gray-600">
          <div className="container" style={{ maxWidth: "none", width: "100%" }}>
            <div className="title">
              <Accessibility style={{ width: "80px", height: "80px" }} className="logo-icon text-blue-400" />
              <div className="title-text">
                <h1 className="text-3xl font-bold">
                  <img
                    src="/Hannoon.png"
                    alt="HANNOON"
                    className="title-logo"
                    style={{ filter: "invert(1) brightness(2)" }}
                  />
                </h1>
                <p className="text-lg text-gray-300 ml-4">저시력자를 위한 웹페이지 정보 요약 서비스</p>
              </div>
            </div>

            <div className="toolbar">
              <div className="zoombox">
                <button className="btn-ghost" onClick={handleZoomOut} disabled={zoomLevel <= 75}>
                  <ZoomOut />
                </button>
                <span>{Math.round(scale * 100)}%</span>
                <button className="btn-ghost" onClick={handleZoomIn} disabled={zoomLevel >= 200}>
                  <ZoomIn />
                </button>
                <button className="btn-ghost" onClick={resetZoom}>
                  <RotateCcw />
                </button>
              </div>
              <button className="btn-outline flex items-center gap-2" onClick={() => setShowVoiceModal(true)}>
                <Settings className="h-5 w-5" /> 음성설정
              </button>
            </div>
          </div>
        </header>

        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: scaledWidth,
          }}
        >
          <div className="flex-1">
            <div className="container main-wrap" style={{ maxWidth: "none", width: "100%" }}>
              {page === "input" && (
                <div className="card" style={{ width: "100%" }}>
                  <div className="head mt-0">
                    <div>
                      <h2 className="text-2xl flex items-center gap-2">
                        <Globe size={48} className="text-blue-400" /> 웹페이지 주소 입력
                      </h2>
                      <p className="text-gray-300">요약하고 싶은 페이지 주소를 입력하세요</p>
                    </div>
                  </div>

                  <div className="body">
                    <input
                      type="url"
                      placeholder="https://웹사이트주소.com/상품페이지"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="input"
                    />
                    <div className="language-selector">
                      <select
                        id="summary-language"
                        value={selectedLang}
                        onChange={(e) => setSelectedLang(e.target.value)}
                        className="language-select"
                      >
                        <option value="ko-KR">한국어</option>
                        <option value="en-US">영어</option>
                        <option value="ja-JP">일본어</option>
                        <option value="zh-CN">중국어(간체)</option>
                      </select>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => handleSummarize()}
                      disabled={!url.trim() || isLoading}
                    >
                      {isLoading ? <Loader2 className="spin" /> : <Accessibility />}
                      {isLoading ? "분석중..." : "요약하기"}
                    </button>
                    <div className="mt-8 pt-6 border-t border-gray-600">
                      <h3 className="text-xl font-bold text-white mb-4">사용 방법</h3>
                      <div className="space-y-3">
                        <div className="howto-item">
                          <div className="step">1</div>
                          <span className="text-lg text-gray-300">웹사이트 주소 입력</span>
                        </div>
                        <div className="howto-item">
                          <div className="step">2</div>
                          <span className="text-lg text-gray-300">AI가 자동으로 정보 요약</span>
                        </div>
                        <div className="howto-item">
                          <div className="step">3</div>
                          <span className="text-lg text-gray-300">음성으로 편리하게 듣기</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {page === "result" && (
                <div className="card" style={{ width: "100%" }}>
                  <div className="head">
                    <h2 className="text-2xl">요약 결과</h2>
                    {summary && (
                      <button 
                        className={`btn-ghost ${isPlaying ? 'playing' : ''}`} 
                        onClick={handlePlayAudio} 
                        aria-label={isPlaying ? "음성 중지" : "음성 재생"}
                      >
                        <img 
                          src={headsetIcon} 
                          alt={isPlaying ? "음성 중지" : "음성 재생"} 
                          className={`play-audio-icon ${isPlaying ? 'playing' : ''}`} 
                        />
                      </button>
                    )}
                  </div>

                  <div className="body">
                    {summary ? (
                      <textarea
                        className="result"
                        value={summary}
                        readOnly
                        style={{ fontSize: `${fontSizePx}px`, lineHeight: 1.5 }}
                      />
                    ) : (
                      <div className="placeholder" style={{ fontSize: `${fontSizePx}px` }}>
                        <Globe size={64} className="icon" />
                        <p>요약 내용이 없습니다.</p>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                      <button className="btn-outline" onClick={() => setPage("input")}>
                        ← 뒤로가기
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 음성 설정 모달 */}
      {showVoiceModal && (
        <div className="modal-backdrop" onClick={() => setShowVoiceModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>음성 설정</h3>
            </div>
            <div className="modal-body">
              <label>읽기 속도: {voiceSettings.rate.toFixed(1)}</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={voiceSettings.rate}
                onChange={(e) => {
                  const newRate = parseFloat(e.target.value);
                  console.log("읽기 속도 변경:", newRate);
                  setVoiceSettings({ ...voiceSettings, rate: newRate });
                }}
              />
              <label>음성 높이: {voiceSettings.pitch.toFixed(1)}</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={voiceSettings.pitch}
                onChange={(e) => {
                  const newPitch = parseFloat(e.target.value);
                  console.log("음성 높이 변경:", newPitch);
                  setVoiceSettings({ ...voiceSettings, pitch: newPitch });
                }}
              />
              <label>글씨 크기: {fontSizePx}px</label>
              <input
                type="range"
                min="24"
                max="60"
                step="2"
                value={fontSizePx}
                onChange={(e) => setFontSizePx(parseInt(e.target.value, 10))}
              />
              <label>언어 선택</label>
              <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
                <option value="ko-KR">한국어</option>
                <option value="en-US">영어</option>
                <option value="ja-JP">일본어</option>
                <option value="zh-CN">중국어(간체)</option>
              </select>
            </div>
            <div className="modal-foot">
              <button className="btn-primary" onClick={saveSettings}>
                저장
              </button>
              <button className="btn-outline" onClick={() => setShowVoiceModal(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

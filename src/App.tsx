import { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Zap,
  CheckSquare,
  Square
} from "lucide-react";
import { registerPlugin } from "@capacitor/core";
import { LOTERIA_CARDS, type LoteriaCard } from "./cards";
import "./App.css";

const NativeTTS = registerPlugin<{
  speak: (options: { text: string }) => Promise<void>;
  stop: () => Promise<void>;
  ping: () => Promise<{ status: string; ttsReady: boolean }>;
}>("LoteriaAudio");

function App() {
  // ... resto del estado
  const [deck, setDeck] = useState<LoteriaCard[]>(() => {
    const initial = [...LOTERIA_CARDS];
    for (let i = initial.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [initial[i], initial[j]] = [initial[j], initial[i]];
    }
    return initial;
  });
  
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playedCards, setPlayedCards] = useState<LoteriaCard[]>([]);
  
  const [speed, setSpeed] = useState<number>(() => {
    const saved = localStorage.getItem("loteria_speed");
    const initialSpeed = saved ? parseInt(saved, 10) : 4;
    console.log(`[Loteria] Inicializando velocidad: ${initialSpeed} (Fuente: ${saved ? "localStorage" : "Default"})`);
    return initialSpeed;
  });

  const [dontShowShuffleConfirm, setDontShowShuffleConfirm] = useState<boolean>(() => {
    return localStorage.getItem("loteria_skip_shuffle_confirm") === "true";
  });
  
  const [showShuffleModal, setShowShuffleModal] = useState<boolean>(false);
  const [tempDontShowChecked, setTempDontShowChecked] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("loteria_speed", speed.toString());
  }, [speed]);

  useEffect(() => {
    const checkPlugin = async () => {
      console.log("Comprobando disponibilidad del plugin NativeTTS...");
      try {
        const res = await NativeTTS.ping();
        console.log("Plugin NativeTTS conectado correctamente:", res);
      } catch (err) {
        console.error("Error crítico: El plugin NativeTTS no responde.", err);
        // No reintentar indefinidamente si el error es que no está implementado
        if (String(err).includes("not implemented")) {
            console.error("EL PLUGIN NO ESTÁ REGISTRADO EN ANDROID. Revisa MainActivity.java");
        } else {
            setTimeout(checkPlugin, 2000);
        }
      }
    };
    checkPlugin();
  }, []);

  const speakText = (text: string) => {
    console.log(`TTS Solicitado: "${text}"`);

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    NativeTTS.speak({ text })
      .then(() => console.log("Plugin Nativo habló con éxito"))
      .catch(err => {
        console.warn("Plugin Nativo falló o no existe. Usando Web Speech API como respaldo.", err);
        if (typeof window !== "undefined" && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = "es-MX";
          window.speechSynthesis.speak(utterance);
        }
      });
  };

  const drawNextCard = (force = false) => {
    if (!isPlaying && !force) return;

    if (currentIndex >= deck.length - 1) {
      setIsPlaying(false);
      speakText("¡Se acabó la baraja!");
      return;
    }
    
    const nextIndex = currentIndex + 1;
    const nextCard = deck[nextIndex];

    setPlayedCards(prev => [...prev, nextCard]);
    setCurrentIndex(nextIndex);

    // Siempre anunciar el nombre de la carta
    speakText(nextCard.name);
  };

  const drawNextCardRef = useRef(drawNextCard);
  useEffect(() => {
    drawNextCardRef.current = drawNextCard;
  });

  useEffect(() => {
    let timeoutId: any = null;
    let intervalId: any = null;
    if (isPlaying) {
      if (currentIndex === -1) {
        // Al empezar, esperamos 3 segundos para dar tiempo a la frase inicial "Corre y se va..."
        timeoutId = setTimeout(() => {
          if (drawNextCardRef.current) drawNextCardRef.current(true);
          intervalId = setInterval(() => {
            if (drawNextCardRef.current) drawNextCardRef.current(true);
          }, speed * 1000);
        }, 3000);
      } else {
        intervalId = setInterval(() => {
          drawNextCardRef.current(true);
        }, speed * 1000);
      }
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, speed]);

  const carouselRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = carouselRef.current.scrollWidth;
    }
  }, [playedCards]);

  const playShuffleSound = () => {
    if (typeof window === "undefined") return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      const numCards = 30;
      const playCardSnap = (t: number, intensity: number) => {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1500 + Math.random() * 500, t);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3 * intensity, t + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(t);
      };
      let elapsed = 0;
      for (let i = 0; i < numCards; i++) {
        const progress = i / numCards;
        const delay = 0.02 + Math.pow(progress - 0.5, 2) * 0.15;
        playCardSnap(now + elapsed, 0.4 + Math.random() * 0.6);
        elapsed += delay;
      }
      setTimeout(() => { ctx.close(); }, (elapsed + 0.3) * 1000);
    } catch (e) { console.warn(e); }
  };

  const playClickSound = () => {
    if (typeof window === "undefined") return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(2000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.03);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.03);
      setTimeout(() => ctx.close(), 100);
    } catch (e) { console.warn(e); }
  };

  const handleShuffleAction = () => {
    playShuffleSound();
    const shuffled = [...LOTERIA_CARDS];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDeck(shuffled);
    setCurrentIndex(-1);
    setPlayedCards([]);
    setIsPlaying(false);
    NativeTTS.stop().catch(() => {});
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleShuffleClick = () => {
    if (dontShowShuffleConfirm) {
      handleShuffleAction();
    } else {
      setIsPlaying(false);
      setTempDontShowChecked(false);
      setShowShuffleModal(true);
    }
  };

  const confirmShuffle = () => {
    if (tempDontShowChecked) {
      localStorage.setItem("loteria_skip_shuffle_confirm", "true");
      setDontShowShuffleConfirm(true);
    }
    handleShuffleAction();
    setShowShuffleModal(false);
  };

  const currentCard = currentIndex >= 0 && currentIndex < deck.length ? deck[currentIndex] : null;

  return (
    <div className="app-container">
      <div className="phone-wrapper">
        <header className="app-header">
          <h1 className="app-title-main">Lotería</h1>
          <div className="app-title-sub">Gran Baraja Mexicana</div>
        </header>

        <div className="card-showcase">
          {currentCard ? (
            <div className="loteria-card" style={{ backgroundColor: currentCard.color + '44' }}>
              <div className="card-inner">
                <span className="card-number">{currentCard.id}</span>
                <div className="card-emoji-container" key={currentCard.id}>
                  {currentCard.emoji}
                </div>
                <div className="card-name-banner">{currentCard.name}</div>
              </div>
            </div>
          ) : (
            <div className="loteria-card card-back">
              <div className="card-back-text">Lotería</div>
            </div>
          )}
        </div>

        <section className="carousel-section">
          <h2 className="carousel-title">Pasadas ({playedCards.length}/54)</h2>
          <div className="carousel-container-outer">
            <div className="carousel-wrapper" ref={carouselRef}>
              {playedCards.length === 0 ? (
                <div className="carousel-placeholder">Cartas jugadas...</div>
              ) : (
                playedCards.map((card, idx) => (
                  <div
                    key={`${card.id}-${idx}`}
                    className="mini-card"
                    onClick={() => speakText(card.name)}
                    style={{ borderBottom: `4px solid ${card.color}` }}
                  >
                    <div className="mini-inner">
                      <div className="mini-emoji-box">
                        {card.emoji}
                      </div>
                      <div className="mini-name-text">{card.name}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="controls-buttons">
          <button className="control-btn btn-shuffle" onClick={handleShuffleClick}>
            <RotateCcw size={22} />
            <span>Barajear</span>
          </button>
          <button
            className={`control-btn btn-play-pause ${isPlaying ? "is-playing" : ""}`}
            onClick={() => {
              const newPlayingState = !isPlaying;
              playClickSound(); // Sonido dinámico al presionar
              if (newPlayingState) {
                if (currentIndex === -1) {
                  // El usuario hizo clic en Play por primera vez, iniciamos el audio de entrada
                  speakText("¡Corre y se va corriendo con!");
                }
              } else {
                // Al pausar, detenemos cualquier audio en curso
                if (typeof window !== "undefined" && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                NativeTTS.stop().catch(() => {});
              }
              setIsPlaying(newPlayingState);
            }}
          >
            {isPlaying ? <><Pause size={22} fill="#fff" /><span>Pausa</span></> : <><Play size={22} fill="#fff" /><span>Jugar</span></>}
          </button>
        </section>

        <section className="speed-section">
          <div className="speed-header">
            <span className="speed-title">VELOCIDAD</span>
            <span className="speed-value">CADA {speed} SEGUNDOS</span>
          </div>
          <div className="speed-control-container">
            <Zap className="speed-icon" size={20} />
            <input
              type="range"
              className="speed-input"
              min="3" max="5" step="1"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            />
          </div>
          <div className="speed-ticks">
            <span>Rápido (3s)</span>
            <span>Medio (4s)</span>
            <span>Lento (5s)</span>
          </div>
        </section>

        {showShuffleModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="modal-title">¿Barajear de nuevo?</h3>
              <p className="modal-body">
                Esto reiniciará el juego y barajará las 54 cartas para empezar desde cero.
              </p>

              <div className="modal-checkbox-row" onClick={() => setTempDontShowChecked(!tempDontShowChecked)}>
                {tempDontShowChecked ? <CheckSquare className="checkbox-icon" size={22} /> : <Square className="checkbox-icon" size={22} />}
                <span>No volver a mostrar</span>
              </div>

              <div className="modal-footer">
                <button className="modal-btn btn-cancel" onClick={() => setShowShuffleModal(false)}>No</button>
                <button className="modal-btn btn-confirm" onClick={confirmShuffle}>Sí</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

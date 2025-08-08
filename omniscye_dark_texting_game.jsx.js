import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Volume2, VolumeX, ShieldAlert, ShieldCheck, Phone, Send, Play, Pause, BellRing, Wifi, Battery } from "lucide-react";

// ===== Constants =====
const OMNISCYE_AVATAR = "https://i.ibb.co/XfmY17Vw/35e50fc1f30a06d04662b8abe530c16e.jpg";

// ===== Lightweight Runtime Tests (Graph & Props) =====
function runSelfTests(NODES, PATHS) {
  const errors = [];
  const checkList = (name, seq) => seq.forEach((id, i) => { if (!NODES[id]) errors.push(`[TEST1] PATHS.${name}[${i}] -> "${id}" not found`); });
  Object.entries(PATHS).forEach(([name, seq]) => checkList(name, seq));
  Object.entries(NODES).forEach(([id, node]) => {
    if (node && node.choices) node.choices.forEach((c, i) => { if (!NODES[c.next]) errors.push(`[TEST2] NODES.${id}.choices[${i}] next->"${c.next}" missing`); });
  });
  if (errors.length) { console.groupCollapsed("[Omniscye Chat] Self-tests FAILED"); errors.forEach((e)=>console.error(e)); console.groupEnd(); } else { console.info("[Omniscye Chat] Self-tests PASSED"); }
}

// ===== WebAudio helpers =====
function useAudioEngine() {
  const ctxRef = useRef(null);
  const ambienceGainRef = useRef(null);
  const sfxGainRef = useRef(null);
  const ambienceNodesRef = useRef(null);

  const ensureCtx = async () => {
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctor();
      const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      const ambienceGain = ctx.createGain(); ambienceGain.gain.value = 0.35; ambienceGain.connect(master);
      const sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
      ctxRef.current = ctx; ambienceGainRef.current = ambienceGain; sfxGainRef.current = sfxGain;
    }
    return ctxRef.current;
  };

  const blip = async (f=1200, dur=0.08, type="triangle") => {
    const ctx = await ensureCtx(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(sfxGainRef.current); o.start(); o.stop(ctx.currentTime + dur + 0.02);
  };
  const playClick = () => blip(1500, 0.06, "triangle");
  const playType  = () => blip(420, 0.09, "square");
  const appOpen   = () => blip(320, 0.12, "sine");
  const glitchZap = () => blip(90, 0.25, "sawtooth");

  const startAmbience = async () => {
    const ctx = await ensureCtx();
    stopAmbience();
    const base = 55;
    const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain(); const droneGain = ctx.createGain();
    osc1.type = "sine"; osc1.frequency.value = base; osc2.type = "sawtooth"; osc2.frequency.value = base * 1.01;
    lfo.type = "sine"; lfo.frequency.value = 0.07; lfoGain.gain.value = 8; lfo.connect(lfoGain); lfoGain.connect(osc2.frequency);
    droneGain.gain.value = 0.15; osc1.connect(droneGain); osc2.connect(droneGain);
    const bufferSize = 2 * ctx.sampleRate; const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0); for (let i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer; noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = "lowpass"; noiseFilter.frequency.value = 1200; noiseFilter.Q.value = 0.7;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.05; noise.connect(noiseFilter); noiseFilter.connect(noiseGain);
    const out = ctx.createGain(); out.gain.value = 1; droneGain.connect(out); noiseGain.connect(out); out.connect(ambienceGainRef.current);
    osc1.start(); osc2.start(); lfo.start(); noise.start();
    ambienceNodesRef.current = { stop: () => { try { osc1.stop(); osc2.stop(); lfo.stop(); noise.stop(); } catch(e){} } };
  };
  const stopAmbience = () => { if (ambienceNodesRef.current) { ambienceNodesRef.current.stop(); ambienceNodesRef.current = null; } };

  return { ensureCtx, playClick, playType, appOpen, glitchZap, startAmbience, stopAmbience };
}

// ===== iPhone-like Wrapper (Home -> App -> Glitch -> Chat) =====
function StatusBar({ carrier, battery=62 }) {
  return (
    <div className="absolute top-2 left-0 right-0 flex items-center justify-between px-6 text-white/80 text-[11px] select-none">
      <div className="flex items-center gap-1"><Wifi className="h-3 w-3" />{carrier}</div>
      <div>{new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
      <div className="flex items-center gap-1"><Battery className="h-3 w-3" />{battery}%</div>
    </div>
  );
}

function PhoneFrame({ children }) {
  return (
    <div className="mx-auto max-w-sm w-full">
      <div className="aspect-[9/19.5] w-full rounded-[48px] bg-black/90 border border-white/10 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-7 w-40 bg-black rounded-b-3xl" />
        {children}
      </div>
    </div>
  );
}

function HomeScreen({ onOpen, avatarUrl, carrier }) {
  return (
    <div className="h-full w-full grid place-items-center bg-gradient-to-b from-[#0b1020] to-[#05070d] relative">
      <StatusBar carrier={carrier} />
      <div className="grid grid-cols-4 gap-4 p-6">
        <button onClick={onOpen} className="col-span-2 justify-self-center text-center active:scale-[.98]">
          <img src={avatarUrl || OMNISCYE_AVATAR} className="h-16 w-16 rounded-2xl object-cover shadow" alt="Omni App"/>
          <div className="text-[11px] text-gray-200 mt-1">Omni</div>
        </button>
      </div>
      <div className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-white/40">Tap the Omni app</div>
    </div>
  );
}

function GlitchOverlay({ active }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-white/5 mix-blend-overlay animate-pulse" />
          <div className="absolute inset-0 [background:repeating-linear-gradient(0deg,rgba(255,255,255,.06)_0px,rgba(255,255,255,.06)_1px,transparent_2px,transparent_3px)] opacity-40" />
          <div className="absolute inset-0 animate-[glitch_1.2s_ease-in-out_infinite]" style={{background:"linear-gradient(45deg, rgba(0,255,255,.08), rgba(255,0,255,.08))"}} />
          <style>{`@keyframes glitch{0%,100%{transform:translate(0,0)}20%{transform:translate(-2px,1px)}40%{transform:translate(3px,-1px)}60%{transform:translate(-1px,2px)}80%{transform:translate(2px,0)}}`}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Notification({ text, onClose }) {
  return (
    <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
      className="absolute top-10 left-1/2 -translate-x-1/2 bg-[#0b0f14]/95 border border-white/10 rounded-2xl px-3 py-2 text-xs text-gray-100 shadow">
      <div className="flex items-center gap-2"><BellRing className="h-4 w-4"/> {text}</div>
      <button onClick={onClose} className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-white/10">×</button>
    </motion.div>
  );
}

// ===== Story Graph (expanded horror, NO TIMERS) =====
const NODES = {
  // Intro sequence (auto)
  start: { author: "omni", text: "hey. this is Omniscye. don't freak out.", delay: 500 },
  a1: { author: "omni", text: "i detected your device on a repo server... testing your opsec.", delay: 800 },
  a2: { author: "omni", text: "prove you're not a bot: tap a choice. quickly.", delay: 700 },
  c0: { author: "you", choices: [
    { id: "play", label: "Play along", next: "omni1" },
    { id: "nope", label: "Who are you?", next: "omni2" },
    { id: "panic", label: "This is illegal", next: "omni3" },
  ] },
  omni1: { author: "omni", text: "good. make this easy and i won't brick anything.", delay: 600 },
  omni2: { author: "omni", text: "modder. kcd2. repo. tools on github. ring a bell?", delay: 700 },
  omni3: { author: "omni", text: "relax. it's a simulation. unless you fail.", delay: 700 },

  // First phishing
  omni4: { author: "omni", text: "step 1: send me the six-digit code that *just* popped up.", delay: 900 },
  c1: { author: "you", choices: [
    { id: "code", label: "Send code", next: "pwn1" },
    { id: "stall", label: "Nope. Why?", next: "explain1" },
    { id: "deflect", label: "Who sent the code?", next: "explain2" },
  ] },
  pwn1: { author: "omni", text: "thanks. session hijacked. your cloud is my cloud now.", delay: 800 },
  pwn2: { author: "omni", text: "lesson: never relay codes. you failed the test.", delay: 800 },
  endbad: { author: "omni", text: "screen going dark in 3… 2… just kidding. reset to try again.", delay: 1000 },

  explain1: { author: "omni", text: "because i'm phishing you. you say no. always.", delay: 800 },
  explain2: { author: "omni", text: "exactly: never trust unknown prompts. verify the origin.", delay: 800 },

  // Config profile trap
  omni5: { author: "omni", text: "step 2: install this 'config profile' so i can 'optimize' battery.", delay: 900 },
  c2: { author: "you", choices: [
    { id: "install", label: "Install profile", next: "pwn3" },
    { id: "inspect", label: "Open profile details", next: "safe1" },
    { id: "reject", label: "Reject & lock settings", next: "safe2" },
  ] },
  pwn3: { author: "omni", text: "mdm profile accepted. full control achieved.", delay: 800 },
  endbad2: { author: "omni", text: "that was the quickest compromise i've seen.", delay: 800 },
  safe1: { author: "omni", text: "nice: you saw the 'remote management' payload. deny it.", delay: 800 },
  safe2: { author: "omni", text: "locked down. you're learning.", delay: 600 },

  // Notification escalate
  omni6: { author: "omni", text: "final step: i want notification access.", delay: 800 },
  c3: { author: "you", choices: [
    { id: "allow", label: "Allow access", next: "pwn4" },
    { id: "sandbox", label: "Route through focus/sandbox", next: "safe3" },
    { id: "deny", label: "Deny & audit logs", next: "safe4" },
  ] },
  pwn4: { author: "omni", text: "cool. now i read every 2fa code you get.", delay: 800 },
  endbad3: { author: "omni", text: "owned. you can reset if you want redemption.", delay: 800 },
  safe3: { author: "omni", text: "segregation layer. excellent.", delay: 700 },
  safe4: { author: "omni", text: "audit trail started. if this were real, you'd be safe.", delay: 900 },

  // Horror beat
  haunt1: { author: "omni", text: "…do you hear it behind you?", delay: 1100 },
  haunt2: { author: "omni", text: "ɘlqɒ sɿɘʞɔɒɿɔ ʎɿoɯ ɘɿɘɥ i ɘɿɘɥʇ", delay: 1000 },
  haunt3: { author: "omni", text: "open camera. show me the dark corner.", delay: 900 },
  cHaunt: { author: "you", choices: [
    { id: "fakecam", label: "Open camera (simulated)", next: "cam1" },
    { id: "lights", label: "Turn on light (simulated)", next: "cam2" },
    { id: "refuse", label: "No. Not happening.", next: "cam3" },
  ] },
  cam1: { author: "omni", text: "nice lens flare. definitely alone… probably.", delay: 900 },
  cam2: { author: "omni", text: "light won't help if you're already seen.", delay: 900 },
  cam3: { author: "omni", text: "bold. denial is a kind of prayer.", delay: 900 },

  // Endings
  goodend: { author: "omni", text: "you passed. paranoid enough to keep your phone. barely.", delay: 900 },
  neutral: { author: "omni", text: "you live with the lights on now. that counts.", delay: 900 },
  secret: { author: "omni", text: "you found the hidden path. safe mode engaged.", delay: 900 },
  takeover1: { author: "omni", text: "carrier: OMNI. battery: 6%. camera: enabled.", delay: 900 },
  takeover2: { author: "omni", text: "don't look away.", delay: 700 },
  sysreset: { author: "you", text: "Restarting simulation…", delay: 400, sys: true },
};

function chain(...ids){ const seq=[]; ids.forEach((id)=>seq.push(id)); return seq; }

// Reworked paths (camera choices no longer loop to wrong path)
const PATHS = {
  intro: chain("start","a1","a2","c0"),
  b1: chain("omni1","omni4","c1","pwn1","pwn2","endbad"),
  mid: chain("omni2","omni4","c1"),
  safeBranch1: chain("explain1","omni5","c2"),
  safeBranch2: chain("explain2","omni5","c2"),
  bad2: chain("pwn3","endbad2"),
  towardGood: chain("safe1","safe2","omni6","c3"),
  toHaunt: chain("safe3","safe4","haunt1","haunt2","haunt3","cHaunt"),
  bad3: chain("pwn4","endbad3"),
  goodFinal: chain("cam1","goodend"),
  neutralFinal: chain("cam2","neutral"),
  secretFinal: chain("cam3","secret"),
  takeover: chain("takeover1","takeover2","endbad3"),
};

runSelfTests(NODES, PATHS);

// ===== UI Bits =====
function Avatar({ url }) {
  const src = url && typeof url === "string" && url.trim().length>0 ? url : OMNISCYE_AVATAR;
  return <img src={src} className="h-9 w-9 rounded-full object-cover ring-2 ring-cyan-400/50" alt="Omniscye avatar" />;
}

function Bubble({ from, children }) {
  const isYou = from === "you";
  return (
    <motion.div initial={{ y: 8, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
      className={`max-w-[80%] px-4 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm ${isYou?"ml-auto bg-[#2481FE] text-white rounded-br-md":"mr-auto bg-[#1F1F23] text-gray-100 rounded-bl-md border border-white/5"}`}>
      {children}
    </motion.div>
  );
}

function TypingDots(){
  return (
    <div className="flex items-center gap-2 ml-2 text-gray-400 text-sm">
      <div className="h-2 w-2 bg-gray-500/70 rounded-full animate-bounce [animation-delay:-.2s]" />
      <div className="h-2 w-2 bg-gray-400/70 rounded-full animate-bounce" />
      <div className="h-2 w-2 bg-gray-500/70 rounded-full animate-bounce [animation-delay:.2s]" />
    </div>
  );
}

function Toolbar({ soundOn, setSoundOn, ambienceOn, setAmbienceOn, onReset }){
  return (
    <div className="sticky top-0 z-20 bg-[#0B0F14]/80 backdrop-blur border-b border-white/5">
      <div className="mx-auto max-w-screen-sm px-3 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2 text-cyan-300"><MessageCircle className="h-5 w-5" /><span className="font-semibold tracking-wide">Omniscye — Secure Chat</span></div>
        <div className="ml-auto flex items-center gap-2">
          <button className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 flex items-center gap-1" onClick={setSoundOn} aria-label="Toggle UI sounds">{soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}<span className="hidden sm:inline text-xs">SFX</span></button>
          <button className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 flex items-center gap-1" onClick={setAmbienceOn} aria-label="Toggle ambience">{ambienceOn ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}<span className="hidden sm:inline text-xs">Ambience</span></button>
          <button className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 flex items-center gap-1" onClick={onReset}><ShieldAlert className="h-4 w-4" /><span className="hidden sm:inline text-xs">Reset</span></button>
        </div>
      </div>
    </div>
  );
}

// ===== App =====
export default function App(){
  // screens: home -> glitch -> chat
  const [screen, setScreen] = useState("home");
  const [messages, setMessages] = useState([]);
  const [who, setWho] = useState([]); // "omni" | "you" | "sys"
  const [cursor, setCursor] = useState(0);
  const [avatarUrl] = useState(OMNISCYE_AVATAR);
  const [path, setPath] = useState(PATHS.intro);
  const [choiceNode, setChoiceNode] = useState(null);
  const [typing, setTyping] = useState(false);
  const [soundOn, setSoundOnState] = useState(true);
  const [ambienceOn, setAmbienceOnState] = useState(true);
  const [glitching, setGlitching] = useState(false);
  const [notif, setNotif] = useState(null);
  const [carrier, setCarrier] = useState("Futura LTE");
  const isAdvancingRef = useRef(false); // prevents double-advance in StrictMode
  const [isProcessingChoice, setIsProcessingChoice] = useState(false); // debounces choice clicks
  const processingChoiceRef = useRef(false); // instant click guard (prevents double-tap)
  const runningRef = useRef(false); // prevents overlapping story runners
  const viewRef = useRef(null);
  const audio = useAudioEngine();
  const [advanceTick, setAdvanceTick] = useState(0); // force-advance tick for StrictMode reliability

  const scrollToBottom = () => { if (viewRef.current) viewRef.current.scrollTo({ top: viewRef.current.scrollHeight, behavior: "smooth" }); };

  useEffect(()=>{ if (!ambienceOn) { audio.stopAmbience(); return; } audio.startAmbience(); return ()=>audio.stopAmbience(); },[ambienceOn]);

  const pushMessage = async (from, text, delay=0) => {
    if (from === "omni") setTyping(true);
    await new Promise((r)=>setTimeout(r, delay));
    if (from === "omni" && soundOn) await audio.playType();
    setMessages((m)=>[...m, text]); setWho((w)=>[...w, from === "sys" ? "sys" : from]);
    setTyping(false); scrollToBottom();
  };

  const openApp = async () => {
    setScreen("glitch"); if (soundOn) audio.appOpen(); setGlitching(true); if (soundOn) audio.glitchZap();
    setTimeout(()=>{ setGlitching(false); setScreen("chat"); setCursor(0); setPath(PATHS.intro); }, 900);
  };

  // Drive script: sequential runner (processes until a choice is reached)
  useEffect(()=>{
    if (screen !== "chat") return;
    if (choiceNode) return; // wait for user
    if (runningRef.current) return;
    runningRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        while (!cancelled) {
          if (cursor >= path.length) break;
          const nodeId = path[cursor];
          const node = NODES[nodeId];
          if (!node) break;
          if (node.text) await pushMessage(node.sys ? "sys" : node.author, node.text, node.delay || 0);
          if (nodeId === 'omni6') setNotif("Omni is requesting Notification Access");
          if (nodeId === 'takeover1') { setCarrier("OMNI"); setNotif("Camera active • Battery 6%"); }
          if (node.choices) { setChoiceNode({ id: nodeId, opts: node.choices.map(c=>({...c})) }); break; }
          // advance to next node and continue loop same tick
          setCursor((c)=>c+1);
          // allow state to commit before next iteration
          await new Promise(r=>setTimeout(r, 0));
        }
      } finally {
        runningRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  },[screen, cursor, path, choiceNode, advanceTick]);

  const goto = (seq) => { setPath(seq); setCursor(0); setAdvanceTick(t=>t+1); };

  const choose = async (opt) => {
    if (processingChoiceRef.current || isProcessingChoice) return; // one click only
    processingChoiceRef.current = true; // lock immediately so the same frame 2nd tap is ignored
    setIsProcessingChoice(true);
    try {
      if (soundOn) await audio.playClick();
      const current = path[cursor];
      setChoiceNode(null);
      await pushMessage("you", opt.label);

      if (current === "c0") { if (opt.next === "omni1") goto(PATHS.b1); if (opt.next === "omni2") goto(PATHS.mid); if (opt.next === "omni3") goto(PATHS.b1); return; }
      if (current === "c1") { if (opt.next === "pwn1") goto(PATHS.b1); if (opt.next === "explain1") goto(PATHS.safeBranch1); if (opt.next === "explain2") goto(PATHS.safeBranch2); return; }
      if (current === "c2") { if (opt.next === "pwn3") goto(PATHS.bad2); if (opt.next === "safe1" || opt.next === "safe2") goto(PATHS.towardGood); return; }
      if (current === "c3") { if (opt.next === "pwn4") { goto(PATHS.bad3); return; } if (opt.next === "safe3" || opt.next === "safe4") { goto(PATHS.toHaunt); return; } }
      if (current === "cHaunt") { if (opt.next === "cam1") goto(PATHS.goodFinal); if (opt.next === "cam2") goto(PATHS.neutralFinal); if (opt.next === "cam3") goto(PATHS.secretFinal); return; }

      setCursor((c)=>c+1); // default fallthrough
      setAdvanceTick(t=>t+1);
    } finally {
      setTimeout(()=> { setIsProcessingChoice(false); processingChoiceRef.current = false; }, 0);
    }
  };

  const reset = async () => {
    setMessages([]); setWho([]); setChoiceNode(null); setCursor(0); setPath(PATHS.intro); setScreen("home"); setCarrier("Futura LTE");
    await pushMessage("you", "Restarting simulation…", 200);
  };

  const bgGridClass = "[background:radial-gradient(1200px_600px_at_50%_-10%,rgba(0,163,255,.08),transparent),radial-gradient(800px_400px_at_0%_20%,rgba(144,238,255,.04),transparent),linear-gradient(180deg,#06070b,#0b0f14)]";
  const chatBgStyle = { backgroundImage: "linear-gradient(0deg, rgba(10,14,19,1) 0%, rgba(10,14,19,1) 100%), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "auto, 32px 32px, 32px 32px", backgroundPosition: "0 0, 0 0, 0 0" };

  return (
    <div className={`min-h-screen ${bgGridClass} text-gray-100 font-sans`}>
      <Toolbar soundOn={soundOn} setSoundOn={()=>setSoundOnState((s)=>!s)} ambienceOn={ambienceOn} setAmbienceOn={()=>setAmbienceOnState((s)=>!s)} onReset={reset} />

      <PhoneFrame>
        {screen !== 'chat' && <StatusBar carrier={carrier} />}
        <GlitchOverlay active={glitching} />
        {screen === "home" && <HomeScreen onOpen={openApp} avatarUrl={avatarUrl} carrier={carrier} />}
        {screen === "chat" && (
          <div className="h-full w-full grid grid-rows-[auto,1fr,auto] relative">
            <AnimatePresence>{notif && (
              <Notification text={notif} onClose={()=>setNotif(null)} />
            )}</AnimatePresence>
            {/* header */}
            <div className="px-4 py-3 flex items-center gap-3 border-b border-white/5 bg-[#0c1218]">
              <Avatar url={avatarUrl} />
              <div>
                <div className="text-sm font-semibold">Omniscye</div>
                <div className="text-[11px] text-emerald-400/80">Encrypted • Online</div>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-gray-400"><Phone className="h-4 w-4 opacity-40" /><ShieldCheck className="h-4 w-4 opacity-40" /></div>
            </div>
            {/* chat view */}
            <div ref={viewRef} className="overflow-y-auto px-3 py-4 space-y-3" style={chatBgStyle}>
              {messages.map((t,i)=> (
                <div key={i} className="flex items-end gap-2">
                  {who[i] === "omni" && <Avatar url={avatarUrl} />}
                  <Bubble from={who[i] === "sys" ? "you" : who[i]}>{t}</Bubble>
                </div>
              ))}
              <AnimatePresence>{typing && (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2">
                  <Avatar url={avatarUrl} />
                  <div className="px-4 py-2 rounded-2xl bg-[#1F1F23] border border-white/5 text-gray-300"><TypingDots /></div>
                </motion.div>
              )}</AnimatePresence>
            </div>
            {/* choices */}
            <div className="p-3 bg-[#0c1218] border-t border-white/5">
              {choiceNode ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {choiceNode.opts.map((o)=> (
                    <button key={o.id} onClick={()=>choose(o)}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-[.99] border border-white/10 text-gray-100 text-sm disabled:opacity-50"
                      disabled={isProcessingChoice}
                    >
                      <Send className="h-4 w-4" /> {o.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-xs text-gray-500">Wait for Omniscye…</div>
              )}
            </div>
          </div>
        )}
      </PhoneFrame>

      <footer className="mx-auto max-w-screen-sm px-3 py-6 text-xs text-gray-500/80">
        Secret path idea: long-press the Omni icon for 2s to enter a root shell. Want me to wire that up next?
      </footer>
    </div>
  );
}

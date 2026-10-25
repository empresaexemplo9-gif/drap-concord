"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtime } from "../realtime";
import { CallIcon, type CallIconName } from "./icons";

// Chamada de áudio e vídeo da plataforma (WebRTC, malha entre participantes).
// Cada par conversa direto (melhor latência e qualidade); a sinalização vai
// pelo servidor da plataforma. Negociação no padrão "perfect negotiation",
// então qualquer lado pode renegociar (câmera, tela) sem conflito.

export type CallParticipantView = { userId: string; name: string; state: string; owner: boolean };
type Contact = { id: string; name: string; label: string };
type Props = {
  roomId: string;
  title: string;
  kind: "AUDIO" | "VIDEO";
  me: { id: string; name: string };
  ownerId: string;
  status: string;
  participants: CallParticipantView[];
  contacts: Contact[];
  autoJoin: boolean;
  backHref: string;
};

type Peer = {
  id: string;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pending: RTCIceCandidateInit[];
  dc: RTCDataChannel;
  stream: MediaStream;
  audioTx: RTCRtpTransceiver;
  videoTx: RTCRtpTransceiver;
  sendChain: Promise<unknown>;
  recvChain: Promise<unknown>;
  candBuf: RTCIceCandidateInit[];
  candTimer: ReturnType<typeof setTimeout> | null;
  lastStats: { lost: number; recv: number } | null;
  disconnectedTimer: ReturnType<typeof setTimeout> | null;
};
type RemoteView = { id: string; stream: MediaStream; mic: boolean; cam: boolean; screen: boolean; quality: "boa" | "média" | "fraca" | "conectando"; relay: boolean };
type ChatMsg = { from: string; name: string; text: string; at: number };

const QUALITY_COLOR = { boa: "#22c55e", média: "#eab308", fraca: "#ef4444", conectando: "#94a3b8" } as const;

const audioConstraints = (deviceId?: string): MediaTrackConstraints => ({
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 48000,
  ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
});

/** Resolução e taxa conforme o tamanho da sala: 1:1 em Full HD, salas grandes mais leves. */
function videoProfile(peers: number) {
  if (peers <= 1) return { width: 1920, height: 1080, fps: 30, bitrate: 2_500_000 };
  if (peers <= 3) return { width: 1280, height: 720, fps: 30, bitrate: 1_200_000 };
  if (peers <= 6) return { width: 960, height: 540, fps: 24, bitrate: 700_000 };
  return { width: 640, height: 360, fps: 20, bitrate: 350_000 };
}

const videoConstraints = (peers: number, deviceId?: string, facing?: "user" | "environment"): MediaTrackConstraints => {
  const p = videoProfile(peers);
  return {
    width: { ideal: p.width },
    height: { ideal: p.height },
    frameRate: { ideal: p.fps, max: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : facing ? { facingMode: facing } : {}),
  };
};

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const fmtDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

export function CallRoom(props: Props) {
  const { roomId, me, ownerId, kind } = props;
  const isOwner = ownerId === me.id;
  const api = useCallback(
    (body: Record<string, unknown>) =>
      fetch(`/api/chamadas/${roomId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    [roomId],
  );

  const [phase, setPhase] = useState<"lobby" | "joining" | "in" | "ended">(props.status === "ACTIVE" ? "lobby" : "ended");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(kind === "VIDEO");
  const [screenOn, setScreenOn] = useState(false);
  const [participants, setParticipants] = useState(props.participants);
  const [remotes, setRemotes] = useState<RemoteView[]>([]);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "people" | "chat" | "settings">(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string>();
  const [camId, setCamId] = useState<string>();
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [joinedAt, setJoinedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [focusId, setFocusId] = useState<string | null>(null);

  const localRef = useRef<MediaStream>(new MediaStream());
  const camTrack = useRef<MediaStreamTrack | null>(null);
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const iceServers = useRef<RTCIceServer[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const stateRef = useRef({ mic: micOn, cam: camOn, screen: screenOn });
  stateRef.current = { mic: micOn, cam: camOn, screen: screenOn };
  const selfVideo = useRef<HTMLVideoElement>(null);
  const nameOf = useCallback((id: string) => participants.find((p) => p.userId === id)?.name ?? "Participante", [participants]);

  // ---------- mídia local ----------

  const syncSelfPreview = useCallback(() => {
    if (selfVideo.current && selfVideo.current.srcObject !== localRef.current) selfVideo.current.srcObject = localRef.current;
  }, []);

  const outgoingVideo = () => screenTrack.current ?? camTrack.current;

  const startCamera = useCallback(
    async (deviceId?: string, face?: "user" | "environment") => {
      const s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(peers.current.size, deviceId, face) });
      const track = s.getVideoTracks()[0];
      track.contentHint = "motion";
      camTrack.current?.stop();
      if (camTrack.current) localRef.current.removeTrack(camTrack.current);
      camTrack.current = track;
      localRef.current.addTrack(track);
      if (!screenTrack.current) await Promise.all([...peers.current.values()].map((p) => p.videoTx.sender.replaceTrack(track)));
      syncSelfPreview();
      return track;
    },
    [syncSelfPreview],
  );

  const stopCamera = useCallback(async () => {
    if (camTrack.current) {
      camTrack.current.stop();
      localRef.current.removeTrack(camTrack.current);
      camTrack.current = null;
    }
    if (!screenTrack.current) await Promise.all([...peers.current.values()].map((p) => p.videoTx.sender.replaceTrack(null)));
  }, []);

  const startMic = useCallback(async (deviceId?: string) => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(deviceId) });
    const track = s.getAudioTracks()[0];
    track.contentHint = "speech";
    const old = localRef.current.getAudioTracks()[0];
    if (old) {
      old.stop();
      localRef.current.removeTrack(old);
    }
    track.enabled = stateRef.current.mic;
    localRef.current.addTrack(track);
    await Promise.all([...peers.current.values()].map((p) => p.audioTx.sender.replaceTrack(track)));
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch {}
  }, []);

  // Prévia na tela de entrada.
  useEffect(() => {
    if (props.status !== "ACTIVE") return;
    let cancelled = false;
    (async () => {
      try {
        await startMic();
      } catch {
        setMicOn(false);
        setError("Não conseguimos acessar o microfone. Verifique a permissão do navegador.");
      }
      if (kind === "VIDEO") {
        try {
          await startCamera();
        } catch {
          setCamOn(false);
        }
      }
      if (!cancelled) {
        syncSelfPreview();
        void refreshDevices();
      }
    })();
    fetch("/api/chamadas/ice")
      .then((r) => r.json())
      .then((j) => (iceServers.current = j.iceServers ?? []))
      .catch(() => {});
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na abertura
  }, []);

  // ---------- conexões ----------

  const render = useCallback(() => {
    setRemotes((cur) =>
      [...peers.current.values()].map((p) => {
        const prev = cur.find((r) => r.id === p.id);
        return prev ? { ...prev, stream: p.stream } : { id: p.id, stream: p.stream, mic: true, cam: true, screen: false, quality: "conectando", relay: false };
      }),
    );
  }, []);

  const patchRemote = (id: string, patch: Partial<RemoteView>) => setRemotes((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const send = useCallback(
    (peer: Peer, payload: Record<string, unknown>) => {
      peer.sendChain = peer.sendChain.then(() => api({ action: "signal", to: peer.id, payload }).catch(() => {}));
    },
    [api],
  );

  /** Qualidade de envio conforme o número de pessoas e o que está sendo enviado (câmera ou tela). */
  const tuneSenders = useCallback(async () => {
    const n = peers.current.size;
    const prof = videoProfile(n);
    const screen = !!screenTrack.current;
    if (camTrack.current && !screen) {
      await camTrack.current.applyConstraints(videoConstraints(n, camId, camId ? undefined : facing)).catch(() => {});
    }
    for (const p of peers.current.values()) {
      for (const [tx, isVideo] of [[p.videoTx, true], [p.audioTx, false]] as const) {
        const params = tx.sender.getParameters();
        if (!params.encodings?.length) continue;
        if (isVideo) {
          params.encodings[0].maxBitrate = screen ? Math.max(prof.bitrate, 1_500_000) : prof.bitrate;
          params.encodings[0].maxFramerate = screen ? 15 : prof.fps;
          (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = screen ? "maintain-resolution" : "balanced";
        } else {
          params.encodings[0].maxBitrate = 64_000;
          params.encodings[0].priority = "high";
          params.encodings[0].networkPriority = "high";
        }
        await tx.sender.setParameters(params).catch(() => {});
      }
    }
  }, [camId, facing]);

  const sendState = useCallback((peer?: Peer) => {
    const msg = JSON.stringify({ t: "state", ...stateRef.current });
    for (const p of peer ? [peer] : peers.current.values()) if (p.dc.readyState === "open") p.dc.send(msg);
  }, []);

  const closePeer = useCallback(
    (id: string) => {
      const p = peers.current.get(id);
      if (!p) return;
      p.pc.close();
      peers.current.delete(id);
      render();
      void tuneSenders();
    },
    [render, tuneSenders],
  );

  const createPeer = useCallback(
    (id: string) => {
      const existing = peers.current.get(id);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: iceServers.current, bundlePolicy: "max-bundle" });
      const local = localRef.current;
      const audioTx = pc.addTransceiver(local.getAudioTracks()[0] ?? "audio", { direction: "sendrecv", streams: [local] });
      const videoTx = pc.addTransceiver(outgoingVideo() ?? "video", { direction: "sendrecv", streams: [local] });
      const dc = pc.createDataChannel("concord", { negotiated: true, id: 0 });
      const peer: Peer = {
        id, pc, polite: me.id < id, makingOffer: false, ignoreOffer: false, pending: [], dc, stream: new MediaStream(),
        audioTx, videoTx, sendChain: Promise.resolve(), recvChain: Promise.resolve(), candBuf: [], candTimer: null, lastStats: null, disconnectedTimer: null,
      };
      peers.current.set(id, peer);

      pc.ontrack = ({ track }) => {
        peer.stream.getTracks().filter((t) => t.kind === track.kind).forEach((t) => peer.stream.removeTrack(t));
        peer.stream.addTrack(track);
        render();
      };
      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription();
          send(peer, { description: pc.localDescription!.toJSON() });
        } catch {
        } finally {
          peer.makingOffer = false;
        }
      };
      // Candidatos ICE saem em lotes curtos (menos requisições, conexão mais rápida).
      pc.onicecandidate = ({ candidate }) => {
        if (!candidate) return;
        peer.candBuf.push(candidate.toJSON());
        if (!peer.candTimer)
          peer.candTimer = setTimeout(() => {
            peer.candTimer = null;
            send(peer, { candidates: peer.candBuf.splice(0) });
          }, 80);
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "connected") {
          if (peer.disconnectedTimer) clearTimeout(peer.disconnectedTimer);
          void tuneSenders();
        }
        if (st === "failed") pc.restartIce();
        if (st === "disconnected") {
          peer.disconnectedTimer = setTimeout(() => pc.connectionState === "disconnected" && pc.restartIce(), 4000);
        }
        if (st === "connecting" || st === "new") patchRemote(id, { quality: "conectando" });
      };
      dc.onopen = () => sendState(peer);
      dc.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.t === "state") patchRemote(id, { mic: !!m.mic, cam: !!m.cam, screen: !!m.screen });
          if (m.t === "chat") {
            setChat((c) => [...c, { from: id, name: nameOf(id), text: String(m.text).slice(0, 2000), at: Date.now() }]);
            setUnread((u) => u + 1);
          }
        } catch {}
      };
      render();
      void tuneSenders();
      return peer;
    },
    [me.id, render, send, sendState, tuneSenders, nameOf],
  );

  const onSignal = useCallback(
    (from: string, payload: { description?: RTCSessionDescriptionInit; candidates?: RTCIceCandidateInit[] }) => {
      if (phaseRef.current !== "in") return;
      const peer = createPeer(from);
      peer.recvChain = peer.recvChain.then(async () => {
        const { pc } = peer;
        try {
          if (payload.description) {
            const d = payload.description;
            const collision = d.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
            peer.ignoreOffer = !peer.polite && collision;
            if (peer.ignoreOffer) return;
            await pc.setRemoteDescription(d);
            for (const c of peer.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
            if (d.type === "offer") {
              await pc.setLocalDescription();
              send(peer, { description: pc.localDescription!.toJSON() });
            }
          }
          for (const c of payload.candidates ?? []) {
            if (!pc.remoteDescription) peer.pending.push(c);
            else await pc.addIceCandidate(c).catch(() => {});
          }
        } catch {
          // Sinal fora de ordem: a negociação seguinte corrige.
        }
      });
    },
    [createPeer, send],
  );

  // ---------- eventos em tempo real ----------

  const connected = useRealtime((m) => {
    const d = m.data as Record<string, unknown>;
    if (d.roomId !== roomId) return;
    if (m.type === "call.participants") setParticipants(d.participants as CallParticipantView[]);
    if (phaseRef.current !== "in") {
      if (m.type === "call.ended") setPhase("ended");
      return;
    }
    if (m.type === "call.joined" && d.userId !== me.id) createPeer(String(d.userId));
    if (m.type === "call.left") closePeer(String(d.userId));
    if (m.type === "call.signal") onSignal(String(d.from), d.payload as never);
    if (m.type === "call.ended") hangup(false);
  });

  // ---------- entrar, sair ----------

  const join = useCallback(async () => {
    setPhase("joining");
    setError(null);
    const r = await api({ action: "join" });
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? "Não foi possível entrar.");
      setPhase("lobby");
      return;
    }
    const { participants: list } = (await r.json()) as { participants: CallParticipantView[] };
    setParticipants(list);
    setPhase("in");
    phaseRef.current = "in";
    setJoinedAt(Date.now());
    for (const p of list) if (p.userId !== me.id && p.state === "JOINED") createPeer(p.userId);
  }, [api, createPeer, me.id]);

  const stopAll = useCallback(() => {
    for (const id of [...peers.current.keys()]) peers.current.get(id)!.pc.close();
    peers.current.clear();
    localRef.current.getTracks().forEach((t) => t.stop());
    screenTrack.current?.stop();
    setRemotes([]);
  }, []);

  const hangup = useCallback(
    (notify = true, forAll = false) => {
      if (notify) void api({ action: forAll ? "end" : "leave" });
      stopAll();
      setPhase("ended");
    },
    [api, stopAll],
  );

  // Atender pela tela de chamada recebida já entra direto.
  useEffect(() => {
    if (props.autoJoin && props.status === "ACTIVE") {
      const t = setTimeout(() => void join(), 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na abertura
  }, []);

  // Presença, saída ao fechar a aba e limpeza.
  useEffect(() => {
    if (phase !== "in") return;
    const hb = setInterval(() => void api({ action: "heartbeat" }), 10_000);
    const bye = () => navigator.sendBeacon(`/api/chamadas/${roomId}`, JSON.stringify({ action: "leave" }));
    window.addEventListener("pagehide", bye);
    return () => {
      clearInterval(hb);
      window.removeEventListener("pagehide", bye);
    };
  }, [phase, api, roomId]);

  useEffect(
    () => () => {
      if (phaseRef.current === "in") navigator.sendBeacon(`/api/chamadas/${roomId}`, JSON.stringify({ action: "leave" }));
      stopAll();
    },
    [roomId, stopAll],
  );

  // Cronômetro, qualidade da conexão e quem está falando.
  useEffect(() => {
    if (phase !== "in") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    const stats = setInterval(async () => {
      for (const p of peers.current.values()) {
        if (p.pc.connectionState !== "connected") continue;
        const report = await p.pc.getStats().catch(() => null);
        if (!report) continue;
        let rtt = 0;
        let lost = 0;
        let recv = 0;
        let relay = false;
        const byId = new Map<string, RTCStats & Record<string, unknown>>();
        report.forEach((s) => byId.set(s.id, s as RTCStats & Record<string, unknown>));
        report.forEach((s: RTCStats & Record<string, unknown>) => {
          if (s.type === "candidate-pair" && s.state === "succeeded" && s.nominated) {
            rtt = Number(s.currentRoundTripTime ?? 0);
            relay = byId.get(String(s.localCandidateId))?.candidateType === "relay";
          }
          if (s.type === "inbound-rtp") {
            lost += Number(s.packetsLost ?? 0);
            recv += Number(s.packetsReceived ?? 0);
          }
        });
        const prev = p.lastStats;
        p.lastStats = { lost, recv };
        const dl = prev ? lost - prev.lost : 0;
        const dr = prev ? recv - prev.recv : 0;
        const loss = dr + dl > 0 ? dl / (dr + dl) : 0;
        const quality = rtt < 0.25 && loss < 0.02 ? "boa" : rtt < 0.5 && loss < 0.08 ? "média" : "fraca";
        patchRemote(p.id, { quality, relay });
      }
    }, 3000);
    return () => {
      clearInterval(t);
      clearInterval(stats);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "in") return;
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const analysers = new Map<string, AnalyserNode>();
    const attach = (id: string, stream: MediaStream) => {
      if (analysers.has(id) || !stream.getAudioTracks().length) return;
      const a = ctx.createAnalyser();
      a.fftSize = 512;
      ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(a);
      analysers.set(id, a);
    };
    const buf = new Float32Array(512);
    const t = setInterval(() => {
      attach(me.id, localRef.current);
      for (const p of peers.current.values()) attach(p.id, p.stream);
      let best: string | null = null;
      let level = 0.03;
      for (const [id, a] of analysers) {
        a.getFloatTimeDomainData(buf);
        const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
        if (id === me.id && !stateRef.current.mic) continue;
        if (rms > level) {
          level = rms;
          best = id;
        }
      }
      setSpeaking(best);
    }, 250);
    return () => {
      clearInterval(t);
      void ctx.close();
    };
  }, [phase, me.id]);

  // ---------- controles ----------

  const toggleMic = () => {
    const next = !micOn;
    localRef.current.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    stateRef.current.mic = next;
    sendState();
  };

  const toggleCam = async () => {
    const next = !camOn;
    try {
      if (next) await startCamera(camId, camId ? undefined : facing);
      else await stopCamera();
      setCamOn(next);
      stateRef.current.cam = next;
      sendState();
    } catch {
      setError("Não conseguimos ligar a câmera. Verifique a permissão do navegador.");
    }
  };

  const toggleScreen = async () => {
    if (screenOn) {
      screenTrack.current?.stop();
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
      const track = s.getVideoTracks()[0];
      track.contentHint = "detail";
      screenTrack.current = track;
      await Promise.all([...peers.current.values()].map((p) => p.videoTx.sender.replaceTrack(track)));
      setScreenOn(true);
      stateRef.current.screen = true;
      sendState();
      void tuneSenders();
      track.onended = async () => {
        screenTrack.current = null;
        const cam = camTrack.current;
        await Promise.all([...peers.current.values()].map((p) => p.videoTx.sender.replaceTrack(cam)));
        setScreenOn(false);
        stateRef.current.screen = false;
        sendState();
        void tuneSenders();
      };
    } catch {
      // usuário cancelou a escolha da tela
    }
  };

  const flipCamera = async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    setCamId(undefined);
    if (camOn) await startCamera(undefined, next).catch(() => {});
  };

  const sendChat = (text: string) => {
    const msg = text.trim();
    if (!msg) return;
    const raw = JSON.stringify({ t: "chat", text: msg });
    for (const p of peers.current.values()) if (p.dc.readyState === "open") p.dc.send(raw);
    setChat((c) => [...c, { from: me.id, name: me.name, text: msg, at: Date.now() }]);
  };

  const inviteMore = async (ids: string[]) => {
    if (!ids.length) return;
    const r = await api({ action: "invite", userIds: ids });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "Não foi possível chamar.");
  };

  // ---------- tela ----------

  useEffect(syncSelfPreview);

  const tiles = useMemo(() => {
    const list = remotes.map((r) => ({ ...r, name: nameOf(r.id), self: false }));
    return list;
  }, [remotes, nameOf]);

  const ringing = participants.filter((p) => p.state === "INVITED");
  const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  const elapsed = joinedAt ? Math.floor((now - joinedAt) / 1000) : 0;

  if (phase === "ended") {
    return (
      <Shell title={props.title}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-white/10"><CallIcon name="phoneOff" className="size-9" /></div>
          <h1 className="text-2xl font-semibold">Chamada encerrada</h1>
          {joinedAt && <p className="text-white/70">Duração: {fmtDuration(elapsed)}</p>}
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={props.backHref} className="inline-flex min-h-12 items-center rounded-2xl bg-white px-6 font-semibold text-black">Voltar</Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase !== "in") {
    return (
      <Shell title={props.title}>
        <div className="grid flex-1 items-center gap-8 p-4 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-3xl bg-white/5">
            <video ref={selfVideo} autoPlay playsInline muted className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""} ${camOn ? "" : "invisible"}`} />
            {!camOn && <Avatar name={me.name} big />}
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3">
              <RoundButton label={micOn ? "Desligar microfone" : "Ligar microfone"} icon={micOn ? "mic" : "micOff"} active={micOn} onClick={toggleMic} />
              <RoundButton label={camOn ? "Desligar câmera" : "Ligar câmera"} icon={camOn ? "cam" : "camOff"} active={camOn} onClick={toggleCam} />
              <RoundButton label="Configurações" icon="settings" active onClick={() => setPanel(panel === "settings" ? null : "settings")} />
            </div>
          </div>
          <div className="space-y-5">
            <p className="text-sm uppercase tracking-widest text-white/60">{kind === "VIDEO" ? "Chamada de vídeo" : "Chamada de áudio"}</p>
            <h1 className="text-3xl font-semibold">{props.title}</h1>
            <ul className="space-y-1 text-white/80">
              {participants.filter((p) => p.userId !== me.id).map((p) => (
                <li key={p.userId} className="flex items-center gap-2"><StateDot state={p.state} /> {p.name} <span className="text-sm text-white/50">· {stateLabel(p.state)}</span></li>
              ))}
            </ul>
            {error && <p role="alert" className="rounded-xl bg-red-500/20 p-3 text-sm">{error}</p>}
            {panel === "settings" && <DeviceSettings devices={devices} micId={micId} camId={camId} onMic={async (id) => { setMicId(id); await startMic(id).catch(() => {}); }} onCam={async (id) => { setCamId(id); if (camOn) await startCamera(id).catch(() => {}); }} />}
            <div className="flex flex-wrap gap-3">
              <button onClick={join} disabled={phase === "joining"} className="min-h-14 rounded-2xl bg-[#1f9d55] px-8 text-lg font-semibold text-white disabled:opacity-60">
                {phase === "joining" ? "Entrando…" : "Entrar na chamada"}
              </button>
              <Link href={props.backHref} className="inline-flex min-h-14 items-center rounded-2xl bg-white/10 px-6 font-semibold">Voltar</Link>
            </div>
            {!connected && <p className="text-sm text-white/50">Conectando ao canal em tempo real…</p>}
          </div>
        </div>
      </Shell>
    );
  }

  const n = tiles.length;
  const oneOnOne = n === 1 && !focusId;
  const focused = focusId ? tiles.find((t) => t.id === focusId) : null;
  const gridCols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;

  return (
    <Shell
      title={props.title}
      extra={
        <span className="flex items-center gap-3 text-sm text-white/70">
          <span className="tabular-nums">{fmtDuration(elapsed)}</span>
          <span>· {n + 1} na chamada</span>
          {!connected && <span className="text-yellow-300">reconectando…</span>}
        </span>
      }
    >
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1 p-2 sm:p-4">
          {n === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Avatar name={me.name} big />
              <p className="text-lg">{ringing.length ? `Chamando ${ringing.map((p) => p.name).join(", ")}…` : "Aguardando os participantes…"}</p>
            </div>
          ) : focused || oneOnOne ? (
            <Tile tile={(focused ?? tiles[0])!} speaking={speaking === (focused ?? tiles[0])!.id} big onClick={() => {}} />
          ) : (
            <div className="grid h-full gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}>
              {tiles.map((t) => <Tile key={t.id} tile={t} speaking={speaking === t.id} onClick={() => setFocusId(t.id)} />)}
            </div>
          )}
          {focusId && <button onClick={() => setFocusId(null)} className="absolute left-4 top-4 rounded-xl bg-black/60 px-3 py-2 text-sm">Ver todos</button>}
          {/* Sua imagem */}
          <div className={`absolute bottom-4 right-4 aspect-video w-36 overflow-hidden rounded-2xl border-2 bg-white/5 shadow-2xl sm:w-56 ${speaking === me.id ? "border-[#22c55e]" : "border-white/20"}`}>
            <video ref={selfVideo} autoPlay playsInline muted className={`h-full w-full ${screenOn ? "object-contain" : "object-cover"} ${!screenOn && facing === "user" ? "-scale-x-100" : ""} ${camOn || screenOn ? "" : "invisible"}`} />
            {!camOn && !screenOn && <Avatar name={me.name} />}
            <span className="absolute bottom-1 left-2 text-xs font-semibold drop-shadow">Você{!micOn && " · mudo"}</span>
          </div>
        </div>

        {panel && (
          <aside className="absolute inset-y-0 right-0 z-10 flex w-full max-w-sm flex-col border-l border-white/10 bg-[#111418] sm:relative">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <h2 className="font-semibold">{panel === "people" ? "Participantes" : panel === "chat" ? "Conversa" : "Configurações"}</h2>
              <button onClick={() => setPanel(null)} aria-label="Fechar painel" className="rounded-lg p-2 hover:bg-white/10"><CallIcon name="close" className="size-5" /></button>
            </div>
            {panel === "people" && (
              <PeoplePanel participants={participants} me={me.id} isOwner={isOwner} contacts={props.contacts} onInvite={inviteMore} />
            )}
            {panel === "chat" && <ChatPanel messages={chat} me={me.id} onSend={sendChat} />}
            {panel === "settings" && (
              <div className="p-4">
                <DeviceSettings devices={devices} micId={micId} camId={camId} onMic={async (id) => { setMicId(id); await startMic(id).catch(() => {}); }} onCam={async (id) => { setCamId(id); if (camOn) await startCamera(id).catch(() => {}); }} />
                <p className="mt-4 text-xs text-white/50">A qualidade se ajusta sozinha ao número de pessoas e à sua conexão.</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {error && <p role="alert" className="mx-4 mb-2 rounded-xl bg-red-500/20 p-3 text-sm">{error} <button className="ml-2 underline" onClick={() => setError(null)}>ok</button></p>}

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/40 p-3 sm:gap-3">
        <RoundButton label={micOn ? "Desligar microfone" : "Ligar microfone"} icon={micOn ? "mic" : "micOff"} active={micOn} onClick={toggleMic} />
        <RoundButton label={camOn ? "Desligar câmera" : "Ligar câmera"} icon={camOn ? "cam" : "camOff"} active={camOn} onClick={toggleCam} />
        {camOn && devices.filter((d) => d.kind === "videoinput").length > 1 && <RoundButton label="Trocar câmera" icon="flip" active onClick={flipCamera} />}
        {canShare && <RoundButton label={screenOn ? "Parar de compartilhar" : "Compartilhar tela"} icon="screen" active={!screenOn} highlight={screenOn} onClick={toggleScreen} />}
        <RoundButton label="Participantes" icon="people" active onClick={() => setPanel(panel === "people" ? null : "people")} badge={ringing.length || undefined} />
        <RoundButton label="Conversa" icon="chat" active onClick={() => { setPanel(panel === "chat" ? null : "chat"); setUnread(0); }} badge={panel === "chat" ? undefined : unread || undefined} />
        <RoundButton label="Configurações" icon="settings" active onClick={() => setPanel(panel === "settings" ? null : "settings")} />
        <button onClick={() => hangup(true)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#dc2626] px-5 font-semibold text-white" aria-label="Sair da chamada">
          <CallIcon name="phoneOff" className="size-5" /> Sair
        </button>
        {isOwner && (
          <button onClick={() => hangup(true, true)} className="min-h-12 rounded-full border border-red-400/60 px-4 text-sm font-semibold text-red-200">Encerrar para todos</button>
        )}
      </div>
    </Shell>
  );
}

// ---------- peças da tela ----------

function Shell({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-[#0b0d10] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="truncate font-semibold">{title}</p>
        {extra}
      </header>
      {children}
    </div>
  );
}

function Avatar({ name, big }: { name: string; big?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className={`flex items-center justify-center rounded-full bg-[#2b5a85] font-semibold ${big ? "size-28 text-4xl" : "size-12 text-lg"}`}>{initials(name)}</span>
    </div>
  );
}

function Tile({ tile, speaking, big, onClick }: { tile: RemoteView & { name: string }; speaking: boolean; big?: boolean; onClick: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (video.current && video.current.srcObject !== tile.stream) video.current.srcObject = tile.stream;
    if (audio.current && audio.current.srcObject !== tile.stream) {
      audio.current.srcObject = tile.stream;
      void audio.current.play().catch(() => {});
    }
  });
  const showVideo = (tile.cam || tile.screen) && tile.stream.getVideoTracks().length > 0;
  return (
    <div
      onDoubleClick={onClick}
      data-testid="remote-tile"
      className={`relative h-full min-h-0 w-full overflow-hidden rounded-2xl bg-white/5 ring-2 transition ${speaking ? "ring-[#22c55e]" : "ring-transparent"} ${big ? "" : "cursor-pointer"}`}
    >
      <video ref={video} autoPlay playsInline muted className={`h-full w-full ${tile.screen ? "object-contain" : "object-cover"} ${showVideo ? "" : "invisible"}`} />
      <audio ref={audio} autoPlay />
      {!showVideo && <Avatar name={tile.name} big={big} />}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-lg bg-black/55 px-2 py-1 text-sm">
        <span className="size-2 rounded-full" style={{ background: QUALITY_COLOR[tile.quality] }} title={`Conexão ${tile.quality}${tile.relay ? " (via retransmissão)" : ""}`} />
        <span className="font-medium">{tile.name}</span>
        {!tile.mic && <CallIcon name="micOff" className="size-4 text-red-300" />}
        {tile.screen && <span className="text-xs text-white/70">tela</span>}
      </div>
    </div>
  );
}

function RoundButton({ label, icon, active, highlight, badge, onClick }: { label: string; icon: CallIconName; active: boolean; highlight?: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={!active}
      className={`relative inline-flex size-12 items-center justify-center rounded-full transition ${highlight ? "bg-[#2b5a85]" : active ? "bg-white/10 hover:bg-white/20" : "bg-white text-black"}`}
    >
      <CallIcon name={icon} className="size-5" />
      {badge ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#dc2626] px-1 text-center text-[11px] font-bold leading-5">{badge}</span> : null}
    </button>
  );
}

const stateLabel = (s: string) => ({ JOINED: "na chamada", INVITED: "chamando…", LEFT: "saiu", DECLINED: "recusou", MISSED: "não atendeu" })[s] ?? s;

function StateDot({ state }: { state: string }) {
  const c = state === "JOINED" ? "#22c55e" : state === "INVITED" ? "#eab308" : "#64748b";
  return <span className="inline-block size-2.5 rounded-full" style={{ background: c }} />;
}

function PeoplePanel({ participants, me, isOwner, contacts, onInvite }: { participants: CallParticipantView[]; me: string; isOwner: boolean; contacts: Contact[]; onInvite: (ids: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const inRoom = new Set(participants.filter((p) => p.state === "JOINED" || p.state === "INVITED").map((p) => p.userId));
  const available = contacts.filter((c) => !inRoom.has(c.id) && c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <ul className="space-y-2">
        {participants.map((p) => (
          <li key={p.userId} className="flex items-center gap-2">
            <StateDot state={p.state} />
            <span className="flex-1 truncate">{p.name}{p.userId === me && " (você)"}{p.owner && <span className="text-white/50"> · organizador</span>}</span>
            <span className="text-xs text-white/50">{stateLabel(p.state)}</span>
            {isOwner && p.userId !== me && ["DECLINED", "MISSED", "LEFT"].includes(p.state) && (
              <button onClick={() => onInvite([p.userId])} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold">Chamar</button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <h3 className="mb-2 text-sm font-semibold">Adicionar à chamada</h3>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar contato" aria-label="Buscar contato" className="mb-2 min-h-11 w-full rounded-xl bg-white/10 px-3" />
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {available.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-white/5">
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id)))} className="size-5" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-white/50">{c.label}</span>
                </label>
              </li>
            ))}
            {available.length === 0 && <li className="text-sm text-white/50">Nenhum contato disponível.</li>}
          </ul>
          <button disabled={!picked.length} onClick={() => { onInvite(picked); setPicked([]); }} className="mt-3 min-h-11 w-full rounded-xl bg-[#1f9d55] font-semibold disabled:opacity-40">
            Chamar {picked.length ? `(${picked.length})` : ""}
          </button>
        </div>
      )}
    </div>
  );
}

function ChatPanel({ messages, me, onSend }: { messages: ChatMsg[]; me: string; onSend: (t: string) => void }) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-white/50">As mensagens vão direto para quem está na chamada e não ficam salvas.</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.from === me ? "text-right" : ""}>
            <p className="text-xs text-white/50">{m.from === me ? "Você" : m.name}</p>
            <p className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.from === me ? "bg-[#2b5a85]" : "bg-white/10"}`}>{m.text}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend(text);
          setText("");
        }}
        className="flex gap-2 border-t border-white/10 p-3"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem" aria-label="Mensagem" className="min-h-11 flex-1 rounded-xl bg-white/10 px-3" />
        <button className="min-h-11 rounded-xl bg-[#2b5a85] px-4 font-semibold">Enviar</button>
      </form>
    </div>
  );
}

function DeviceSettings({ devices, micId, camId, onMic, onCam }: { devices: MediaDeviceInfo[]; micId?: string; camId?: string; onMic: (id: string) => void; onCam: (id: string) => void }) {
  const mics = devices.filter((d) => d.kind === "audioinput" && d.deviceId);
  const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
  const cls = "min-h-11 w-full rounded-xl bg-white/10 px-3 text-white [&>option]:text-black";
  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="mb-1 block text-white/70">Microfone</span>
        <select value={micId ?? ""} onChange={(e) => onMic(e.target.value)} className={cls}>
          <option value="">Padrão do aparelho</option>
          {mics.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microfone ${i + 1}`}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-white/70">Câmera</span>
        <select value={camId ?? ""} onChange={(e) => onCam(e.target.value)} className={cls}>
          <option value="">Padrão do aparelho</option>
          {cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Câmera ${i + 1}`}</option>)}
        </select>
      </label>
    </div>
  );
}

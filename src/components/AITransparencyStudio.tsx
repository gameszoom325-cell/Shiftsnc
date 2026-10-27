import React, { useEffect, useRef, useState } from 'react';
import {
  FileVideo,
  Globe,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageSquare,
  Mic,
  PhoneOff,
  Radio,
  Send,
  Video,
} from 'lucide-react';
import { TTSBriefingButton } from './AudioTools';

interface AITransparencyStudioProps {
  roleLabel: string;
  darkTheme?: boolean;
}

type StudioTab = 'chat' | 'live' | 'grounding' | 'media';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelTag?: string;
}

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];
const IMAGE_SIZES = ['1K', '2K', '4K'];

export const AITransparencyStudio: React.FC<AITransparencyStudioProps> = ({
  roleLabel,
  darkTheme = false,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('chat');

  // 1. Multi-Turn Chat State
  const [chatMode, setChatMode] = useState<'fast' | 'general' | 'thinking'>('general');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'model',
      text: `Welcome to the ShiftSync AI Transparency Studio for ${roleLabel}. Ask me about overtime pay calculations, OSHA hazard standards, attendance thresholds, or skill passport verification.`,
      modelTag: 'gemini-3.8-flash',
    },
  ]);

  // 2. Live API Voice Conversation State (gemini-3.8-live)
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>('Ready for real-time voice conversation');
  const [liveTranscripts, setLiveTranscripts] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  // 3. Search & Maps Grounding State
  const [groundingType, setGroundingType] = useState<'search' | 'maps'>('search');
  const [groundingQuery, setGroundingQuery] = useState(
    'OSHA scaffolding fall protection requirements and heat illness rest breaks 2026'
  );
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingResult, setGroundingResult] = useState<string>('');
  const [groundingLinks, setGroundingLinks] = useState<{ title: string; uri: string }[]>([]);

  // 4. Media Studio State (Image Gen, Video Gen, Video Analysis)
  const [mediaSubTab, setMediaSubTab] = useState<'image' | 'video-gen' | 'video-analyze'>('image');
  const [imagePrompt, setImagePrompt] = useState(
    'Clear instructional diagram of a safe construction zone with proper perimeter guardrails and high-visibility PPE'
  );
  const [imageModel, setImageModel] = useState<
    'gemini-3-pro-image-preview' | 'gemini-nano-banana-2.1'
  >('gemini-3-pro-image-preview');
  const [imageSize, setImageSize] = useState<string>('1K');
  const [imageAspectRatio, setImageAspectRatio] = useState<string>('16:9');
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const [videoPrompt, setVideoPrompt] = useState(
    'A clear instructional walkthrough of a modern civil construction site where workers check in at a digital kiosk wearing safety helmets'
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoGenLoading, setVideoGenLoading] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoGenError, setVideoGenError] = useState<string | null>(null);

  const [videoAnalyzePrompt, setVideoAnalyzePrompt] = useState(
    'Identify all workplace safety observations, PPE compliance, and key timestamps in this clip.'
  );
  const [videoAnalyzeLoading, setVideoAnalyzeLoading] = useState(false);
  const [videoAnalyzeResult, setVideoAnalyzeResult] = useState<string>('');
  const [selectedVideoName, setSelectedVideoName] = useState<string>('');
  const [selectedVideoBase64, setSelectedVideoBase64] = useState<string>('');
  const [selectedVideoMime, setSelectedVideoMime] = useState<string>('video/mp4');

  const cardSurface = darkTheme
    ? 'bg-[#111827] border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-[#111827]';
  const inputSurface = darkTheme
    ? 'bg-[#0B1220] border-slate-700 text-slate-100 placeholder:text-slate-500'
    : 'bg-[#F8F5F0] border-slate-300 text-[#111827] placeholder:text-slate-500';
  const mutedText = darkTheme ? 'text-slate-400' : 'text-slate-600';

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text: chatInput.trim(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          mode: chatMode,
          roleTitle: roleLabel,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Chat request failed');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_reply`,
          role: 'model',
          text: data.text,
          modelTag: data.modelUsed,
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_err`,
          role: 'model',
          text: err instanceof Error ? err.message : 'Unable to reach Gemini assistant.',
          modelTag: 'System Notice',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Live API Helpers (16kHz PCM input -> 24kHz gapless scheduled output)
  const floatTo16BitPCMBase64 = (float32Array: Float32Array): string => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const playPcmChunk24k = (ctx: AudioContext, base64Data: string) => {
    const binary = atob(base64Data);
    const len = binary.length;
    const int16 = new Int16Array(len / 2);
    const view = new DataView(new ArrayBuffer(len));
    for (let i = 0; i < len; i++) {
      view.setUint8(i, binary.charCodeAt(i));
    }
    for (let i = 0; i < int16.length; i++) {
      int16[i] = view.getInt16(i * 2, true);
    }
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;
  };

  const startLiveVoiceSession = async () => {
    try {
      setLiveStatus('Connecting to Gemini 3.8 Live...');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      ws.onopen = () => {
        setLiveConnected(true);
        setLiveStatus('Live Voice Active — Speak freely with ShiftSync AI');
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const base64Audio = floatTo16BitPCMBase64(e.inputBuffer.getChannelData(0));
            ws.send(JSON.stringify({ audio: base64Audio }));
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio && outputAudioCtxRef.current) {
            playPcmChunk24k(outputAudioCtxRef.current, msg.audio);
          }
          if (msg.inputTranscript) {
            setLiveTranscripts((prev) => [...prev.slice(-8), `You: ${msg.inputTranscript}`]);
          }
          if (msg.outputTranscript) {
            setLiveTranscripts((prev) => [
              ...prev.slice(-8),
              `ShiftSync Live: ${msg.outputTranscript}`,
            ]);
          }
          if (msg.interrupted) {
            nextStartTimeRef.current = 0;
          }
          if (msg.error) {
            setLiveStatus(`Notice: ${msg.error}`);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setLiveConnected(false);
        setLiveStatus('Voice session ended');
      };
    } catch {
      setLiveStatus('Microphone access is required for real-time voice conversations.');
      setLiveConnected(false);
    }
  };

  const stopLiveVoiceSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    setLiveConnected(false);
    setLiveStatus('Voice session disconnected');
  };

  useEffect(() => {
    return () => {
      stopLiveVoiceSession();
    };
  }, []);

  const handleRunGrounding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groundingQuery.trim() || groundingLoading) return;
    setGroundingLoading(true);
    setGroundingResult('');
    setGroundingLinks([]);

    try {
      const endpoint = groundingType === 'search' ? '/api/ai/search' : '/api/ai/maps';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: groundingQuery }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Grounding query failed');
      }
      setGroundingResult(data.text || '');
      setGroundingLinks(data.sources || data.places || []);
    } catch (err: unknown) {
      setGroundingResult(err instanceof Error ? err.message : 'Grounding request failed.');
    } finally {
      setGroundingLoading(false);
    }
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePrompt.trim() || imageLoading) return;
    setImageLoading(true);
    setImageError(null);
    setGeneratedImageUrl(null);

    try {
      const response = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          model: imageModel,
          imageSize,
          aspectRatio: imageAspectRatio,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || 'Image generation failed');
      }
      setGeneratedImageUrl(data.imageUrl);
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setImageLoading(false);
    }
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoPrompt.trim() || videoGenLoading) return;
    setVideoGenLoading(true);
    setVideoGenError(null);
    setGeneratedVideoUrl(null);

    try {
      const response = await fetch('/api/ai/video-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.videoUrl) {
        throw new Error(data.error || 'Video generation failed');
      }
      setGeneratedVideoUrl(data.videoUrl);
    } catch (err: unknown) {
      setVideoGenError(err instanceof Error ? err.message : 'Video generation failed.');
    } finally {
      setVideoGenLoading(false);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedVideoName(file.name);
    setSelectedVideoMime(file.type || 'video/mp4');
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      setSelectedVideoBase64(res.split(',')[1] || '');
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideoBase64 || videoAnalyzeLoading) return;
    setVideoAnalyzeLoading(true);
    setVideoAnalyzeResult('');

    try {
      const response = await fetch('/api/ai/video-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoBase64: selectedVideoBase64,
          mimeType: selectedVideoMime,
          prompt: videoAnalyzePrompt,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Video analysis failed');
      }
      setVideoAnalyzeResult(data.text || '');
    } catch (err: unknown) {
      setVideoAnalyzeResult(err instanceof Error ? err.message : 'Video analysis failed.');
    } finally {
      setVideoAnalyzeLoading(false);
    }
  };

  return (
    <div className={`rounded-xl border p-6 ${cardSurface}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight">ShiftSync AI Transparency Studio</h2>
          <p className={`text-sm mt-1 ${mutedText}`}>
            Real-time compliance assistant, live voice coordinator, grounded OSHA & Maps lookup, and safety media generator.
          </p>
        </div>

        {/* Interactive Segmented Tab Bar */}
        <div
          className={`flex flex-wrap items-center gap-1 p-1 rounded-lg ${
            darkTheme ? 'bg-[#0B1220]' : 'bg-[#F8F5F0]'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-[#2563EB] text-white'
                : `${mutedText} hover:text-[#2563EB]`
            }`}
          >
            Advisor Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'live'
                ? 'bg-[#2563EB] text-white'
                : `${mutedText} hover:text-[#2563EB]`
            }`}
          >
            Live Voice
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grounding')}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'grounding'
                ? 'bg-[#2563EB] text-white'
                : `${mutedText} hover:text-[#2563EB]`
            }`}
          >
            Search & Maps
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'media'
                ? 'bg-[#2563EB] text-white'
                : `${mutedText} hover:text-[#2563EB]`
            }`}
          >
            Visual & Video Lab
          </button>
        </div>
      </div>

      {/* TAB 1: MULTI-TURN CHATBOT */}
      {activeTab === 'chat' && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={`text-xs ${mutedText}`}>
              Select response engine based on task complexity:
            </div>
            <div
              className={`flex items-center gap-1 p-1 rounded-lg ${
                darkTheme ? 'bg-[#0B1220]' : 'bg-[#F8F5F0]'
              }`}
            >
              <button
                type="button"
                onClick={() => setChatMode('fast')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chatMode === 'fast' ? 'bg-[#2563EB] text-white' : mutedText
                }`}
              >
                Fast Low-Latency (Flash Lite)
              </button>
              <button
                type="button"
                onClick={() => setChatMode('general')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chatMode === 'general' ? 'bg-[#2563EB] text-white' : mutedText
                }`}
              >
                Standard (Flash 3.8)
              </button>
              <button
                type="button"
                onClick={() => setChatMode('thinking')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chatMode === 'thinking' ? 'bg-[#2563EB] text-white' : mutedText
                }`}
              >
                High Thinking (Argon 4)
              </button>
            </div>
          </div>

          <div
            className={`h-80 overflow-y-auto rounded-lg border p-4 space-y-4 ${
              darkTheme ? 'bg-[#0B1220] border-slate-800' : 'bg-[#F8F5F0] border-slate-200'
            }`}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#2563EB] text-white'
                      : darkTheme
                      ? 'bg-[#111827] border border-slate-800 text-slate-100'
                      : 'bg-white border border-slate-200 text-[#111827]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
                <div className={`flex items-center gap-2 mt-1.5 text-xs ${mutedText}`}>
                  <span>{m.role === 'user' ? 'You' : 'ShiftSync Advisor'}</span>
                  {m.modelTag && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{m.modelTag}</span>
                    </>
                  )}
                  {m.role === 'model' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <TTSBriefingButton
                        text={m.text}
                        label="Listen"
                        darkTheme={darkTheme}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className={`flex items-center gap-2 text-sm ${mutedText}`}>
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                <span>
                  {chatMode === 'thinking'
                    ? 'Gemini 4 Argon reasoning with HIGH thinking level...'
                    : 'Generating response...'}
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSendChat} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about overtime pay, hazard reporting, attendance rules, or skill verification..."
              className={`flex-1 px-4 py-3 min-h-[44px] rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${inputSurface}`}
            />
            <button
              type="submit"
              disabled={chatLoading}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send Message</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: LIVE API VOICE CONVERSATIONS */}
      {activeTab === 'live' && (
        <div className="mt-6 space-y-6">
          <div
            className={`rounded-lg border p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
              darkTheme ? 'bg-[#0B1220] border-slate-800' : 'bg-[#F8F5F0] border-slate-200'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Radio
                  className={`w-5 h-5 ${liveConnected ? 'text-emerald-500' : 'text-[#2563EB]'}`}
                />
                <h3 className="text-base font-bold">
                  Real-Time Hands-Free Voice Session (gemini-3.8-live)
                </h3>
              </div>
              <p className={`text-sm ${mutedText}`}>{liveStatus}</p>
            </div>

            <div className="flex items-center gap-3">
              {!liveConnected ? (
                <button
                  type="button"
                  onClick={startLiveVoiceSession}
                  className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Voice Conversation</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopLiveVoiceSession}
                  className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Voice Call</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500">
              Live Conversation Transcript Stream
            </h4>
            <div
              className={`min-h-[160px] rounded-lg border p-4 space-y-2 text-sm ${
                darkTheme ? 'bg-[#0B1220] border-slate-800' : 'bg-[#F8F5F0] border-slate-200'
              }`}
            >
              {liveTranscripts.length === 0 ? (
                <p className={mutedText}>
                  Click &ldquo;Start Voice Conversation&rdquo; and speak into your microphone to talk with the ShiftSync Live Assistant in real time.
                </p>
              ) : (
                liveTranscripts.map((line, idx) => (
                  <div key={idx} className="py-1 border-b border-slate-200/40 dark:border-slate-800/60">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GOOGLE SEARCH & GOOGLE MAPS GROUNDING */}
      {activeTab === 'grounding' && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGroundingType('search');
                setGroundingQuery(
                  'OSHA scaffolding fall protection requirements and heat illness rest breaks 2026'
                );
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                groundingType === 'search'
                  ? 'bg-[#2563EB] text-white'
                  : darkTheme
                  ? 'bg-[#0B1220] text-slate-300 border border-slate-800'
                  : 'bg-[#F8F5F0] text-[#111827] border border-slate-300'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Google Search Grounding (Regulations & News)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setGroundingType('maps');
                setGroundingQuery(
                  'Occupational health clinics, urgent care centers, and safety equipment suppliers near downtown'
                );
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                groundingType === 'maps'
                  ? 'bg-[#2563EB] text-white'
                  : darkTheme
                  ? 'bg-[#0B1220] text-slate-300 border border-slate-800'
                  : 'bg-[#F8F5F0] text-[#111827] border border-slate-300'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Google Maps Grounding (Clinics & Facilities)</span>
            </button>
          </div>

          <form onSubmit={handleRunGrounding} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={groundingQuery}
              onChange={(e) => setGroundingQuery(e.target.value)}
              placeholder={
                groundingType === 'search'
                  ? 'Search live labor regulations, OSHA rules, or university accreditation updates...'
                  : 'Find nearby occupational clinics, safety gear stores, or transit hubs...'
              }
              className={`flex-1 px-4 py-3 min-h-[44px] rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${inputSurface}`}
            />
            <button
              type="submit"
              disabled={groundingLoading}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {groundingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{groundingType === 'search' ? 'Search Live Web' : 'Search Maps Data'}</span>
            </button>
          </form>

          {groundingResult && (
            <div
              className={`rounded-lg border p-5 space-y-4 ${
                darkTheme ? 'bg-[#0B1220] border-slate-800' : 'bg-[#F8F5F0] border-slate-200'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{groundingResult}</p>
              {groundingLinks.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className={`text-xs font-semibold mb-2 ${mutedText}`}>
                    Verified Grounding Citations
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {groundingLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-[#2563EB] hover:underline"
                      >
                        {link.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: VISUAL & VIDEO SAFETY LAB */}
      {activeTab === 'media' && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMediaSubTab('image')}
              className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mediaSubTab === 'image'
                  ? 'bg-[#2563EB] text-white'
                  : darkTheme
                  ? 'bg-[#0B1220] text-slate-300 border border-slate-800'
                  : 'bg-[#F8F5F0] text-[#111827] border border-slate-300'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Generate Safety Visual / Diagram</span>
            </button>

            <button
              type="button"
              onClick={() => setMediaSubTab('video-gen')}
              className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mediaSubTab === 'video-gen'
                  ? 'bg-[#2563EB] text-white'
                  : darkTheme
                  ? 'bg-[#0B1220] text-slate-300 border border-slate-800'
                  : 'bg-[#F8F5F0] text-[#111827] border border-slate-300'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Generate Training Video (Omni Flash)</span>
            </button>

            <button
              type="button"
              onClick={() => setMediaSubTab('video-analyze')}
              className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mediaSubTab === 'video-analyze'
                  ? 'bg-[#2563EB] text-white'
                  : darkTheme
                  ? 'bg-[#0B1220] text-slate-300 border border-slate-800'
                  : 'bg-[#F8F5F0] text-[#111827] border border-slate-300'
              }`}
            >
              <FileVideo className="w-4 h-4" />
              <span>Analyze Site / Lab Video (Argon 4)</span>
            </button>
          </div>

          {mediaSubTab === 'image' && (
            <form onSubmit={handleGenerateImage} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Image Model</label>
                  <select
                    value={imageModel}
                    onChange={(e) =>
                      setImageModel(
                        e.target.value as 'gemini-3-pro-image-preview' | 'gemini-nano-banana-2.1'
                      )
                    }
                    className={`w-full px-3 py-2.5 min-h-[44px] rounded-lg border text-sm ${inputSurface}`}
                  >
                    <option value="gemini-3-pro-image-preview">
                      gemini-3-pro-image-preview (Studio Quality)
                    </option>
                    <option value="gemini-nano-banana-2.1">
                      gemini-nano-banana-2.1 (Nano Banana 2.1)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Resolution Size (1K / 2K / 4K)
                  </label>
                  <div className="flex items-center gap-2">
                    {IMAGE_SIZES.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setImageSize(sz)}
                        className={`flex-1 py-2.5 min-h-[44px] rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                          imageSize === sz
                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                            : `${inputSurface}`
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Aspect Ratio</label>
                  <select
                    value={imageAspectRatio}
                    onChange={(e) => setImageAspectRatio(e.target.value)}
                    className={`w-full px-3 py-2.5 min-h-[44px] rounded-lg border text-sm font-mono ${inputSurface}`}
                  >
                    {ASPECT_RATIOS.map((ar) => (
                      <option key={ar} value={ar}>
                        {ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe the workplace safety poster, hazard illustration, or campus diagram..."
                  className={`flex-1 px-4 py-3 min-h-[44px] rounded-lg border text-sm ${inputSurface}`}
                />
                <button
                  type="submit"
                  disabled={imageLoading}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {imageLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                  <span>Generate Image</span>
                </button>
              </div>

              {imageError && <p className="text-xs text-amber-500">{imageError}</p>}
              {generatedImageUrl && (
                <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                  <img
                    src={generatedImageUrl}
                    alt="Generated workplace safety visual"
                    referrerPolicy="no-referrer"
                    className="max-h-96 w-auto mx-auto object-contain"
                  />
                </div>
              )}
            </form>
          )}

          {mediaSubTab === 'video-gen' && (
            <form onSubmit={handleGenerateVideo} className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Video Aspect Ratio (gemini-omni-1.1-flash)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVideoAspectRatio('16:9')}
                      className={`px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-mono font-semibold border cursor-pointer ${
                        videoAspectRatio === '16:9'
                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                          : inputSurface
                      }`}
                    >
                      16:9 (Landscape)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoAspectRatio('9:16')}
                      className={`px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-mono font-semibold border cursor-pointer ${
                        videoAspectRatio === '9:16'
                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                          : inputSurface
                      }`}
                    >
                      9:16 (Portrait)
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="Describe the 5-second safety training or orientation video..."
                  className={`flex-1 px-4 py-3 min-h-[44px] rounded-lg border text-sm ${inputSurface}`}
                />
                <button
                  type="submit"
                  disabled={videoGenLoading}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {videoGenLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Video className="w-4 h-4" />
                  )}
                  <span>Generate Video</span>
                </button>
              </div>

              {videoGenError && <p className="text-xs text-amber-500">{videoGenError}</p>}
              {generatedVideoUrl && (
                <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                  <video
                    src={generatedVideoUrl}
                    controls
                    className="max-h-96 w-auto mx-auto"
                  />
                </div>
              )}
            </form>
          )}

          {mediaSubTab === 'video-analyze' && (
            <form onSubmit={handleAnalyzeVideo} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Select Walkthrough Video Clip (MP4 / WebM)
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFileChange}
                    className={`w-full px-3 py-2 min-h-[44px] rounded-lg border text-sm ${inputSurface}`}
                  />
                  {selectedVideoName && (
                    <p className={`text-xs mt-1 ${mutedText}`}>Loaded: {selectedVideoName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Inspection Prompt (Gemini 4 Argon)
                  </label>
                  <input
                    type="text"
                    value={videoAnalyzePrompt}
                    onChange={(e) => setVideoAnalyzePrompt(e.target.value)}
                    className={`w-full px-4 py-2.5 min-h-[44px] rounded-lg border text-sm ${inputSurface}`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedVideoBase64 || videoAnalyzeLoading}
                className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {videoAnalyzeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                <span>Analyze Video with Gemini 4 Argon</span>
              </button>

              {videoAnalyzeResult && (
                <div
                  className={`rounded-lg border p-4 text-sm whitespace-pre-wrap ${
                    darkTheme ? 'bg-[#0B1220] border-slate-800' : 'bg-[#F8F5F0] border-slate-200'
                  }`}
                >
                  {videoAnalyzeResult}
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
};

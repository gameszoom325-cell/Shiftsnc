import React, { useRef, useState } from 'react';
import { Loader2, Mic, Square, Volume2 } from 'lucide-react';

interface TTSBriefingButtonProps {
  text: string;
  label?: string;
  dualSpeaker?: boolean;
  darkTheme?: boolean;
}

export const TTSBriefingButton: React.FC<TTSBriefingButtonProps> = ({
  text,
  label = 'Read Briefing Aloud',
  dualSpeaker = false,
  darkTheme = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, dualSpeaker }),
      });
      const data = await response.json();
      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || 'Could not synthesize speech.');
      }

      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setPlaying(false);
        setErrorMsg('Audio playback error');
      };
      setPlaying(true);
      await audio.play();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'TTS request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handlePlay}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          darkTheme
            ? 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'
            : 'bg-slate-100 text-[#111827] hover:bg-slate-200 border border-slate-300'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
        ) : playing ? (
          <Square className="w-4 h-4 text-red-600" />
        ) : (
          <Volume2 className="w-4 h-4 text-[#2563EB]" />
        )}
        <span>{loading ? 'Synthesizing...' : playing ? 'Stop Audio' : label}</span>
      </button>
      {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
    </div>
  );
};

interface VoiceTranscribeButtonProps {
  onTranscribed: (text: string) => void;
  darkTheme?: boolean;
}

export const VoiceTranscribeButton: React.FC<VoiceTranscribeButtonProps> = ({
  onTranscribed,
  darkTheme = false,
}) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setTranscribing(true);
        try {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = String(reader.result || '');
              const base64 = res.split(',')[1] || '';
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const response = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: blob.type || 'audio/webm',
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Transcription failed');
          }
          if (data.text) {
            onTranscribed(data.text.trim());
          }
        } catch (err: unknown) {
          setErrorMsg(err instanceof Error ? err.message : 'Transcription error');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setErrorMsg('Microphone permission is required for voice dictation.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={transcribing}
        className={`inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          recording
            ? 'bg-red-600 text-white hover:bg-red-700'
            : darkTheme
            ? 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'
            : 'bg-slate-100 text-[#111827] hover:bg-slate-200 border border-slate-300'
        }`}
      >
        {transcribing ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
        ) : recording ? (
          <Square className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4 text-[#2563EB]" />
        )}
        <span>
          {transcribing
            ? 'Transcribing Voice...'
            : recording
            ? 'Stop Dictation'
            : 'Dictate by Voice'}
        </span>
      </button>
      {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
    </div>
  );
};

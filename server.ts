import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel } from '@google/genai';
import {
  AuthSession,
  authenticateUserRequest,
  isSessionValid,
} from './src/security/authEngine';

dotenv.config();

const PORT = 3000;
const activeServerSessions = new Map<string, AuthSession>();

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Security headers middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Increase JSON limit for base64 audio/video/image uploads
  app.use(express.json({ limit: '35mb' }));

  // 0. Server-Side Authentication & Session Management Endpoints
  app.post('/api/auth/login', (req, res) => {
    try {
      const { role, identifier, password, provisionedStudents, provisionedWorkers } = req.body;
      const result = authenticateUserRequest({
        role,
        identifier: String(identifier || ''),
        password: String(password || ''),
        provisionedStudents: Array.isArray(provisionedStudents) ? provisionedStudents : [],
        provisionedWorkers: Array.isArray(provisionedWorkers) ? provisionedWorkers : [],
      });

      if (!result.success || !result.session) {
        res.status(401).json({ success: false, error: result.error || 'Authentication failed.' });
        return;
      }

      activeServerSessions.set(result.session.token, result.session);
      res.json({ success: true, session: result.session });
    } catch {
      res.status(500).json({ success: false, error: 'Authentication service error.' });
    }
  });

  app.post('/api/auth/verify-session', (req, res) => {
    const { session } = req.body;
    if (!session || !isSessionValid(session)) {
      res.status(401).json({ valid: false, error: 'Session expired or invalid.' });
      return;
    }
    res.json({ valid: true, session });
  });

  app.post('/api/auth/logout', (req, res) => {
    const { token } = req.body;
    if (typeof token === 'string') {
      activeServerSessions.delete(token);
    }
    res.json({ success: true });
  });

  // 1. Multi-Turn Chatbot Endpoint (Fast / Standard / High Thinking)
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, mode = 'general', roleTitle = 'Workforce Participant' } = req.body;
      const ai = getGenAIClient();

      const systemInstruction = `You are the ShiftSync AI Transparency Advisor assisting a ${roleTitle}. Provide concise, actionable, plain-language guidance on shift schedules, overtime calculations, OSHA workplace safety standards, academic attendance policies, and skill passport verification. Never use markdown tables wider than 3 columns.`;

      const contents = Array.isArray(messages)
        ? messages.map((m: { role: string; text: string }) => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.text }],
          }))
        : [{ role: 'user', parts: [{ text: String(messages || 'Hello') }] }];

      let selectedModel = 'gemini-3.8-flash';
      const config: Record<string, unknown> = {
        systemInstruction,
      };

      if (mode === 'fast') {
        selectedModel = 'gemini-3.1-flash-lite';
      } else if (mode === 'thinking') {
        selectedModel = 'gemini-4-argon';
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }

      try {
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents,
          config,
        });
        res.json({
          text: response.text || 'No response generated.',
          modelUsed: selectedModel,
        });
      } catch (innerErr: unknown) {
        // Graceful fallback if gemini-4-argon requires a paid key not configured
        if (selectedModel === 'gemini-4-argon') {
          const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            },
          });
          res.json({
            text: fallbackResponse.text || 'No response generated.',
            modelUsed: 'gemini-3.8-flash (High Thinking)',
          });
          return;
        }
        throw innerErr;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate chat response.';
      res.status(500).json({ error: message });
    }
  });

  // 2. Text-to-Speech (TTS) Endpoint using gemini-3.8-flash-tts
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const { text, dualSpeaker = false } = req.body;
      const ai = getGenAIClient();

      if (dualSpeaker) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Supervisor: ${text}`,
                  // @ts-ignore
                  speechMetadata: {
                    speaker: 'Supervisor',
                    style: 'Calm, clear safety supervisor',
                  },
                },
                {
                  text: 'Coordinator: Copy that, |yeah| all shift teams have been notified and the log is updated.',
                  // @ts-ignore
                  speechMetadata: {
                    speaker: 'Coordinator',
                    style: 'Articulate, supportive operations coordinator',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: 'Supervisor',
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                  },
                  {
                    speaker: 'Coordinator',
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
                  },
                ],
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          res.status(500).json({ error: 'No audio returned from gemini-3.8-flash-tts.' });
          return;
        }
        res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: String(text || 'ShiftSync AI briefing ready.'),
                // @ts-ignore
                speechMetadata: {
                  style: 'Clear, warm, accessible briefing announcer',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(500).json({ error: 'No audio data returned.' });
        return;
      }

      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'TTS generation failed.';
      res.status(500).json({ error: message });
    }
  });

  // 3. Audio Transcription Endpoint using gemini-3.5-transcribe
  app.post('/api/ai/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body;
      if (!audioBase64) {
        res.status(400).json({ error: 'Missing audioBase64 payload.' });
        return;
      }

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this spoken workplace safety or campus report accurately into clean plain text.',
            },
          ],
        },
      });

      res.json({ text: response.text || '' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Audio transcription failed.';
      res.status(500).json({ error: message });
    }
  });

  // 4. Google Search Grounding Endpoint using gemini-3.8-flash
  app.post('/api/ai/search', async (req, res) => {
    try {
      const { query } = req.body;
      const ai = getGenAIClient();

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: String(query || 'Latest OSHA construction safety standards and labor overtime guidelines'),
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .map((c: { web?: { uri?: string; title?: string } }) =>
          c.web?.uri ? { title: c.web.title || c.web.uri, uri: c.web.uri } : null
        )
        .filter(Boolean);

      res.json({
        text: response.text || 'No grounded search results found.',
        sources,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google Search grounding failed.';
      res.status(500).json({ error: message });
    }
  });

  // 5. Google Maps Grounding Endpoint using gemini-3.8-flash
  app.post('/api/ai/maps', async (req, res) => {
    try {
      const { query, latitude, longitude } = req.body;
      const ai = getGenAIClient();

      const config: Record<string, unknown> = {
        tools: [{ googleMaps: {} }],
      };

      if (typeof latitude === 'number' && typeof longitude === 'number') {
        config.toolConfig = {
          retrievalConfig: {
            latLng: { latitude, longitude },
          },
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: String(query || 'Occupational health clinics and safety equipment centers near downtown'),
        config,
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const places = chunks
        .map((c: { maps?: { uri?: string; title?: string }; web?: { uri?: string; title?: string } }) => {
          if (c.maps?.uri) return { title: c.maps.title || 'View on Google Maps', uri: c.maps.uri };
          if (c.web?.uri) return { title: c.web.title || c.web.uri, uri: c.web.uri };
          return null;
        })
        .filter(Boolean);

      res.json({
        text: response.text || 'No nearby locations returned.',
        places,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google Maps grounding failed.';
      res.status(500).json({ error: message });
    }
  });

  // 6. Image Generation Endpoint (gemini-3-pro-image-preview & gemini-nano-banana-2.1)
  app.post('/api/ai/image', async (req, res) => {
    try {
      const {
        prompt,
        aspectRatio = '16:9',
        imageSize = '1K',
        model = 'gemini-3-pro-image-preview',
      } = req.body;

      const ai = getGenAIClient();
      const targetModel =
        model === 'gemini-nano-banana-2.1' ? 'gemini-nano-banana-2.1' : 'gemini-3-pro-image-preview';

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: {
          parts: [
            {
              text: String(
                prompt ||
                  'Clean architectural safety diagram showing proper scaffolding guardrails and PPE on a modern construction site'
              ),
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      let imageUrl = '';
      let caption = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          caption += part.text;
        }
      }

      if (!imageUrl) {
        res.status(500).json({
          error:
            'Image generation requires a billing-enabled API key in Settings > Secrets > GEMINI_API_KEY.',
        });
        return;
      }

      res.json({ imageUrl, text: caption, modelUsed: targetModel });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Image generation failed. Please check your GEMINI_API_KEY in Settings > Secrets.';
      res.status(500).json({ error: message });
    }
  });

  // 7. Video Generation Endpoint using gemini-omni-1.1-flash via Interactions API
  app.post('/api/ai/video-generate', async (req, res) => {
    try {
      const { prompt, aspectRatio = '16:9' } = req.body;
      const ai = getGenAIClient();
      const validRatio = aspectRatio === '9:16' ? '9:16' : '16:9';

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.1-flash',
          input: String(
            prompt ||
              'A clear instructional walkthrough of a well-organized construction site with workers wearing high-visibility vests and hard hats.'
          ),
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validRatio,
            duration: '5s',
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (!videoPart || !videoPart.data) {
        res.status(500).json({
          error:
            'Video generation returned no video payload. Ensure a paid API key is selected in Settings > Secrets.',
        });
        return;
      }

      const mimeType = videoPart.mime_type || 'video/mp4';
      res.json({
        videoUrl: `data:${mimeType};base64,${videoPart.data}`,
        mimeType,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Video generation with gemini-omni-1.1-flash failed.';
      res.status(500).json({ error: message });
    }
  });

  // 8. Video Content Analysis Endpoint using gemini-4-argon
  app.post('/api/ai/video-analyze', async (req, res) => {
    try {
      const { videoBase64, mimeType = 'video/mp4', prompt } = req.body;
      if (!videoBase64) {
        res.status(400).json({ error: 'Please select a video file to analyze.' });
        return;
      }

      const ai = getGenAIClient();
      const analysisPrompt =
        prompt ||
        'Analyze this site or campus video for safety hazards, PPE compliance, attendance verification, and key operational observations. Provide structured bullet points with timestamps.';

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-argon',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: videoBase64,
                },
              },
              {
                text: analysisPrompt,
              },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          },
        });
        res.json({ text: response.text || 'Analysis complete.', modelUsed: 'gemini-4-argon' });
      } catch {
        const fallback = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: videoBase64,
                },
              },
              {
                text: analysisPrompt,
              },
            ],
          },
        });
        res.json({ text: fallback.text || 'Analysis complete.', modelUsed: 'gemini-3.8-flash' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Video analysis failed.';
      res.status(500).json({ error: message });
    }
  });

  // 9. WebSocket Server for Real-Time Voice Conversations (gemini-3.8-live)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs) => {
    const ai = getGenAIClient();
    let sessionPromise: ReturnType<typeof ai.live.connect> | null = null;

    try {
      sessionPromise = ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction:
            'You are the ShiftSync AI Live Voice Coordinator. Speak concisely and warmly to help construction workers, college students, and administrators check shift hours, report hazards hands-free, or verify skill passport requirements.',
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.outputTranscription?.text && clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({
                  outputTranscript: message.serverContent.outputTranscription.text,
                })
              );
            }
            if (message.serverContent?.inputTranscription?.text && clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({
                  inputTranscript: message.serverContent.inputTranscription.text,
                })
              );
            }
            if (message.serverContent?.interrupted && clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err: unknown) => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({
                  error: err instanceof Error ? err.message : 'Live voice session error',
                })
              );
            }
          },
        },
      });

      const session = await sessionPromise;

      clientWs.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (parsed.text) {
            session.sendRealtimeInput({
              text: String(parsed.text),
            });
          }
        } catch {
          // ignore malformed packet
        }
      });

      clientWs.on('close', () => {
        try {
          session.close();
        } catch {
          // ignore close errors
        }
      });
    } catch (err: unknown) {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: err instanceof Error ? err.message : 'Failed to initialize Gemini Live session',
          })
        );
      }
    }
  });

  // Mount Vite or Static Build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ShiftSync AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

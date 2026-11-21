# OtherSide

A youth-focused civil discourse demo. Type an opinion and hear it argued from
**both sides** in two voices — ElevenLabs AI voices when a key is configured,
browser voices in demo mode. The goal is not to pick a winner, but to practise
listening and respectful disagreement.

Built with React + Vite + Tailwind CSS + Framer Motion. A tiny Vite dev
middleware keeps the ElevenLabs API key on the server. No key needed for the
core demo: curated arguments and browser voices keep it working without an API
key (offline speech depends on the voices installed on the demo machine).

The interface is fully multilingual: **English, French, German, Spanish,
Mandarin, Japanese, and Indonesian**. Switching language changes the UI copy,
the topic suggestions, and the argument paragraphs that match the speech.

## Quick start

```bash
npm install
npm run dev
```

Requires Node 20.19+ or 22.12+ (Vite 7). Check with `node -v` on the demo
machine before presenting. Open the URL Vite prints (usually
<http://localhost:5173>). That's it — the app works without any API key.

Optional: copy `.env.example` to `.env` and add your key to hear real
ElevenLabs voices.

## What's in the demo

- **Two reliable voices.** Side A is warm orange, Side B is cool blue. Each
  card plays its own long, information-dense paragraph; the spoken words and
  the words on screen are the same.
- **Play whole debate.** One button plays A, then B, with a visible waveform
  progress bar and a sticky mini player while audio is active.
- **Voice preview.** Hear a short neutral sentence before choosing a voice.
- **Flip perspective.** Swaps which side each voice argues and replays Voice A.
  A short reflection prompt appears afterwards and is remembered privately on
  the device.
- **Common ground strip.** Every debate ends with what both sides share before
  showing the disagreement.
- **Focus mode.** Hides everything except the debate for a clean stage view.
  Press <kbd>Esc</kbd> to exit.
- **Reshuffle topics.** Gets a fresh set of suggested topics without reloading.
- **Curated first, optional AI.** All 18 curated topics work offline. Add an
  `OPENAI_API_KEY` for custom-topic generation; the curated copy always remains
  the fallback.
- **Saved debates.** Store up to 20 debates in `localStorage` and load them
  again later.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| <kbd>Space</kbd> | Play/pause Voice A |
| <kbd>B</kbd> | Play/pause Voice B |
| <kbd>F</kbd> | Flip perspective |
| <kbd>Esc</kbd> | Exit focus mode |

Shortcuts are ignored while typing in an input, textarea, select, or editable
element.

### Languages

Use the language selector in the header. The choice is saved under
`otherside.language.v1` and restored on the next visit. Curated topics have
hand-written translations for all seven languages; custom topics use translated
templates. The original English wording is kept with each debate, so switching
back to English restores the exact source copy. Browser voices are matched to
the selected language where possible, and Mandarin/Japanese speech is chunked
by character so it does not cut off.

## How to get an ElevenLabs key

1. Create a free account at <https://elevenlabs.io>.
2. Open your profile menu → **Subscription** / **API Keys** and copy your key.
3. In this project, copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

4. Paste the key into `.env`:

   ```env
   ELEVENLABS_API_KEY=your_key_here
   ```

5. Restart `npm run dev`. The badge in the header will change to
   **"ElevenLabs voices ready"**.

The key is read only by the Node server (`server/api.js`). It is never bundled
into the browser code, and `.env` is git-ignored.

### Voice settings

The voice picker contains exactly seven fixed ElevenLabs voices. There is no
account voice list, no browser voice list, and no "Automatic" option.

| Voice | Voice ID | Character |
| --- | --- | --- |
| Mike | `cBTYF7NiJbR8Bvmdeuse` | Casual, expressive |
| Jon | `JYUzXNeyCPmymMkfcicu` | Warm storyteller |
| Adam | `QAmlwgbPtjxpk7u98Qs9` | Compelling, deep pitch |
| Nick | `7jynqzOvnVP89nA7TB0m` | Relatable, engaging |
| Mark | `1SM7GgM6IMuvQlz2BwM3` | Friendly, conversational |
| David | `ppLqTilh7rH7fbUVlXsf` | Documentary, authoritative |
| Extra voice | `B9U4Lk9uR0DBeFxDocVd` | Added stage voice |

The stage defaults are **Mike for Side A** and **Jon for Side B**. The server
accepts only these seven IDs; any other value in `.env` or in a request is
ignored. Choices from the dropdown and the voice preview are saved in
`localStorage`. Picking a voice other than the side's default skips the
pre-generated clip fallback so the selected voice is the one you hear.

Without an API key the app still works: browser speech reads the argument in
the selected language. The card heading shows the browser voice actually used,
the source badge says "Browser voice", and the preview button is labeled
"Preview browser voice"; the voice picker selection is kept for when a key is
added. For languages where the browser exposes only one voice, side B uses a
lower pitch and slower rate so the two sides remain distinguishable. Add a key
and the same seven selections are sent to ElevenLabs.

The default model is `eleven_multilingual_v2` because it sounds more natural on
longer arguments in every supported language. If it is slow or unavailable, the
server retries with `eleven_turbo_v2_5` and then the next voice in the fixed
list. Set `ELEVENLABS_MODEL_ID=eleven_v4` for maximum expression, or
`eleven_turbo_v2_5` for the fastest replies.

### Pre-generating fallback clips (recommended for stage)

Once you have a key, run this once before the demo:

```bash
npm run prepare:audio
```

It writes `public/audio/demo-side-a.mp3` and `demo-side-b.mp3` with the two
sides of the default English topic ("School uniforms should be mandatory.").
If the API is slow or offline during the talk, the app plays these local files
for that topic while both voices use their side's default. Even without them, the app
falls back to browser speech synthesis and always shows the full argument on
each card.

### Research-backed LLM arguments

If you set `OPENAI_API_KEY` in `.env`, `/api/generate` uses the OpenAI Responses
API with the `web_search` tool. The model researches the custom topic on the live
web, then writes a neutral description, a full paragraph for each side, and
three developed moves per side — claim, reason, and guardrail/alternative. It is
instructed not to invent facts and to represent genuine disagreement fairly.
The websites it consulted are returned as `sources` and shown as clickable links
under the topic.

The model prefers government, university, public broadcaster, established news,
and reputable nonprofit sites. Any markdown links or bracketed citations inside
the prose are removed before the text reaches the cards or voices, so only the
separate sources strip is clickable.

The model defaults to `gpt-4.1-mini` and can be changed with `OPENAI_MODEL_ID`.
Successful generations are cached by topic and language so a repeated topic does
not spend credits twice. If the key is missing, out of credits, slow (25 second
timeout), or the response is invalid, the app falls back to curated copy. The
18 curated topics are always available and never need a network.

## 60-second demo script

1. **Open the app** — "One opinion. Two sides, out loud." (5 s)
2. **Tap "Reshuffle topics"**, then choose a suggested topic or type your own.
   (5 s)
3. **Click "Generate debate"** — the two cards animate in with the common
   ground strip. (5 s)
4. **Click "Play whole debate"** — Voice A argues, then Voice B. Point at the
   waveform progress and the sticky mini player. (10 s)
5. **Use a voice dropdown and "Preview voice"** to show that either side can
   switch voices. (8 s)
6. **Click "Flip perspective"** — now Voice A argues Con and Voice B argues
   Pro, and Voice A replays. Pick a reflection answer. (12 s)
7. **Switch language in the header** — the UI, suggestions, and both paragraphs
   change, and the voices follow the new locale. (8 s)
8. **Click "Focus mode"**, then "Save debate" and show it in "Saved debates".
   (7 s)

There is deliberately no transcript panel: each card shows one full paragraph
that matches the audio, so the audience can read along without a second wall of
text.

If the network is shaky, say: "We're in demo mode — browser voices keep us
going, and the arguments are always on screen." The curated topics, including
the rotating suggestions, are stored locally, so no live call is needed to
generate them.

## What happens under the hood

| Path | Purpose |
| --- | --- |
| `POST /api/generate` | Body `{ topic, language? }`. Returns `{ topic, description, pro, con, proPoints, conPoints, common?, sources?, source }`. Uses OpenAI web search if configured, otherwise curated or templated arguments. Inline citations are stripped from spoken text; clickable sources are collected separately. Unsafe topics are rejected; requests are rate-limited per IP. |
| `POST /api/tts` | Body `{ text, side, voiceId? }`. Calls ElevenLabs server-side, retries allowed voices/models, streams `audio/mpeg`, and caches by side/voice/model/text so reported voice identity is accurate. Text is capped and requests are rate-limited. |
| `GET /api/voices` | Returns the seven fixed stage voices. |
| `GET /api/health` | Validates the ElevenLabs key and reports the default voices; drives the header badge. |

Audio fallback order in `src/hooks/useVoiceAudio.js`:

1. ElevenLabs via the server proxy (Blob URL).
2. Local pre-generated clip, for the built-in English demo topic while both
   voices use their side's default.
3. Browser `speechSynthesis`, chunked so long arguments are not cut off. CJK
   text is split by character.
4. Text only, with a visible note.

Every card shows its active audio source and the voice actually heard. In demo
mode (no key) the seven-voice picker is a selection for later: the card shows a
note that a browser voice is in use until an ElevenLabs key is added. Source
labels and translated copy come from `src/i18n/`; missing translation keys fall
back to English rather than breaking the UI. A top-level error boundary offers
a restart button if a render fails.

## Project layout

```text
OtherSide/
├── index.html
├── vite.config.js              # React plugin + API middleware
├── server/api.js               # ElevenLabs + optional OpenAI proxy
├── scripts/
│   └── generate-fallback-audio.mjs
├── src/
│   ├── App.jsx                 # state, stage features, i18n wiring, shortcuts
│   ├── index.css
│   ├── data/
│   │   ├── demoTopics.js       # 18 curated topics + template
│   │   ├── elevenVoices.js     # the seven fixed stage voices
│   │   ├── languages.js
│   │   ├── topicSafety.js      # school-appropriate topic guardrail
│   │   └── translations/       # fr, de, es, zh, ja, id
│   ├── i18n/
│   │   ├── strings.js          # English source UI strings
│   │   ├── translations.js     # lazy-loaded language bundles
│   │   └── helpers.js          # t(), topic lookup, debate localization
│   ├── hooks/
│   │   ├── useVoiceAudio.js
│   │   └── useVoicePreview.js
│   ├── lib/
│   │   ├── api.js
│   │   └── browserVoices.js
│   └── components/
│       ├── ErrorBoundary.jsx
│       ├── VoiceCard.jsx
│       ├── Waveform.jsx
│       ├── WhyThisMatters.jsx
│       ├── SavedDebates.jsx
│       ├── LanguageSelect.jsx
│       ├── MiniPlayer.jsx
│       └── ReflectionPrompt.jsx
└── public/audio/               # optional pre-generated clips
```

## Build

```bash
npm run build
npm run preview
```

The API middleware runs in both `npm run dev` and `npm run preview`. For a
hosted static build, put `server/api.js` behind any small Node host (or add an
Express wrapper) — the client code does not change.

## Design notes

- Split-screen cards: Side A is warm orange, Side B is cool blue; the prominent
  "Flip perspective" button swaps stances between voices.
- Framer Motion handles entrance animations and presence transitions for new
  debates, the mini player, and the reflection prompt; the waveform is a
  lightweight CSS animation with real progress from audio/speech events.
- Saved debates live in `otherside.debates.v1` (max 20), voice choices in
  `otherside.voices.v1`, language in `otherside.language.v1`, reflections in
  `otherside.reflections.v1`, and suggestion signatures in session storage.
- No accounts, voting, leaderboards, bullet-point arguments, or transcript
  panel. No LLM decides anything about correctness — arguments are presentation
  copy for a discussion demo, not advice or factual claims.

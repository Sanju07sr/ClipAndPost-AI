# ClipForge AI

Paste a YouTube link and get **YouTube Shorts of the video's best moments**: vertical 1080×1920 clips with animated captions, a hook title card, a virality score, and a ready-to-paste title, description and hashtags.

## What it does

1. **Reads the video.** It fetches the title, length and YouTube's captions through `yt-dlp`.
2. **Finds the best moments.** Claude reads the whole transcript and picks self-contained moments with a strong hook and a payoff. Each one gets a virality score, a title, an on-screen hook, a description and hashtags. Cuts are snapped to sentence boundaries, so a clip never starts or ends mid-word.
3. **Downloads only what's needed.** It fetches just the clip sections, not the whole video, so long podcasts process quickly.
4. **Reframes to 9:16.**
   - **Fill:** crops to vertical. With *AI speaker framing* on, Claude looks at frames from the clip and centres the crop on the person talking.
   - **Fit:** keeps the full frame over a blurred, darkened copy of the video.
5. **Adds captions and polish.**
   - Word-by-word captions in three styles: *Bold pop*, *Karaoke* and *Minimal*.
   - A hook title card for the first three seconds.
   - Audio loudness normalised to −14 LUFS.
   - H.264/AAC MP4 with fast-start.

6. **Publishes to YouTube (optional).** Connect your channel and select Shorts. For each one, the site:
   - looks up which hashtags the most-viewed Shorts on that topic used in the last two weeks, using YouTube's own search data
   - has Claude write the title and description, and pick hashtags that fit the clip
   - lets you review and edit everything, then uploads with one click

**Make it yours** (all under *Customize*):
- **Seven caption styles:** Bold pop, Karaoke, Neon glow, Word reveal, One word, Comic and Minimal. Pick any highlight colour, and put captions in the lower third or the middle.
- **Colour looks:** Vivid, Warm, Cool, B&W or Cinematic.
- **Motion and branding:** a slow zoom-in, a progress bar, your @handle on screen, and an end card such as "Follow for more".
- **Your avatar** as a round badge in a corner. Upload a photo and choose:
  - *AI illustrated:* Claude draws a flat-vector avatar of you.
  - *Cartoon:* a comic filter that works without an API key.
  - *Photo:* your photo, framed.

  Photos are processed and stored on your computer. The AI style sends the photo to Claude once.

These options make your Shorts recognisably yours. They don't change who owns the footage: only clip videos you own or have permission to reuse.

You can also tell the AI what to look for, for example "funny moments only" or "the best tips".

**Without an `ANTHROPIC_API_KEY` the app still works.** A built-in picker scores moments by speech density, hook words, questions and audio energy, and crops to the centre.

## Run it locally

Requirements:
- **Node.js 20+**
- **ffmpeg** with libass, which draws the captions. On a Mac, Homebrew's default ffmpeg may leave it out. If `npm run doctor` shows a ✘ for captions, install the full build instead:
  ```bash
  brew tap homebrew-ffmpeg/ffmpeg && brew install homebrew-ffmpeg/ffmpeg/ffmpeg
  ```
- **yt-dlp**
- **deno** (recommended: yt-dlp uses it to read YouTube's player)

```bash
# macOS
brew install ffmpeg yt-dlp deno

# Ubuntu / Debian
sudo apt install ffmpeg && pip install -U "yt-dlp[default]"
curl -fsSL https://deno.land/install.sh | sh

# Windows (winget)
winget install Gyan.FFmpeg yt-dlp.yt-dlp DenoLand.Deno
```

Then:

```bash
npm install
npm run doctor                  # checks every tool is installed
npm run dev                     # http://localhost:3000
```

For production use `npm run build && npm start`, or Docker:

```bash
docker build -t clipforge .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... -v clipforge-data:/data clipforge
```

## Configuration

The easiest way to add your API keys is the **Settings** page in the website (gear icon, top right). Keys are checked before they're saved and are stored only on your computer, in `data/settings.json`.

Every setting can also be an environment variable, set in `.env.local`; `.env.example` lists them all. Keys saved on the Settings page take priority. The ones you're most likely to need:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Turns on AI moment picking and AI framing |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Model used for both AI steps |
| `CLAUDE_EFFORT` | `medium` | How hard Claude thinks (`low` … `max`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | none | Turns on YouTube publishing (see below) |
| `YTDLP_COOKIES` | none | Path to a `cookies.txt`, for when YouTube asks the server to sign in |
| `DATA_DIR` | `./data` | Where jobs and rendered clips are stored |
| `MAX_CONCURRENT_JOBS` | `1` | Videos processed at the same time |
| `FULL_DOWNLOAD` | `0` | Set to `1` to download whole videos instead of clip sections |

### Publishing to YouTube

One-time setup, about 5 minutes:

1. In [Google Cloud Console](https://console.cloud.google.com/projectcreate), create a project.
2. Enable the **YouTube Data API v3** for it.
3. Under **Google Auth Platform**, set up the consent screen as *External* and add your Google account as a *Test user*.
4. Create an **OAuth client** of type *Web application*. Add `http://localhost:3000/api/youtube/callback` as an authorised redirect URI.
5. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` and restart the site.
6. On any finished video, click **Connect YouTube**.

YouTube limits that apply to every app:

- **Uploads are private until your project is audited.** YouTube forces uploads from new Google Cloud projects to *private*. Fill in YouTube's [API audit form](https://support.google.com/youtube/contact/yt_api_form) to lift this; after approval, uploads go public instantly. Until then, the site shows "Uploaded as private" and you can make videos public in YouTube Studio.
- **Quota:** each project gets 10,000 API units a day. An upload costs about 1,600 units and a trending-hashtag lookup about 100, so roughly 5–6 Shorts a day unless you request more quota.
- **Reconnecting:** while the consent screen is in *Testing* mode, Google expires the sign-in after 7 days and you reconnect. Publishing the consent screen to *Production* removes this.

### "Sign in to confirm you're not a bot"

YouTube often blocks downloads from cloud servers.
1. Export your browser's YouTube cookies to a `cookies.txt` file, using a "Get cookies.txt" browser extension.
2. Set `YTDLP_COOKIES=./cookies.txt`.
3. Keep `yt-dlp` up to date (`yt-dlp -U` or `pip install -U yt-dlp`); YouTube changes often.

## How it's built

- **Next.js** (App Router) and **Tailwind CSS** for the site and API.
- **Processing** runs in the Node server as a background queue. Jobs are saved to `DATA_DIR/jobs/<id>/job.json`, and the page polls for progress.
- **Claude** is called through the official `@anthropic-ai/sdk` with structured outputs, so its answers are always valid JSON. Server-side fallback is on, so a declined request is retried on a fallback model instead of failing the job.

| Path | What's in it |
|---|---|
| `lib/pipeline.ts` | The five processing stages and the job queue |
| `lib/youtube.ts` | yt-dlp: metadata, captions, section downloads |
| `lib/transcript.ts` | Parses YouTube's json3 captions into timed words |
| `lib/ai.ts` | Claude: moment picking, speaker framing, Shorts metadata |
| `lib/google.ts` | Google OAuth: connect, refresh, disconnect a YouTube channel |
| `lib/publish.ts` | Trending hashtags, metadata, resumable YouTube uploads |
| `lib/moments.ts` | Built-in picker, sentence snapping, overlap removal |
| `lib/captions.ts` | Animated ASS caption files |
| `lib/media.ts` | ffmpeg: reframing, rendering, thumbnails, loudness |
| `app/api/*` | REST API: create jobs, poll status, stream clips |
| `components/*` | UI |

### API

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/jobs` | Starts a job. Body: `{ url, clipCount?, minDuration?, maxDuration?, layout?, aiFraming?, captionStyle?, hookOverlay?, instructions? }`. Returns `{ id }`. |
| `GET` | `/api/jobs/:id` | Job status, progress and clips |
| `GET` | `/api/jobs/:id/clips/:clipId` | The MP4, with seeking support. Add `?download=1` to download it. |
| `DELETE` | `/api/jobs/:id` | Deletes a finished job and its files |
| `POST` | `/api/jobs/:id/clips/:clipId/metadata` | Writes a YouTube title, description and trending hashtags for a clip |
| `POST` | `/api/jobs/:id/publish` | Uploads clips. Body: `{ items: [{ clipId, title, description, hashtags, privacy }] }` |
| `GET` | `/api/youtube/connect` · `/api/youtube/status` | Connect a channel, or check the connection |

## Please note

Only clip videos you own or have permission to reuse. Downloading YouTube content may be restricted by YouTube's Terms of Service.

// Shared types used by the server pipeline and the browser UI.

export type Layout = "fill" | "fit";
export type CaptionStyle = "bold" | "karaoke" | "minimal" | "none";

export interface JobOptions {
  url: string;
  /** How many clips to produce (1-10). */
  clipCount: number;
  /** Shortest clip length in seconds. */
  minDuration: number;
  /** Longest clip length in seconds (YouTube Shorts allows up to 180s). */
  maxDuration: number;
  /** fill = crop to 9:16, fit = whole frame over a blurred background. */
  layout: Layout;
  /** Let Claude look at frames to decide where to crop (fill layout only). */
  aiFraming: boolean;
  captionStyle: CaptionStyle;
  /** Show the clip's hook as a title card for the first seconds. */
  hookOverlay: boolean;
  /** Optional free-text guidance, e.g. "funny moments only". */
  instructions?: string;
}

export type StageId = "metadata" | "transcript" | "moments" | "download" | "render";
export type StageStatus = "pending" | "running" | "done" | "skipped" | "error";

export interface Stage {
  id: StageId;
  label: string;
  status: StageStatus;
  detail?: string;
}

export type JobStatus = "queued" | "running" | "done" | "error";

export interface VideoInfo {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail?: string;
  webpageUrl: string;
  language?: string;
}

export interface ClipPlan {
  start: number;
  end: number;
  title: string;
  hook: string;
  reason: string;
  description: string;
  hashtags: string[];
  /** 0-100 estimate of how well the moment works as a Short. */
  score: number;
}

export type ClipStatus = "pending" | "downloading" | "rendering" | "done" | "error";

export type Privacy = "public" | "unlisted" | "private";

/** Metadata prepared for publishing a clip to YouTube. */
export interface PublishMeta {
  title: string;
  description: string;
  /** Hashtags without the # sign, most important first. */
  hashtags: string[];
  /** Hashtags popular on recent top Shorts about this topic, most popular first. */
  trending: string[];
  /** "youtube" when trending data came from YouTube search, else "none". */
  trendingSource: "youtube" | "none";
  writer: "claude" | "basic";
}

export interface ClipUpload {
  status: "queued" | "uploading" | "published" | "error";
  progress: number;
  privacy: Privacy;
  title: string;
  videoId?: string;
  url?: string;
  /** Privacy YouTube actually applied (can differ: unverified apps are forced to private). */
  actualPrivacy?: string;
  error?: string;
  publishedAt?: string;
}

export interface Clip extends ClipPlan {
  meta?: PublishMeta;
  upload?: ClipUpload;
  id: string;
  index: number;
  status: ClipStatus;
  error?: string;
  /** Horizontal crop focus from 0 (left) to 1 (right). */
  focusX?: number;
  file?: string;
  thumb?: string;
  sizeBytes?: number;
}

export interface Job {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  options: JobOptions;
  stages: Stage[];
  progress: number;
  message: string;
  error?: string;
  video?: VideoInfo;
  /** How the moments were chosen. */
  picker?: "claude" | "heuristic";
  hasTranscript?: boolean;
  clips: Clip[];
  log: string[];
  /** Non-fatal problems to show in the UI, e.g. "captions-unavailable". */
  warnings?: string[];
}

export const DEFAULT_OPTIONS: Omit<JobOptions, "url"> = {
  clipCount: 5,
  minDuration: 20,
  maxDuration: 60,
  layout: "fill",
  aiFraming: true,
  captionStyle: "bold",
  hookOverlay: true,
  instructions: "",
};

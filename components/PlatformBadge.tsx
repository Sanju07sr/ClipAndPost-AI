import { Camera, Play, ThumbsUp } from "lucide-react";
import type { PlatformId } from "@/lib/types";

const STYLE: Record<PlatformId, { bg: string; icon: typeof Play }> = {
  youtube: { bg: "bg-[#ff0033]", icon: Play },
  instagram: { bg: "bg-[linear-gradient(45deg,#f58529,#dd2a7b_55%,#8134af)]", icon: Camera },
  facebook: { bg: "bg-[#1877f2]", icon: ThumbsUp },
};

/** Small square mark in each platform's colour. */
export function PlatformBadge({ platform, size = "md" }: { platform: PlatformId; size?: "sm" | "md" | "lg" }) {
  const s = STYLE[platform];
  const box = size === "sm" ? "h-6 w-6 rounded-md" : size === "lg" ? "h-11 w-11 rounded-xl" : "h-8 w-8 rounded-lg";
  const icon = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center text-white ${box} ${s.bg}`}>
      <s.icon className={`${icon} ${platform === "youtube" ? "fill-white" : ""}`} />
    </span>
  );
}

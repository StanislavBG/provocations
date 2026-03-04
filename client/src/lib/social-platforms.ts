/**
 * Social Platform Metadata — Character limits, aspect ratios, and brand colors
 * for each supported social media platform.
 */

export interface SocialPlatformMeta {
  id: string;
  name: string;
  charLimit: number;
  aspectRatio: string;
  brandColor: string;
  /** Lucide icon name */
  iconName: string;
}

export const SOCIAL_PLATFORMS: Record<string, SocialPlatformMeta> = {
  x: {
    id: "x",
    name: "X (Twitter)",
    charLimit: 280,
    aspectRatio: "16:9",
    brandColor: "#000000",
    iconName: "Twitter",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    charLimit: 3000,
    aspectRatio: "16:9",
    brandColor: "#0A66C2",
    iconName: "Linkedin",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    charLimit: 63206,
    aspectRatio: "16:9",
    brandColor: "#1877F2",
    iconName: "Facebook",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    charLimit: 2200,
    aspectRatio: "1:1",
    brandColor: "#E4405F",
    iconName: "Instagram",
  },
  reddit: {
    id: "reddit",
    name: "Reddit",
    charLimit: 40000,
    aspectRatio: "16:9",
    brandColor: "#FF4500",
    iconName: "MessageSquare",
  },
};

export const PLATFORM_IDS = Object.keys(SOCIAL_PLATFORMS);

export type PlatformId = keyof typeof SOCIAL_PLATFORMS;

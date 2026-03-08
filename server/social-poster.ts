/**
 * Social Poster — Platform-specific posting functions.
 * Each function takes an access token and content, posts to the platform API,
 * and returns a standardized result.
 */

export interface PostResult {
  success: boolean;
  externalPostId?: string;
  externalPostUrl?: string;
  error?: string;
}

// In-memory rate limit tracker (per platform, resets hourly)
const rateLimits: Record<string, { count: number; resetAt: number }> = {};

function checkRateLimit(platform: string, maxPerHour: number): boolean {
  const now = Date.now();
  const entry = rateLimits[platform];
  if (!entry || now > entry.resetAt) {
    rateLimits[platform] = { count: 1, resetAt: now + 3600_000 };
    return true;
  }
  if (entry.count >= maxPerHour) return false;
  entry.count++;
  return true;
}

/**
 * Post to X (Twitter) using API v2.
 * If replyToId is provided, creates a reply to that tweet.
 */
export async function postToX(token: string, text: string, _imageBase64?: string, replyToId?: string): Promise<PostResult> {
  if (!checkRateLimit("x", 50)) {
    return { success: false, error: "Rate limited — try again later" };
  }
  try {
    const body: Record<string, unknown> = { text };
    if (replyToId) {
      body.reply = { in_reply_to_tweet_id: replyToId };
    }
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `X API error (${res.status}): ${err}` };
    }
    const data = (await res.json()) as { data?: { id?: string } };
    return {
      success: true,
      externalPostId: data.data?.id,
      externalPostUrl: data.data?.id ? `https://x.com/i/status/${data.data.id}` : undefined,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Post to LinkedIn using UGC Posts API.
 */
export async function postToLinkedIn(token: string, text: string, _imageBase64?: string): Promise<PostResult> {
  if (!checkRateLimit("linkedin", 30)) {
    return { success: false, error: "Rate limited — try again later" };
  }
  try {
    // First get the user's person URN
    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!meRes.ok) return { success: false, error: "Failed to get LinkedIn profile" };
    const me = (await meRes.json()) as { sub?: string };
    const personUrn = `urn:li:person:${me.sub}`;

    const body = {
      author: personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `LinkedIn API error (${res.status}): ${err}` };
    }

    const postId = res.headers.get("x-restli-id") || "unknown";
    return {
      success: true,
      externalPostId: postId,
      externalPostUrl: `https://www.linkedin.com/feed/update/${postId}`,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Post to Facebook via Graph API (page post).
 */
export async function postToFacebook(token: string, text: string, _imageBase64?: string): Promise<PostResult> {
  if (!checkRateLimit("facebook", 25)) {
    return { success: false, error: "Rate limited — try again later" };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        access_token: token,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Facebook API error (${res.status}): ${err}` };
    }

    const data = (await res.json()) as { id?: string };
    return {
      success: true,
      externalPostId: data.id,
      externalPostUrl: data.id ? `https://www.facebook.com/${data.id}` : undefined,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Post to Instagram via Graph API (content publish).
 * Note: Instagram requires a two-step process (create container → publish).
 * Text-only posts are not supported — Instagram requires an image.
 */
export async function postToInstagram(token: string, text: string, imageUrl?: string): Promise<PostResult> {
  if (!checkRateLimit("instagram", 25)) {
    return { success: false, error: "Rate limited — try again later" };
  }
  if (!imageUrl) {
    return { success: false, error: "Instagram requires an image — enable 'Generate Images' on the Social Post node" };
  }
  try {
    // Step 1: Create media container
    const containerRes = await fetch(`https://graph.facebook.com/v18.0/me/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: text,
        access_token: token,
      }),
    });
    if (!containerRes.ok) {
      const err = await containerRes.text();
      return { success: false, error: `Instagram container error (${containerRes.status}): ${err}` };
    }
    const container = (await containerRes.json()) as { id?: string };
    if (!container.id) return { success: false, error: "Failed to create Instagram media container" };

    // Step 2: Publish
    const publishRes = await fetch(`https://graph.facebook.com/v18.0/me/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: token,
      }),
    });
    if (!publishRes.ok) {
      const err = await publishRes.text();
      return { success: false, error: `Instagram publish error (${publishRes.status}): ${err}` };
    }

    const data = (await publishRes.json()) as { id?: string };
    return {
      success: true,
      externalPostId: data.id,
      externalPostUrl: data.id ? `https://www.instagram.com/p/${data.id}` : undefined,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Post to Reddit via submit API.
 */
export async function postToReddit(
  token: string,
  text: string,
  title?: string,
  subreddit?: string,
  _imageBase64?: string,
): Promise<PostResult> {
  if (!checkRateLimit("reddit", 30)) {
    return { success: false, error: "Rate limited — try again later" };
  }
  try {
    const sr = subreddit || "test";
    const postTitle = title || text.slice(0, 100);

    const body = new URLSearchParams({
      sr,
      kind: "self",
      title: postTitle,
      text,
    });

    const res = await fetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Provocations/1.0",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Reddit API error (${res.status}): ${err}` };
    }

    const data = (await res.json()) as { json?: { data?: { id?: string; url?: string } } };
    return {
      success: true,
      externalPostId: data.json?.data?.id,
      externalPostUrl: data.json?.data?.url,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Comment on a Reddit post or reply to a comment.
 * parentFullname is the thing_id (e.g. "t3_abc123" for a post, "t1_def456" for a comment).
 */
export async function commentOnReddit(
  token: string,
  parentFullname: string,
  text: string,
): Promise<PostResult> {
  if (!checkRateLimit("reddit", 30)) {
    return { success: false, error: "Rate limited — try again later" };
  }
  try {
    const body = new URLSearchParams({
      thing_id: parentFullname,
      text,
    });

    const res = await fetch("https://oauth.reddit.com/api/comment", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Provocations/1.0",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Reddit comment error (${res.status}): ${err}` };
    }

    const data = (await res.json()) as { json?: { data?: { things?: Array<{ data?: { id?: string; name?: string } }> } } };
    const commentId = data.json?.data?.things?.[0]?.data?.id;
    return {
      success: true,
      externalPostId: commentId,
      externalPostUrl: commentId ? `https://www.reddit.com/comments/${parentFullname.replace("t3_", "")}/_/${commentId}` : undefined,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Route to the correct platform poster.
 * Options allow specifying reply targets for comment/reply workflows.
 */
export async function postToPlatform(
  platform: string,
  token: string,
  text: string,
  imageBase64?: string,
  options?: { replyToId?: string; subreddit?: string; title?: string; parentFullname?: string },
): Promise<PostResult> {
  switch (platform) {
    case "x": return postToX(token, text, imageBase64, options?.replyToId);
    case "linkedin": return postToLinkedIn(token, text, imageBase64);
    case "facebook": return postToFacebook(token, text, imageBase64);
    case "instagram": return postToInstagram(token, text, imageBase64);
    case "reddit":
      if (options?.parentFullname) {
        return commentOnReddit(token, options.parentFullname, text);
      }
      return postToReddit(token, text, options?.title, options?.subreddit);
    default: return { success: false, error: `Unsupported platform: ${platform}` };
  }
}

/**
 * "blog" Edge Function for sanskarIN.github.io. See README.md → "Accounts".
 *
 * The account pages (assets/js/account.js) call it with the signed-in
 * person's session token:
 *
 *   { "action": "submit", "post": { ... }, "id"?: "<submission id>" }
 *       Sends a new post, or changes to one, for review. The post becomes
 *       (or updates) a GitHub issue, and the publishing workflow takes it from
 *       there, exactly like a post written on GitHub. Changes are always
 *       reviewed again.
 *   { "action": "list" }
 *       The person's posts and where each one is in the review.
 *   { "action": "remove", "id": "<submission id>" }
 *       Takes a post off the blog (or withdraws it if it's still waiting).
 *   { "action": "delete-account", "removePosts": true | false }
 *       Deletes the account, its profile and images, and withdraws posts that
 *       are still waiting. With removePosts, published posts are removed too.
 *
 * Secret (Dashboard → Edge Functions → Secrets; the "Set up accounts"
 * workflow sets it from the BLOG_GITHUB_TOKEN repository secret):
 *   GITHUB_TOKEN   a fine-grained GitHub token for this repository with only
 *                  "Issues: Read and write" permission.
 * Optional: SITE_ORIGIN, GITHUB_REPOSITORY, and EXTRA_ORIGINS (comma-separated
 * origins allowed to call the function, for local testing).
 *
 * The "Set up accounts" workflow deploys this file, and deploys it again
 * whenever it changes on main. It has no dependencies, so it can also be
 * pasted into the Dashboard's editor as it is. Keep "Verify JWT" on; the
 * function checks every session itself as well.
 */

const SITE_ORIGIN = setting("SITE_ORIGIN", "https://sanskarin.github.io").replace(/\/$/, "");
const REPOSITORY = setting("GITHUB_REPOSITORY", "sanskarIN/sanskarIN.github.io");
const GITHUB_API = setting("GITHUB_API_URL", "https://api.github.com").replace(/\/$/, "");
const SUPABASE_URL = setting("SUPABASE_URL", "").replace(/\/$/, "");
const BUCKET = "blog-images";

// Keep these in line with _data/blog.yml and the checks in publish_post.py.
const LIMITS = {
  title: 100,
  summary: 200,
  tags: 5,
  tag: 30,
  coverAlt: 250,
  body: 50_000,
  newPostsPerDay: 5,
  requestBytes: 200_000,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATUS_COMMENT = /^<!-- blog-post-status: ([a-z]+) -->/;
const STATUS_BOT = "github-actions[bot]";

class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly details: string[] = []) {
    super(message);
  }
}

type Profile = { id: string; username: string; display_name: string };
type User = { id: string; token: string; profile: Profile | null };
type Post = { title: string; summary: string; tags: string[]; coverUrl: string; coverAlt: string; body: string };
// deno-lint-ignore no-explicit-any
type Json = any;

function setting(name: string, fallback: string): string {
  return Deno.env.get(name) ?? fallback;
}

// -----------------------------------------------------------------------------
// Supabase and GitHub requests
// -----------------------------------------------------------------------------

/** The project's publishable (public) or secret key, new or legacy style. */
function apiKey(kind: "publishable" | "secret"): string {
  const keys = Deno.env.get(kind === "publishable" ? "SUPABASE_PUBLISHABLE_KEYS" : "SUPABASE_SECRET_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      const key = parsed.default ?? Object.values(parsed)[0];
      if (key) return key;
    } catch {
      // Fall back to the single-key variables below.
    }
  }
  const single = Deno.env.get(kind === "publishable" ? "SUPABASE_PUBLISHABLE_KEY" : "SUPABASE_SECRET_KEY") ??
    Deno.env.get(kind === "publishable" ? "SUPABASE_ANON_KEY" : "SUPABASE_SERVICE_ROLE_KEY");
  if (!single) throw new Error(`No Supabase ${kind} key is available to the function.`);
  return single;
}

/** A request to the project's own APIs, as the signed-in person or with the secret key. */
async function supabase(
  path: string,
  options: { method?: string; body?: unknown; token?: string; admin?: boolean; prefer?: string } = {},
): Promise<Json> {
  const key = apiKey(options.admin ? "secret" : "publishable");
  const headers = new Headers({ apikey: key });
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  } else if (!key.startsWith("sb_")) {
    headers.set("Authorization", `Bearer ${key}`); // legacy keys are JWTs
  }
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.prefer) headers.set("Prefer", options.prefer);
  const method = options.method ?? "GET";
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if ((response.status === 401 || response.status === 403) && options.token) {
    throw new HttpError(401, "Your session has ended. Please sign in again.");
  }
  if (!response.ok) {
    throw new Error(`Supabase ${method} ${path.split("?")[0]} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function github(
  path: string,
  options: { method?: string; body?: unknown } = {},
  accept: number[] = [200, 201],
): Promise<Json> {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) throw new Error("The GITHUB_TOKEN secret is not set.");
  const method = options.method ?? "GET";
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "sanskarIN.github.io accounts",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if (!accept.includes(response.status)) {
    throw new Error(`GitHub ${method} ${path.split("?")[0]} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

const issuePath = (number?: number) => `/repos/${REPOSITORY}/issues${number ? `/${number}` : ""}`;

// -----------------------------------------------------------------------------
// Who is calling
// -----------------------------------------------------------------------------

function decodeJwt(token: string): Json {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

async function signedInUser(req: Request): Promise<User> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const claims = decodeJwt(token);
  if (
    !claims || claims.role !== "authenticated" || typeof claims.sub !== "string" || !UUID.test(claims.sub) ||
    typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()
  ) {
    throw new HttpError(401, "Please sign in first.");
  }
  // Reading the profile with the token also has the database check the
  // token's signature, so a made-up token gets no further.
  const rows = await supabase(`/rest/v1/profiles?id=eq.${claims.sub}&select=id,username,display_name`, { token });
  return { id: claims.sub, token, profile: rows[0] ?? null };
}

// -----------------------------------------------------------------------------
// Checking a post
// -----------------------------------------------------------------------------

/** One line of plain text: no control or direction-changing characters, single spaces. */
function cleanLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const imagePrefix = () => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** True for an image this person uploaded with the form. */
function ownImage(url: string, userId: string): boolean {
  const prefix = `${imagePrefix()}${userId}/`;
  return url.startsWith(prefix) && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(url.slice(prefix.length));
}

function checkPost(input: Json, userId: string): Post {
  const problems: string[] = [];
  const title = cleanLine(input?.title);
  if (!title) problems.push("Add a title.");
  else if (title.length > LIMITS.title) problems.push(`Shorten the title to ${LIMITS.title} characters or fewer.`);

  const summary = cleanLine(input?.summary);
  if (summary.length > LIMITS.summary) {
    problems.push(`Shorten the summary to ${LIMITS.summary} characters or fewer.`);
  }

  const rawTags: unknown[] = Array.isArray(input?.tags)
    ? input.tags
    : typeof input?.tags === "string"
    ? input.tags.split(",")
    : [];
  const tags = [...new Set(rawTags.map(cleanLine).filter(Boolean))];
  if (tags.length > LIMITS.tags) problems.push(`Use at most ${LIMITS.tags} tags.`);
  if (tags.some((tag) => tag.length > LIMITS.tag)) problems.push(`Keep each tag to ${LIMITS.tag} characters or fewer.`);

  const coverUrl = typeof input?.coverUrl === "string" ? input.coverUrl.trim() : "";
  if (coverUrl && !ownImage(coverUrl, userId)) problems.push("Upload the cover image with the form.");
  const coverAlt = cleanLine(input?.coverAlt);
  if (coverUrl && !coverAlt) problems.push("Describe the cover image for people who can't see it.");
  if (coverAlt.length > LIMITS.coverAlt) {
    problems.push(`Shorten the cover image description to ${LIMITS.coverAlt} characters or fewer.`);
  }

  const body = typeof input?.body === "string"
    // deno-lint-ignore no-control-regex
    ? input.body.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim()
    : "";
  if (!body) problems.push("Write the post.");
  else if (body.length > LIMITS.body) problems.push(`Shorten the post to ${LIMITS.body.toLocaleString("en")} characters or fewer.`);
  const storageImages: string[] = body.match(new RegExp(`${escapeRegExp(imagePrefix())}[^\\s)"'<>]*`, "g")) ?? [];
  if (storageImages.some((url) => !ownImage(url, userId))) problems.push("Use only images you uploaded yourself.");

  if (input?.confirm !== true) {
    problems.push("Confirm that you wrote the post and have the right to publish its text and images.");
  }
  if (problems.length) throw new HttpError(400, "Please fix the following and send the post again.", problems);
  return { title, summary, tags, coverUrl, coverAlt, body };
}

function base64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The post in the same shape as the "Write a blog post" issue form, plus a
 * marker saying which account wrote it (read by publish_post.py). */
function issueBody(post: Post, profile: Profile): string {
  const marker = base64Url(JSON.stringify({ id: profile.id, username: profile.username, name: profile.display_name }));
  const value = (text: string) => text || "_No response_";
  return [
    `<!-- blog-account: ${marker} -->`,
    "### Summary",
    "",
    value(post.summary),
    "",
    "### Tags",
    "",
    value(post.tags.join(", ")),
    "",
    "### Cover image",
    "",
    post.coverUrl ? `![Cover image](${post.coverUrl})` : "_No response_",
    "",
    "### Cover image description",
    "",
    value(post.coverAlt),
    "",
    "### Post",
    "",
    post.body,
    "",
    "### Confirmation",
    "",
    `- [X] I wrote this post, I have the right to publish its text and images, and I agree to the website's [Terms](${SITE_ORIGIN}/terms/).`,
    "",
    `<sub>Sent from the website by the account "${profile.username}", not a GitHub user. ` +
    "Add the `approved` label to publish it, or close the issue to decline it.</sub>",
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

async function submit(user: User, input: Json) {
  const profile = user.profile;
  if (!profile) throw new HttpError(400, "Create your profile before you write a post.");
  const post = checkPost(input?.post, user.id);

  let row: Json = null;
  if (input?.id !== undefined && input?.id !== null) {
    if (typeof input.id !== "string" || !UUID.test(input.id)) throw new HttpError(404, "That post couldn't be found.");
    row = (await supabase(`/rest/v1/submissions?id=eq.${input.id}&user_id=eq.${user.id}&select=*`, { admin: true }))[0];
    if (!row) throw new HttpError(404, "That post couldn't be found.");
  } else {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const recent = await supabase(
      `/rest/v1/submissions?user_id=eq.${user.id}&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { admin: true },
    );
    if (recent.length >= LIMITS.newPostsPerDay) {
      throw new HttpError(429, `You can send up to ${LIMITS.newPostsPerDay} new posts a day. Please try again tomorrow.`);
    }
  }

  const title = `[Post]: ${post.title}`;
  const body = issueBody(post, profile);
  let issueNumber: number | null = row?.issue_number ?? null;
  if (issueNumber) {
    const issue = await github(issuePath(issueNumber));
    const labels = new Set<string>(issue.labels.map((label: Json) => label.name));
    if (labels.has("unpublish")) {
      throw new HttpError(409, "This post was removed from the blog, so it can't be changed. You can write a new post.");
    }
    if (issue.state === "closed" && !labels.has("published")) {
      throw new HttpError(409, "This post was declined, so it can't be changed. You can write a new post.");
    }
    // Changes are reviewed again: take back the approval before editing.
    if (labels.has("approved")) await github(`${issuePath(issueNumber)}/labels/approved`, { method: "DELETE" }, [200, 404]);
    await github(issuePath(issueNumber), { method: "PATCH", body: { title, body } });
  } else {
    const issue = await github(issuePath(), {
      method: "POST",
      body: { title, body, labels: ["blog-post", "from-website"] },
    });
    issueNumber = issue.number;
  }

  const fields = {
    title: post.title,
    summary: post.summary,
    tags: post.tags,
    cover_url: post.coverUrl,
    cover_alt: post.coverAlt,
    body: post.body,
    issue_number: issueNumber,
  };
  if (row) {
    await supabase(`/rest/v1/submissions?id=eq.${row.id}`, { method: "PATCH", admin: true, body: fields });
  } else {
    row = (await supabase("/rest/v1/submissions", {
      method: "POST",
      admin: true,
      body: { ...fields, user_id: user.id },
      prefer: "return=representation",
    }))[0];
  }
  return { id: row.id, status: "processing" };
}

/** Where a post is in the review, from its GitHub issue and the workflow's comment. */
async function reviewStatus(issueNumber: number | null) {
  if (!issueNumber) return { status: "processing" };
  try {
    const issue = await github(issuePath(issueNumber));
    const labels = new Set<string>(issue.labels.map((label: Json) => label.name));
    const comments: Json[] = await github(`${issuePath(issueNumber)}/comments?per_page=100`);
    const comment = [...comments].reverse()
      .find((c) => c.user?.login === STATUS_BOT && STATUS_COMMENT.test(c.body ?? ""));
    const text: string = comment?.body ?? "";
    const url = text.match(new RegExp(`${escapeRegExp(SITE_ORIGIN)}/blog/[a-z0-9-]+/`))?.[0] ?? null;

    let status = "processing";
    if (labels.has("unpublish")) status = "removed";
    else if (labels.has("needs-changes")) status = "changes";
    else if (labels.has("awaiting-review")) status = labels.has("published") ? "update-waiting" : "waiting";
    else if (labels.has("published")) status = "published";
    else if (issue.state === "closed") status = "declined";
    else if (STATUS_COMMENT.exec(text)?.[1] === "error") status = "error";

    const problems = status === "changes"
      ? text.split("\n").filter((line) => line.startsWith("- ")).map((line) => line.slice(2).trim())
        .slice(0, 20)
      : [];
    return { status, url, problems };
  } catch (error) {
    console.error(`Status of issue ${issueNumber}:`, error instanceof Error ? error.message : error);
    return { status: "unknown" };
  }
}

async function list(user: User) {
  const rows: Json[] = await supabase(
    `/rest/v1/submissions?user_id=eq.${user.id}&select=id,title,issue_number,created_at,updated_at&order=created_at.desc&limit=50`,
    { token: user.token },
  );
  const posts = await Promise.all(rows.map(async (row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(await reviewStatus(row.issue_number)),
  })));
  return { posts };
}

async function remove(user: User, input: Json) {
  if (typeof input?.id !== "string" || !UUID.test(input.id)) throw new HttpError(404, "That post couldn't be found.");
  const row = (await supabase(`/rest/v1/submissions?id=eq.${input.id}&user_id=eq.${user.id}&select=id,issue_number`, {
    admin: true,
  }))[0];
  if (!row) throw new HttpError(404, "That post couldn't be found.");
  if (row.issue_number) {
    const issue = await github(issuePath(row.issue_number));
    const labels = new Set<string>(issue.labels.map((label: Json) => label.name));
    // The publishing workflow removes the post and closes the issue.
    if (!labels.has("unpublish")) {
      await github(`${issuePath(row.issue_number)}/labels`, { method: "POST", body: { labels: ["unpublish"] } });
    }
  }
  return { removed: true };
}

async function deleteAccount(user: User, input: Json) {
  const removePosts = input?.removePosts === true;
  const rows: Json[] = await supabase(`/rest/v1/submissions?user_id=eq.${user.id}&select=issue_number`, { admin: true });
  for (const { issue_number: number } of rows) {
    if (!number) continue;
    const issue = await github(issuePath(number));
    const labels = new Set<string>(issue.labels.map((label: Json) => label.name));
    if (removePosts) {
      if (!labels.has("unpublish")) await github(`${issuePath(number)}/labels`, { method: "POST", body: { labels: ["unpublish"] } });
    } else if (issue.state === "open") {
      await github(`${issuePath(number)}/comments`, {
        method: "POST",
        body: {
          body: labels.has("published")
            ? "The author deleted their account. The published version stays on the blog; the changes waiting for review were withdrawn."
            : "The author deleted their account, so this post was withdrawn.",
        },
      });
      await github(issuePath(number), {
        method: "PATCH",
        body: { state: "closed", state_reason: labels.has("published") ? "completed" : "not_planned" },
      });
    }
  }

  // The images: every file in the person's folder.
  for (;;) {
    const files: Json[] = await supabase(`/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      admin: true,
      body: { prefix: user.id, limit: 1000, offset: 0 },
    });
    const names = files.map((file) => file.name).filter((name) => typeof name === "string" && name);
    if (!names.length) break;
    await supabase(`/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      admin: true,
      body: { prefixes: names.map((name) => `${user.id}/${name}`) },
    });
    if (names.length < 1000) break;
  }

  // Deleting the account also deletes its profile and submissions.
  await supabase(`/auth/v1/admin/users/${user.id}`, { method: "DELETE", admin: true });
  return { deleted: true };
}

// -----------------------------------------------------------------------------
// Requests
// -----------------------------------------------------------------------------

function corsHeaders(req: Request): Headers {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = [SITE_ORIGIN, ...setting("EXTRA_ORIGINS", "").split(",").map((o) => o.trim()).filter(Boolean)];
  const headers = new Headers({
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  if (allowed.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function reply(req: Request, status: number, body: unknown): Response {
  const headers = corsHeaders(req);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return reply(req, 405, { error: "Use POST." });
  try {
    if (Number(req.headers.get("Content-Length") ?? 0) > LIMITS.requestBytes) {
      throw new HttpError(413, "The post is too long.");
    }
    const text = await req.text();
    if (text.length > LIMITS.requestBytes) throw new HttpError(413, "The post is too long.");
    let input: Json;
    try {
      input = JSON.parse(text);
    } catch {
      throw new HttpError(400, "The request couldn't be read.");
    }
    const user = await signedInUser(req);
    switch (input?.action) {
      case "submit":
        return reply(req, 200, await submit(user, input));
      case "list":
        return reply(req, 200, await list(user));
      case "remove":
        return reply(req, 200, await remove(user, input));
      case "delete-account":
        return reply(req, 200, await deleteAccount(user, input));
      default:
        throw new HttpError(400, "Unknown action.");
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return reply(req, error.status, { error: error.message, details: error.details });
    }
    console.error(error instanceof Error ? error.message : error);
    return reply(req, 500, { error: "Something went wrong on our side. Please try again later." });
  }
}

export default { fetch: handle };

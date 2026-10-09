/*
 * Accounts for the blog. Loaded only on the account pages (/account/,
 * /account/write/) and author pages (/blog/authors/), and only while
 * accounts are turned on in _data/accounts.yml. See README.md → "Accounts".
 *
 * It talks to the Supabase project directly:
 *  - Auth: a 6-digit code sent by email signs people in, and creates the
 *    account the first time. The session is kept in localStorage under
 *    "blog-session"; an unsent post is kept under "blog-draft".
 *  - Database: the public "profiles" table and each person's own
 *    "submissions" (supabase/schema.sql).
 *  - Storage: images for posts go to the "blog-images" bucket.
 *  - The "blog" Edge Function: sends posts for review, lists their status,
 *    removes posts, and deletes accounts.
 * Everything people type is shown with textContent, never as HTML.
 *
 * Source: src/ts/account.ts, compiled to assets/js/account.js
 * (npm run build).
 */
(() => {
  /* Types ----------------------------------------------------------------- */

  type Bytes = Uint8Array<ArrayBuffer>;

  interface Session {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: { id: string; email: string };
  }

  interface AuthResponse {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
    user?: { id: string; email: string };
  }

  interface Profile {
    id?: string;
    username: string;
    display_name: string;
    bio?: string | null;
    website?: string | null;
  }

  interface ProfileFields {
    id?: string;
    username?: string;
    display_name: string;
    bio: string;
    website: string;
  }

  interface SentPost {
    id: string;
    title: string;
    status: string;
    url?: string;
    createdAt: string;
    updatedAt?: string;
    problems?: string[];
    // The site owner's posts written on GitHub (only in the owner's list).
    source?: "github";
    issueUrl?: string;
  }

  interface Draft {
    title: string;
    summary: string;
    tags: string[];
    coverUrl: string;
    coverAlt: string;
    body: string;
    confirm?: boolean;
  }

  // A saved post as the database or the draft store returns it.
  interface StoredPost {
    title?: string;
    summary?: string;
    tags?: string[];
    coverUrl?: string;
    cover_url?: string;
    coverAlt?: string;
    cover_alt?: string;
    body?: string;
  }

  interface PublishedPost {
    title: string;
    url: string;
    date: string;
    description?: string;
    image?: string;
    author?: string;
    author_username?: string;
    reading_minutes: number;
    tags?: string[];
    tag_ids?: string[];
  }

  interface ApiError {
    error_code?: string;
    code?: string;
    msg?: string;
    message?: string;
    error_description?: string;
    error?: unknown;
    details?: unknown;
  }

  interface RequestOptions {
    method?: string;
    token?: string;
    json?: unknown;
    body?: BodyInit;
    headers?: Record<string, string>;
  }

  class RequestError extends Error {
    status?: number;
    details: string[] = [];
  }

  /* Setup ----------------------------------------------------------------- */

  const appElement = document.querySelector<HTMLElement>("[data-account-app]");
  if (!appElement) return;
  const app: HTMLElement = appElement;

  const config = {
    url: app.getAttribute("data-supabase-url") || "",
    key: app.getAttribute("data-supabase-key") || "",
    fn: app.getAttribute("data-function") || "blog",
    bucket: app.getAttribute("data-bucket") || "blog-images",
    maxBytes: (Number(app.getAttribute("data-max-mb")) || 10) * 1024 * 1024,
  };
  const SESSION_KEY = "blog-session";
  const DRAFT_KEY = "blog-draft";
  const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
  const USERNAME = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  /* Helpers ------------------------------------------------------------- */

  // An element the page always has.
  function $<T extends HTMLElement = HTMLElement>(selector: string, root?: ParentNode): T {
    return (root || app).querySelector<T>(selector)!;
  }

  function $$<T extends HTMLElement = HTMLElement>(selector: string, root?: ParentNode): T[] {
    return Array.from((root || app).querySelectorAll<T>(selector));
  }

  // A named field of a form.
  function field<T extends HTMLElement = HTMLInputElement>(form: HTMLFormElement, name: string): T {
    return form.elements.namedItem(name) as unknown as T;
  }

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string | null, text?: string | null): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Shows one view and hides the others; moves focus to the new view's
  // heading when the change follows something the person did.
  function show(name: string, focus?: boolean): void {
    for (const view of $$("[data-account-view]")) {
      view.hidden = view.getAttribute("data-account-view") !== name;
    }
    const heading = focus ? app.querySelector<HTMLElement>(`[data-account-view="${name}"] [tabindex="-1"]`) : null;
    if (heading) heading.focus();
  }

  function setStatus(target: HTMLElement | null, message: string, state?: string, details?: string[]): void {
    if (!target) return;
    target.textContent = "";
    target.setAttribute("data-state", state || "");
    if (!message) return;
    target.appendChild(element("span", null, message));
    if (details && details.length) {
      const list = element("ul", "form-status__list");
      for (const detail of details) list.appendChild(element("li", null, detail));
      target.appendChild(list);
    }
  }

  function setBusy(button: HTMLElement | null, on: boolean): void {
    if (!button) return;
    if (on) button.setAttribute("aria-disabled", "true");
    else button.removeAttribute("aria-disabled");
  }

  const isBusy = (button: HTMLElement | null): boolean => !!button && button.getAttribute("aria-disabled") === "true";

  function formatDate(value: string | undefined): string {
    const date = new Date(value || "");
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function randomId(): string {
    if (window.crypto.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => ("0" + b.toString(16)).slice(-2)).join("");
  }

  /* Browser storage (falls back to memory when storage is blocked) ------- */

  const memory: Record<string, unknown> = {};

  function readStore<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return (memory[key] as T) || null;
    }
  }

  function writeStore(key: string, value: unknown): void {
    memory[key] = value;
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Kept in memory only: it lasts until the page is closed.
    }
  }

  /* Image metadata --------------------------------------------------------
   * Photos often record where they were taken and which camera took them.
   * Images are cleaned in the browser before they're uploaded: the picture
   * is kept exactly as it is (animations too), and the metadata is left
   * out, apart from the rotation of JPEG and PNG photos. */

  function readFile(file: File): Promise<Bytes> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(new Error("That image couldn't be read. Please try again."));
      reader.readAsArrayBuffer(file);
    });
  }

  const damaged = (): Error => new Error("That image couldn't be read. Try saving it again, or use another image.");

  const ascii = (bytes: Bytes, start: number, length: number): string =>
    String.fromCharCode(...bytes.subarray(start, start + length));

  const uint16 = (bytes: Bytes, at: number, little: boolean): number =>
    little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1];

  const uint32 = (bytes: Bytes, at: number, little: boolean): number =>
    little
      ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) + bytes[at + 3] * 0x1000000
      : bytes[at] * 0x1000000 + ((bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]);

  function imageType(bytes: Bytes): string {
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
    if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
    if (/^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return "image/gif";
    if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
    return "";
  }

  // The rotation (1–8) recorded in a block of EXIF data; 1 is upright.
  function exifOrientation(bytes: Bytes, start: number, end: number): number {
    const order = ascii(bytes, start, 2);
    if (end - start < 8 || (order !== "II" && order !== "MM")) return 1;
    const little = order === "II";
    const directory = start + uint32(bytes, start + 4, little);
    if (directory + 2 > end) return 1;
    for (let i = 0, count = uint16(bytes, directory, little); i < count; i++) {
      const entry = directory + 2 + i * 12;
      if (entry + 12 > end) return 1;
      if (uint16(bytes, entry, little) === 0x0112 && uint16(bytes, entry + 2, little) === 3) {
        const value = uint16(bytes, entry + 8, little);
        return value >= 1 && value <= 8 ? value : 1;
      }
    }
    return 1;
  }

  // EXIF data holding nothing but a rotation.
  const orientationExif = (value: number): number[] => [
    0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, value, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ];

  function cleanJpeg(bytes: Bytes): Bytes[] {
    const parts: Bytes[] = [bytes.subarray(0, 2)];
    let orientation = 1;
    let insertAt = 1;
    let pos = 2;
    while (pos + 1 < bytes.length) {
      if (bytes[pos] !== 0xFF) throw damaged();
      const marker = bytes[pos + 1];
      if (marker === 0xFF) {
        pos += 1;
        continue;
      }
      if (marker === 0xD9) {
        parts.push(bytes.subarray(pos, pos + 2));
        if (orientation > 1) {
          parts.splice(insertAt, 0, new Uint8Array([0xFF, 0xE1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
            ...orientationExif(orientation)]));
        }
        // Anything after the end of the picture (such as the extra
        // pictures some phones attach) is left out.
        return parts;
      }
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
        parts.push(bytes.subarray(pos, pos + 2));
        pos += 2;
        continue;
      }
      const end = pos + 2 + uint16(bytes, pos + 2, false);
      if (pos + 4 > bytes.length || end < pos + 4 || end > bytes.length) throw damaged();
      const label = ascii(bytes, pos + 4, Math.min(12, end - pos - 4));
      let keep = true;
      if (marker === 0xE1) {
        // EXIF (camera, place, and time) and XMP data.
        if (label.startsWith("Exif\0\0")) orientation = exifOrientation(bytes, pos + 10, end);
        keep = false;
      } else if (marker === 0xE2) {
        keep = label === "ICC_PROFILE\0";
      } else if ((marker >= 0xE3 && marker <= 0xED) || marker === 0xEF || marker === 0xFE) {
        // Other application data (such as IPTC captions) and comments.
        keep = false;
      }
      if (keep) {
        if (marker === 0xE0 && parts.length === 1) insertAt = 2;
        parts.push(bytes.subarray(pos, end));
      }
      pos = end;
      if (marker === 0xDA) {
        // Compressed picture data, up to the next marker.
        const start = pos;
        while (pos + 1 < bytes.length) {
          const next = bytes[pos + 1];
          if (bytes[pos] === 0xFF && next !== 0x00 && next !== 0xFF && (next < 0xD0 || next > 0xD7)) break;
          pos += 1;
        }
        parts.push(bytes.subarray(start, pos));
      }
    }
    throw damaged();
  }

  let crcTable: number[] | null = null;

  function crc32(bytes: number[]): number {
    if (!crcTable) {
      crcTable = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  const PNG_METADATA = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

  function cleanPng(bytes: Bytes): Bytes[] {
    const parts: Bytes[] = [bytes.subarray(0, 8)];
    let orientation = 1;
    let firstData = -1;
    let pos = 8;
    while (pos + 12 <= bytes.length) {
      const length = uint32(bytes, pos, false);
      const type = ascii(bytes, pos + 4, 4);
      const end = pos + 12 + length;
      if (end > bytes.length) throw damaged();
      if (type === "eXIf") orientation = exifOrientation(bytes, pos + 8, pos + 8 + length);
      if (!PNG_METADATA.has(type)) {
        if (type === "IDAT" && firstData < 0) firstData = parts.length;
        parts.push(bytes.subarray(pos, end));
      }
      pos = end;
      if (type === "IEND") {
        if (orientation > 1 && firstData > 0) {
          const chunk = [0x65, 0x58, 0x49, 0x66, ...orientationExif(orientation)];
          const crc = crc32(chunk);
          parts.splice(firstData, 0, new Uint8Array([0, 0, 0, chunk.length - 4, ...chunk,
            crc >>> 24, (crc >>> 16) & 0xFF, (crc >>> 8) & 0xFF, crc & 0xFF]));
        }
        return parts;
      }
    }
    throw damaged();
  }

  function cleanWebp(bytes: Bytes): Bytes[] {
    const parts: Bytes[] = [bytes.slice(0, 12)];
    let header: Bytes | null = null;
    let orientation = 1;
    const riffEnd = Math.min(bytes.length, 8 + uint32(bytes, 4, true));
    let pos = 12;
    while (pos + 8 <= riffEnd) {
      const type = ascii(bytes, pos, 4);
      const length = uint32(bytes, pos + 4, true);
      if (pos + 8 + length > riffEnd) throw damaged();
      const end = Math.min(riffEnd, pos + 8 + length + (length & 1));
      if (type === "EXIF") {
        const at = ascii(bytes, pos + 8, 6) === "Exif\0\0" ? pos + 14 : pos + 8;
        orientation = exifOrientation(bytes, at, pos + 8 + length);
      } else if (type !== "XMP ") {
        const chunk = type === "VP8X" ? bytes.slice(pos, end) : bytes.subarray(pos, end);
        if (type === "VP8X" && length >= 10) header = chunk;
        parts.push(chunk);
      }
      pos = end;
    }
    if (parts.length < 2) throw damaged();
    if (!header) orientation = 1;
    if (orientation > 1) parts.push(new Uint8Array([0x45, 0x58, 0x49, 0x46, 26, 0, 0, 0, ...orientationExif(orientation)]));
    // The header's flags say which chunks follow: no XMP now, and EXIF
    // only for the rotation.
    if (header) header[8] &= orientation > 1 ? ~0x04 : ~0x0C;
    const size = parts.reduce((total, part) => total + part.length, 0) - 8;
    parts[0].set([size & 0xFF, (size >>> 8) & 0xFF, (size >>> 16) & 0xFF, (size >>> 24) & 0xFF], 4);
    return parts;
  }

  function cleanGif(bytes: Bytes): Bytes[] {
    let pos = 13;
    if (bytes.length < pos) throw damaged();
    if (bytes[10] & 0x80) pos += 3 * (1 << ((bytes[10] & 0x07) + 1));
    const parts: Bytes[] = [bytes.subarray(0, pos)];
    let pictures = 0;
    while (pos < bytes.length && bytes[pos] !== 0x3B) {
      const start = pos;
      let keep = true;
      if (bytes[pos] === 0x2C) {
        // A picture: its descriptor, colour table, and code size.
        const packed = bytes[pos + 9];
        pos += 11;
        if (packed & 0x80) pos += 3 * (1 << ((packed & 0x07) + 1));
        pictures += 1;
      } else if (bytes[pos] === 0x21) {
        // An extension: comments and application data are left out,
        // apart from the setting that makes an animation repeat.
        const label = bytes[pos + 1];
        if (label === 0xFE) keep = false;
        if (label === 0xFF) keep = /^(NETSCAPE2\.0|ANIMEXTS1\.0)$/.test(ascii(bytes, pos + 3, 11));
        pos += 2;
      } else {
        throw damaged();
      }
      while (pos < bytes.length && bytes[pos] !== 0) pos += bytes[pos] + 1;
      pos += 1;
      if (pos > bytes.length) throw damaged();
      if (keep) parts.push(bytes.subarray(start, pos));
    }
    if (!pictures) throw damaged();
    parts.push(new Uint8Array([0x3B]));
    return parts;
  }

  const CLEANERS: Record<string, (bytes: Bytes) => Bytes[]> = {
    "image/jpeg": cleanJpeg,
    "image/png": cleanPng,
    "image/gif": cleanGif,
    "image/webp": cleanWebp,
  };

  // The image without its metadata, ready to upload.
  function cleanImage(bytes: Bytes): Blob {
    const type = imageType(bytes);
    if (!type) throw new Error("Use a PNG, JPEG, GIF, or WebP image.");
    return new Blob(CLEANERS[type](bytes), { type });
  }

  /* Requests to Supabase ------------------------------------------------- */

  const CONSTRAINTS = {
    profiles_username_format: "Usernames use 3–30 lowercase letters, numbers, and single hyphens, and start and end with a letter or number.",
    profiles_username_reserved: "That username is reserved. Please choose another.",
    profiles_display_name_format: "Display names can be up to 60 characters, without < or >.",
    profiles_bio_format: "“About you” can be up to 300 characters on one line, without < or >.",
    profiles_website_format: "The website must be an address starting with https://.",
  };

  function errorMessage(status: number, data: ApiError | null): string {
    const info = data || {};
    const code = String(info.error_code || info.code || "");
    const text = String(info.msg || info.message || info.error_description || "");
    if (code === "otp_expired" || (status === 403 && /expired|invalid/i.test(text))) {
      return "That code is wrong or has expired. Check it, or send a new code.";
    }
    if (status === 429 || /rate limit|security purposes/i.test(text)) {
      return "Too many tries. Please wait a minute, then try again.";
    }
    if (/not authorized|signups? not allowed/i.test(text)) {
      return "Sign-in emails can't be sent at the moment. Please try again later.";
    }
    if (code === "23505") return "That username is already taken. Please choose another.";
    if (code === "23514") {
      for (const [name, message] of Object.entries(CONSTRAINTS)) {
        if (text.includes(name)) return message;
      }
      return "Please check the details you entered.";
    }
    if (typeof info.error === "string" && info.error && !/^[a-z_]+$/.test(info.error)) return info.error;
    if (status === 401) return "Your session has ended. Please sign in again.";
    if (status === 413) return "That's too large to send.";
    if (status >= 500) return "Something went wrong on the server. Please try again later.";
    return "Something went wrong. Please try again.";
  }

  function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { apikey: config.key };
    if (options.token) headers.Authorization = "Bearer " + options.token;
    if (options.json !== undefined) headers["Content-Type"] = "application/json";
    Object.assign(headers, options.headers || {});
    return window.fetch(config.url + path, {
      method: options.method || (options.json !== undefined || options.body ? "POST" : "GET"),
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    }).then((response) =>
      response.text().then((text) => {
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }
        if (!response.ok) {
          const info = data as ApiError | null;
          const failure = new RequestError(errorMessage(response.status, info));
          failure.status = response.status;
          failure.details = info && Array.isArray(info.details) ? (info.details as string[]) : [];
          throw failure;
        }
        return data as T;
      }), () => {
      throw new Error("The connection failed. Check your internet connection and try again.");
    });
  }

  /* Session ---------------------------------------------------------------- */

  function saveSession(data: AuthResponse | null): Session | null {
    if (!data || !data.access_token || !data.user) return null;
    const session: Session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || "",
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: { id: data.user.id, email: data.user.email },
    };
    writeStore(SESSION_KEY, session);
    return session;
  }

  let refreshing: Promise<Session | null> | null = null;

  // The current session, refreshed first if it is about to expire; null
  // when signed out.
  function getSession(): Promise<Session | null> {
    const session = readStore<Session>(SESSION_KEY);
    if (!session || !session.access_token || !session.user || !UUID.test(session.user.id || "")) {
      return Promise.resolve(null);
    }
    if (session.expires_at * 1000 - 60000 > Date.now()) return Promise.resolve(session);
    if (!refreshing) {
      refreshing = request<AuthResponse>("/auth/v1/token?grant_type=refresh_token", { json: { refresh_token: session.refresh_token } })
        .then(saveSession, (error: RequestError) => {
          if (error.status && error.status < 500) {
            writeStore(SESSION_KEY, null);
            return null;
          }
          throw error;
        })
        .then((fresh) => {
          refreshing = null;
          return fresh;
        }, (error) => {
          refreshing = null;
          throw error;
        });
    }
    return refreshing;
  }

  function requireSession(): Promise<Session> {
    return getSession().then((session) => {
      if (!session) {
        const error = new RequestError("Your session has ended. Please sign in again.");
        error.status = 401;
        throw error;
      }
      return session;
    });
  }

  function signOut(): Promise<void> {
    const session = readStore<Session>(SESSION_KEY);
    writeStore(SESSION_KEY, null);
    if (!session) return Promise.resolve();
    return request("/auth/v1/logout?scope=local", { method: "POST", token: session.access_token })
      .then(() => undefined, () => undefined);
  }

  /* Data ---------------------------------------------------------------- */

  function loadProfile(session: Session): Promise<Profile | null> {
    return request<Profile[]>(`/rest/v1/profiles?id=eq.${session.user.id}&select=id,username,display_name,bio,website`,
      { token: session.access_token })
      .then((rows) => (rows && rows[0] ? rows[0] : null));
  }

  function callFunction<T = unknown>(payload: Record<string, unknown>): Promise<T> {
    return requireSession().then((session) =>
      request<T>("/functions/v1/" + encodeURIComponent(config.fn), { json: payload, token: session.access_token }));
  }

  function uploadImage(file: File | undefined): Promise<string> {
    if (!file) return Promise.reject(new Error("Choose an image first."));
    if (file.size > config.maxBytes) {
      return Promise.reject(new Error(`That image is larger than ${config.maxBytes / 1048576} MB.`));
    }
    let image: Blob;
    return readFile(file).then((bytes) => {
      image = cleanImage(bytes);
      return requireSession();
    }).then((session) => {
      const path = `${session.user.id}/${randomId()}.${IMAGE_TYPES[image.type]}`;
      return request(`/storage/v1/object/${config.bucket}/${path}`, {
        method: "POST",
        token: session.access_token,
        body: image,
        headers: { "Content-Type": image.type, "x-upsert": "false" },
      }).then(() => `${config.url}/storage/v1/object/public/${config.bucket}/${path}`, (error: RequestError) => {
        if (error.status === 403 || error.status === 400) {
          throw new Error("The image couldn't be uploaded. Check that it's a PNG, JPEG, GIF, or WebP image under " +
            config.maxBytes / 1048576 + " MB; each account can upload up to 200 images.");
        }
        throw error;
      });
    });
  }

  function profileFields(form: HTMLFormElement): ProfileFields {
    return {
      display_name: field(form, "display_name").value.replace(/\s+/g, " ").trim(),
      bio: field<HTMLTextAreaElement>(form, "bio").value.replace(/\s+/g, " ").trim(),
      website: field(form, "website").value.trim(),
    };
  }

  function checkProfile(fields: ProfileFields, problems: string[]): string[] {
    if (!fields.display_name) problems.push("Add a display name.");
    else if (fields.display_name.length > 60) problems.push(CONSTRAINTS.profiles_display_name_format);
    if (/[<>]/.test(fields.display_name + fields.bio)) problems.push("Please don't use < or > in your profile.");
    if (fields.bio.length > 300) problems.push(CONSTRAINTS.profiles_bio_format);
    if (fields.website && !/^https:\/\/[^\s<>"'`]+$/.test(fields.website)) problems.push(CONSTRAINTS.profiles_website_format);
    return problems;
  }

  /* The account page ---------------------------------------------------- */

  const STATUS_LABELS: Record<string, string> = {
    processing: "Being checked",
    waiting: "Waiting for review",
    "update-waiting": "Published · changes waiting for review",
    published: "Published",
    changes: "Needs changes",
    removed: "Removed",
    declined: "Declined",
    error: "Couldn't be published",
    unknown: "Status unavailable",
  };

  function initAccount(): void {
    let email = "";
    const emailForm = $<HTMLFormElement>('[data-form="email"]');
    const codeForm = $<HTMLFormElement>('[data-form="code"]');
    const createForm = $<HTMLFormElement>('[data-form="create-profile"]');
    const editForm = $<HTMLFormElement>('[data-form="edit-profile"]');
    const deleteForm = $<HTMLFormElement>('[data-form="delete-account"]');
    const resendButton = $<HTMLButtonElement>('[data-action="resend"]');
    const postsStatus = $("[data-posts-status]");
    let cooldown = 0;
    let cooldownTimer: number | undefined;

    const statusOf = (form: HTMLFormElement): HTMLElement => $("[data-status]", form);
    const submitOf = (form: HTMLFormElement): HTMLButtonElement => $<HTMLButtonElement>('button[type="submit"]', form);

    function startCooldown(): void {
      cooldown = 60;
      window.clearInterval(cooldownTimer);
      setBusy(resendButton, true);
      resendButton.textContent = "Send a new code (60 s)";
      cooldownTimer = window.setInterval(() => {
        cooldown -= 1;
        if (cooldown <= 0) {
          window.clearInterval(cooldownTimer);
          setBusy(resendButton, false);
          resendButton.textContent = "Send a new code";
        } else {
          resendButton.textContent = `Send a new code (${cooldown} s)`;
        }
      }, 1000);
    }

    function sendCode(address: string, status: HTMLElement, button: HTMLElement | null): Promise<boolean> {
      setBusy(button, true);
      setStatus(status, "Sending your code…", "pending");
      return request("/auth/v1/otp", { json: { email: address, create_user: true } })
        .then(() => {
          setStatus(status, "");
          startCooldown();
          return true;
        }, (error: Error) => {
          setStatus(status, error.message, "error");
          return false;
        })
        .then((sent) => {
          setBusy(button, false);
          return sent;
        });
    }

    function renderProfile(profile: Profile): void {
      for (const name of ["display_name", "username", "bio", "website"] as const) {
        const target = app.querySelector<HTMLElement>(`[data-profile="${name}"]`);
        if (target) target.textContent = profile[name] || "—";
      }
      const profileLink = $<HTMLAnchorElement>("[data-profile-link]");
      profileLink.setAttribute("href", (profileLink.getAttribute("href") || "").split("?")[0] + "?u=" + encodeURIComponent(profile.username));
      field(editForm, "display_name").value = profile.display_name || "";
      field<HTMLTextAreaElement>(editForm, "bio").value = profile.bio || "";
      field(editForm, "website").value = profile.website || "";
    }

    function renderPosts(posts: SentPost[]): void {
      const list = $("[data-posts]");
      list.textContent = "";
      if (!posts.length) {
        setStatus(postsStatus, "You haven't written any posts yet.", "");
        return;
      }
      setStatus(postsStatus, "");
      for (const post of posts) {
        const status = STATUS_LABELS[post.status] ? post.status : "unknown";
        const item = element("li", "account-post");
        const main = element("div", "account-post__main");
        const title = element("h3", "account-post__title");
        if (post.url && (status === "published" || status === "update-waiting")) {
          const link = element("a", null, post.title);
          link.href = post.url;
          title.appendChild(link);
        } else {
          title.textContent = post.title;
        }
        main.appendChild(title);
        const meta = element("p", "account-post__meta");
        meta.appendChild(element("span", `status-badge status-badge--${status}`, STATUS_LABELS[status]));
        const fromGitHub = post.source === "github";
        meta.appendChild(element("span", null, (fromGitHub ? "Written on GitHub " : "Sent ") + formatDate(post.createdAt)));
        if (post.updatedAt && post.updatedAt !== post.createdAt) {
          meta.appendChild(element("span", null, "changed " + formatDate(post.updatedAt)));
        }
        main.appendChild(meta);
        if (post.problems && post.problems.length) {
          main.appendChild(element("p", "account-post__note", "To publish it, edit the post to fix:"));
          const problems = element("ul", "account-post__problems");
          for (const problem of post.problems) problems.appendChild(element("li", null, problem.replace(/`/g, "")));
          main.appendChild(problems);
        }
        item.appendChild(main);
        if (status !== "removed" && status !== "declined") {
          const actions = element("div", "account-post__actions");
          const edit = element("a", "button button--secondary", "Edit");
          edit.href = ($<HTMLAnchorElement>('[data-account-view="dashboard"] a[href$="/account/write/"]').getAttribute("href") || "") +
            "?id=" + encodeURIComponent(post.id);
          edit.appendChild(element("span", "visually-hidden", ` “${post.title}”`));
          const remove = element("button", "button button--ghost", "Remove");
          remove.type = "button";
          remove.appendChild(element("span", "visually-hidden", ` “${post.title}”`));
          remove.addEventListener("click", () => {
            if (isBusy(remove)) return;
            if (!window.confirm(`Remove “${post.title}” from the blog? This can't be undone.`)) return;
            setBusy(remove, true);
            setStatus(postsStatus, "Removing the post…", "pending");
            callFunction({ action: "remove", id: post.id }).then(
              () => loadPosts("The post is being removed. It can take a minute or two to disappear from the blog."),
              (error: Error) => {
                setStatus(postsStatus, error.message, "error");
                setBusy(remove, false);
              }
            );
          });
          actions.appendChild(edit);
          actions.appendChild(remove);
          item.appendChild(actions);
        }
        list.appendChild(item);
      }
    }

    // Loads the list of posts, then shows the message (if any) and moves
    // focus to it, as the button that was used is gone.
    function loadPosts(message?: string): Promise<void> {
      setStatus(postsStatus, "Loading your posts…", "pending");
      return callFunction<{ posts?: SentPost[] }>({ action: "list" }).then((result) => {
        renderPosts(result && result.posts ? result.posts : []);
        if (message) {
          setStatus(postsStatus, message, "success");
          postsStatus.focus();
        }
      }, (error: Error) => {
        setStatus(postsStatus, "Your posts couldn't be loaded. " + error.message, "error");
      });
    }

    function showDashboard(session: Session, profile: Profile, focus: boolean): void {
      for (const target of $$("[data-email]")) target.textContent = session.user.email || "";
      renderProfile(profile);
      show("dashboard", focus);
      void loadPosts();
    }

    function afterSignIn(session: Session, focus: boolean): Promise<void> {
      return loadProfile(session).then((profile) => {
        if (profile) showDashboard(session, profile, focus);
        else show("create-profile", focus);
      });
    }

    emailForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = submitOf(emailForm);
      const status = statusOf(emailForm);
      if (isBusy(button)) return;
      const address = field(emailForm, "email").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        setStatus(status, "Enter a valid email address.", "error");
        field(emailForm, "email").focus();
        return;
      }
      void sendCode(address, status, button).then((sent) => {
        if (!sent) return;
        email = address;
        for (const target of $$("[data-email]")) target.textContent = address;
        field(codeForm, "code").value = "";
        setStatus(statusOf(codeForm), "");
        show("code", true);
      });
    });

    codeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = submitOf(codeForm);
      const status = statusOf(codeForm);
      if (isBusy(button)) return;
      const code = field(codeForm, "code").value.replace(/\D/g, "");
      if (!/^\d{6,10}$/.test(code)) {
        setStatus(status, "Enter the 6-digit code from the email.", "error");
        field(codeForm, "code").focus();
        return;
      }
      setBusy(button, true);
      setStatus(status, "Signing you in…", "pending");
      request<AuthResponse>("/auth/v1/verify", { json: { type: "email", email, token: code } })
        .then((data) => {
          const session = saveSession(data);
          if (!session) throw new Error("Signing in didn't work. Please try again.");
          setStatus(status, "");
          return afterSignIn(session, true);
        })
        .catch((error: Error) => {
          setStatus(status, error.message, "error");
        })
        .then(() => {
          setBusy(button, false);
        });
    });

    resendButton.addEventListener("click", () => {
      if (isBusy(resendButton) || !email) return;
      const status = statusOf(codeForm);
      void sendCode(email, status, null).then((sent) => {
        if (sent) setStatus(status, "A new code is on its way.", "success");
      });
    });

    $('[data-action="change-email"]').addEventListener("click", () => {
      setStatus(statusOf(emailForm), "");
      show("signin", true);
    });

    for (const button of $$('[data-action="sign-out"]')) {
      button.addEventListener("click", () => {
        void signOut().then(() => {
          setStatus(statusOf(emailForm), "You're signed out.", "success");
          show("signin", true);
        });
      });
    }

    field(createForm, "username").addEventListener("input", () => {
      const input = field(createForm, "username");
      const cleaned = input.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (cleaned !== input.value) input.value = cleaned;
    });

    createForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = submitOf(createForm);
      const status = statusOf(createForm);
      if (isBusy(button)) return;
      const fields = profileFields(createForm);
      fields.username = field(createForm, "username").value.trim().toLowerCase();
      const problems: string[] = [];
      if (!USERNAME.test(fields.username) || fields.username.includes("--")) {
        problems.push(CONSTRAINTS.profiles_username_format);
      }
      checkProfile(fields, problems);
      if (!field(createForm, "terms").checked) problems.push("Agree to the Terms to create your profile.");
      if (problems.length) {
        setStatus(status, "Please fix the following:", "error", problems);
        return;
      }
      setBusy(button, true);
      setStatus(status, "Creating your profile…", "pending");
      requireSession()
        .then((session) => {
          fields.id = session.user.id;
          return request<Profile[]>("/rest/v1/profiles", {
            json: fields,
            token: session.access_token,
            headers: { Prefer: "return=representation" },
          }).then((rows) => {
            setStatus(status, "");
            showDashboard(session, rows[0], true);
          });
        })
        .catch((error: Error) => {
          setStatus(status, error.message, "error");
        })
        .then(() => {
          setBusy(button, false);
        });
    });

    editForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = submitOf(editForm);
      const status = statusOf(editForm);
      if (isBusy(button)) return;
      const fields = profileFields(editForm);
      const problems = checkProfile(fields, []);
      if (problems.length) {
        setStatus(status, "Please fix the following:", "error", problems);
        return;
      }
      setBusy(button, true);
      setStatus(status, "Saving…", "pending");
      requireSession()
        .then((session) =>
          request<Profile[]>(`/rest/v1/profiles?id=eq.${session.user.id}`, {
            method: "PATCH",
            json: fields,
            token: session.access_token,
            headers: { Prefer: "return=representation" },
          }))
        .then((rows) => {
          renderProfile(rows[0]);
          setStatus(status, "Your profile is saved.", "success");
        })
        .catch((error: Error) => {
          setStatus(status, error.message, "error");
        })
        .then(() => {
          setBusy(button, false);
        });
    });

    deleteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = submitOf(deleteForm);
      const status = statusOf(deleteForm);
      if (isBusy(button)) return;
      const removePosts = field(deleteForm, "remove_posts").checked;
      const question = removePosts
        ? "Delete your account and remove your published posts? This can't be undone."
        : "Delete your account? Your published posts stay on the blog. This can't be undone.";
      if (!window.confirm(question)) return;
      setBusy(button, true);
      setStatus(status, "Deleting your account…", "pending");
      callFunction({ action: "delete-account", removePosts })
        .then((): boolean => {
          writeStore(SESSION_KEY, null);
          writeStore(DRAFT_KEY, null);
          setStatus(status, "Your account was deleted.", "success");
          window.location.assign(deleteForm.getAttribute("data-thanks") || "/");
          return true;
        }, (error: Error): boolean => {
          setStatus(status, error.message, "error");
          return false;
        })
        .then((leaving) => {
          if (!leaving) setBusy(button, false);
        });
    });

    getSession()
      .then((session) => {
        if (!session) {
          show("signin");
          return;
        }
        return afterSignIn(session, false);
      })
      .catch((error: Error) => {
        setStatus(app.querySelector<HTMLElement>('[data-account-view="loading"]'), "Your account couldn't be loaded. " + error.message, "error");
      });
  }

  /* The editor ------------------------------------------------------------ */

  function insertImage(textarea: HTMLTextAreaElement, url: string): void {
    const placeholder = "Describe the image";
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const gapBefore = !before || /\n\n$/.test(before) ? "" : /\n$/.test(before) ? "\n" : "\n\n";
    const gapAfter = /^\n/.test(after) ? "\n" : "\n\n";
    const markdown = `![${placeholder}](${url})`;
    textarea.value = before + gapBefore + markdown + gapAfter + after;
    const at = before.length + gapBefore.length + 2;
    textarea.focus();
    textarea.setSelectionRange(at, at + placeholder.length);
  }

  function initWrite(): void {
    const form = $<HTMLFormElement>('[data-form="post"]');
    const status = $("[data-status]", form);
    const submitButton = $<HTMLButtonElement>('button[type="submit"]', form);
    const coverInput = $<HTMLInputElement>('[data-file="cover"]');
    const bodyInput = $<HTMLInputElement>('[data-file="body"]');
    const coverPreview = $("[data-cover-preview]");
    const chooseCover = $<HTMLButtonElement>('[data-action="choose-cover"]');
    const removeCover = $<HTMLButtonElement>('[data-action="remove-cover"]');
    const addImage = $<HTMLButtonElement>('[data-action="add-image"]');
    const body = field<HTMLTextAreaElement>(form, "body");
    let editingId = new URLSearchParams(window.location.search).get("id");
    let coverUrl = "";
    let draftTimer: number | undefined;

    if (editingId && !UUID.test(editingId)) editingId = null;

    function setCover(url: string): void {
      coverUrl = url || "";
      coverPreview.textContent = "";
      coverPreview.hidden = !coverUrl;
      removeCover.hidden = !coverUrl;
      if (coverUrl) {
        // The description is typed in the field below the preview. Loaded
        // without cookies, like every other request to Supabase.
        const image = element("img");
        image.alt = "";
        image.crossOrigin = "anonymous";
        image.src = coverUrl;
        coverPreview.appendChild(image);
      }
      chooseCover.textContent = coverUrl ? "Choose another cover image" : "Choose a cover image";
    }

    function values(): Draft {
      return {
        title: field(form, "title").value.replace(/\s+/g, " ").trim(),
        summary: field<HTMLTextAreaElement>(form, "summary").value.replace(/\s+/g, " ").trim(),
        tags: field(form, "tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
        coverUrl,
        coverAlt: field(form, "coverAlt").value.replace(/\s+/g, " ").trim(),
        body: body.value,
      };
    }

    function fill(post: StoredPost): void {
      field(form, "title").value = post.title || "";
      field<HTMLTextAreaElement>(form, "summary").value = post.summary || "";
      field(form, "tags").value = (post.tags || []).join(", ");
      field(form, "coverAlt").value = post.coverAlt || post.cover_alt || "";
      body.value = post.body || "";
      setCover(post.coverUrl || post.cover_url || "");
    }

    function saveDraft(): void {
      if (editingId) return;
      window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(() => {
        const draft = values();
        draft.body = body.value;
        writeStore(DRAFT_KEY, draft);
      }, 600);
    }

    form.addEventListener("input", saveDraft);

    chooseCover.addEventListener("click", () => coverInput.click());

    removeCover.addEventListener("click", () => {
      setCover("");
      saveDraft();
      chooseCover.focus();
    });

    addImage.addEventListener("click", () => bodyInput.click());

    function upload(input: HTMLInputElement, button: HTMLElement, done: (url: string) => void): void {
      const file = input.files ? input.files[0] : undefined;
      input.value = "";
      if (!file || isBusy(button)) return;
      setBusy(button, true);
      setStatus(status, "Uploading the image…", "pending");
      uploadImage(file)
        .then((url) => {
          done(url);
          saveDraft();
        })
        .catch((error: Error) => {
          setStatus(status, error.message, "error");
        })
        .then(() => {
          setBusy(button, false);
        });
    }

    coverInput.addEventListener("change", () => {
      upload(coverInput, chooseCover, (url) => {
        setCover(url);
        setStatus(status, "The cover image is added. Describe it in the box below.", "success");
        field(form, "coverAlt").focus();
      });
    });

    bodyInput.addEventListener("change", () => {
      upload(bodyInput, addImage, (url) => {
        insertImage(body, url);
        setStatus(status, "The image is added to your post. Type a short description of it to replace the selected text.", "success");
      });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (isBusy(submitButton)) return;
      const post = values();
      const problems: string[] = [];
      if (!post.title) problems.push("Add a title.");
      if (!post.body.trim()) problems.push("Write the post.");
      if (post.coverUrl && !post.coverAlt) problems.push("Describe the cover image for people who can't see it.");
      if (!field(form, "confirm").checked) problems.push("Tick the confirmation box.");
      if (problems.length) {
        setStatus(status, "Please fix the following:", "error", problems);
        status.focus();
        return;
      }
      post.confirm = true;
      setBusy(submitButton, true);
      setStatus(status, "Sending your post…", "pending");
      callFunction({ action: "submit", id: editingId || undefined, post })
        .then((): boolean => {
          if (!editingId) writeStore(DRAFT_KEY, null);
          setStatus(status, "Your post has been sent.", "success");
          window.location.assign(form.getAttribute("data-thanks") || "/");
          return true;
        }, (error: RequestError): boolean => {
          setStatus(status, error.message, "error", error.details);
          status.focus();
          return false;
        })
        .then((leaving) => {
          if (!leaving) setBusy(submitButton, false);
        });
    });

    getSession()
      .then((session) => {
        if (!session) {
          show("signin-needed");
          return;
        }
        return loadProfile(session).then((profile) => {
          if (!profile) {
            show("profile-needed");
            return;
          }
          if (editingId) {
            return request<StoredPost[]>(`/rest/v1/submissions?id=eq.${editingId}&select=title,summary,tags,cover_url,cover_alt,body`,
              { token: session.access_token })
              .then((rows) => {
                if (!rows || !rows[0]) throw new Error("That post couldn't be found.");
                fill(rows[0]);
                $("[data-editor-title]").textContent = "Edit your post";
                document.title = "Edit your post" + document.title.slice(document.title.indexOf(" · "));
                show("editor");
              });
          }
          const draft = readStore<StoredPost>(DRAFT_KEY);
          if (draft && (draft.title || draft.body)) {
            fill(draft);
            setStatus(status, "Your unsent draft is back where you left it.", "success");
          }
          show("editor");
          return undefined;
        });
      })
      .catch((error: Error) => {
        setStatus(app.querySelector<HTMLElement>('[data-account-view="loading"]'), "The editor couldn't be loaded. " + error.message, "error");
      });
  }

  /* The author page -------------------------------------------------------- */

  function postCard(post: PublishedPost): HTMLElement {
    const card = element("article", "post-card" + (post.image ? " post-card--with-image" : ""));
    if (post.image) {
      const media = element("div", "post-card__media");
      const image = element("img", "post-card__image");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = post.image;
      media.appendChild(image);
      card.appendChild(media);
    }
    const body = element("div", "post-card__body");
    const title = element("h3", "post-card__title");
    const link = element("a", null, post.title);
    link.href = post.url;
    title.appendChild(link);
    body.appendChild(title);
    if (post.description) body.appendChild(element("p", "post-card__summary", post.description));
    const meta = element("p", "post-card__meta");
    const date = element("span");
    const time = element("time", null, formatDate(post.date));
    time.setAttribute("datetime", post.date);
    date.appendChild(time);
    meta.appendChild(date);
    meta.appendChild(element("span", null, `${post.reading_minutes} min read`));
    body.appendChild(meta);
    if (post.tags && post.tags.length) {
      const tags = element("ul", "tag-list tag-list--small");
      post.tags.forEach((tag, index) => {
        const item = element("li");
        const tagLink = element("a", "tag tag--link", tag);
        tagLink.href = (app.getAttribute("data-posts-index") || "").replace(/posts\.json$/, "tags/") +
          "#tag-" + ((post.tag_ids && post.tag_ids[index]) || "");
        item.appendChild(tagLink);
        tags.appendChild(item);
      });
      body.appendChild(tags);
    }
    card.appendChild(body);
    return card;
  }

  function initAuthor(): void {
    const username = (new URLSearchParams(window.location.search).get("u") || "").toLowerCase();
    if (!USERNAME.test(username)) {
      show("missing");
      return;
    }
    Promise.all([
      request<Profile[]>(`/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=username,display_name,bio,website`)
        .catch((): Profile[] => []),
      window.fetch(app.getAttribute("data-posts-index") || "").then((response) => response.json() as Promise<PublishedPost[]>),
    ]).then(([profiles, published]) => {
      const profile = profiles && profiles[0];
      const posts = (published || []).filter((post) => post.author_username === username);
      // Only authors with a published post have a public page.
      if (!posts.length) {
        show("missing");
        return;
      }
      const name = (profile && profile.display_name) || posts[0].author || username;
      const heading = document.querySelector(".page-header__title");
      if (heading) heading.textContent = name;
      document.title = name + document.title.slice(document.title.indexOf(" · "));
      $('[data-author="username"]').textContent = `@${username} · ${posts.length}${posts.length === 1 ? " post" : " posts"}`;
      if (profile && profile.bio) {
        $('[data-author="bio"]').textContent = profile.bio;
        $('[data-author="bio"]').hidden = false;
      }
      const website = profile ? profile.website || "" : "";
      if (/^https:\/\/[^\s<>"'`]+$/.test(website)) {
        const target = $('[data-author="website"]');
        const link = element("a", null, website.replace(/^https:\/\//, "").replace(/\/$/, ""));
        link.href = website;
        link.target = "_blank";
        link.rel = "noopener noreferrer nofollow ugc";
        link.appendChild(element("span", "visually-hidden", " (opens in a new tab)"));
        target.appendChild(link);
        target.hidden = false;
      }
      const list = $("[data-author-posts]");
      for (const post of posts) {
        const item = element("li");
        item.appendChild(postCard(post));
        list.appendChild(item);
      }
      show("profile");
    }).catch(() => {
      show("missing");
    });
  }

  // A page restored by the Back button (for example, from a thank-you page)
  // could show an account that's deleted or a post that's already sent, so
  // it's loaded again.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });

  const page = app.getAttribute("data-account-app");
  if (page === "account") initAccount();
  else if (page === "write") initWrite();
  else if (page === "author") initAuthor();
})();

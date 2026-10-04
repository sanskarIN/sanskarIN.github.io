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
 */
(function () {
  "use strict";

  var app = document.querySelector("[data-account-app]");
  if (!app || !window.fetch || !window.Promise || !window.URLSearchParams) return;

  var config = {
    url: app.getAttribute("data-supabase-url"),
    key: app.getAttribute("data-supabase-key"),
    fn: app.getAttribute("data-function") || "blog",
    bucket: app.getAttribute("data-bucket") || "blog-images",
    maxBytes: (Number(app.getAttribute("data-max-mb")) || 10) * 1024 * 1024
  };
  var SESSION_KEY = "blog-session";
  var DRAFT_KEY = "blog-draft";
  var IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
  var USERNAME = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  /* Helpers ------------------------------------------------------------- */

  function $(selector, root) {
    return (root || app).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || app).querySelectorAll(selector));
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Shows one view and hides the others; moves focus to the new view's
  // heading when the change follows something the person did.
  function show(name, focus) {
    $$("[data-account-view]").forEach(function (view) {
      view.hidden = view.getAttribute("data-account-view") !== name;
    });
    var heading = focus ? $('[data-account-view="' + name + '"] [tabindex="-1"]') : null;
    if (heading) heading.focus();
  }

  function setStatus(target, message, state, details) {
    if (!target) return;
    target.textContent = "";
    target.setAttribute("data-state", state || "");
    if (!message) return;
    target.appendChild(element("span", null, message));
    if (details && details.length) {
      var list = element("ul", "form-status__list");
      details.forEach(function (detail) {
        list.appendChild(element("li", null, detail));
      });
      target.appendChild(list);
    }
  }

  function setBusy(button, on) {
    if (!button) return;
    if (on) button.setAttribute("aria-disabled", "true");
    else button.removeAttribute("aria-disabled");
  }

  function isBusy(button) {
    return !!button && button.getAttribute("aria-disabled") === "true";
  }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function randomId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }

  /* Browser storage (falls back to memory when storage is blocked) ------- */

  var memory = {};

  function readStore(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return memory[key] || null;
    }
  }

  function writeStore(key, value) {
    memory[key] = value;
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Kept in memory only: it lasts until the page is closed.
    }
  }

  /* Image metadata --------------------------------------------------------
   * Photos often record where they were taken and which camera took them.
   * Images are cleaned in the browser before they're uploaded: the picture
   * is kept exactly as it is (animations too), and the metadata is left
   * out, apart from the rotation of JPEG and PNG photos. */

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(new Uint8Array(reader.result));
      };
      reader.onerror = function () {
        reject(new Error("That image couldn't be read. Please try again."));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function damaged() {
    return new Error("That image couldn't be read. Try saving it again, or use another image.");
  }

  function ascii(bytes, start, length) {
    return String.fromCharCode.apply(null, bytes.subarray(start, start + length));
  }

  function uint16(bytes, at, little) {
    return little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1];
  }

  function uint32(bytes, at, little) {
    return little
      ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) + bytes[at + 3] * 0x1000000
      : bytes[at] * 0x1000000 + ((bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]);
  }

  function imageType(bytes) {
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
    if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
    if (/^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return "image/gif";
    if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
    return "";
  }

  // The rotation (1–8) recorded in a block of EXIF data; 1 is upright.
  function exifOrientation(bytes, start, end) {
    var order = ascii(bytes, start, 2);
    if (end - start < 8 || (order !== "II" && order !== "MM")) return 1;
    var little = order === "II";
    var directory = start + uint32(bytes, start + 4, little);
    if (directory + 2 > end) return 1;
    for (var i = 0, count = uint16(bytes, directory, little); i < count; i++) {
      var entry = directory + 2 + i * 12;
      if (entry + 12 > end) return 1;
      if (uint16(bytes, entry, little) === 0x0112 && uint16(bytes, entry + 2, little) === 3) {
        var value = uint16(bytes, entry + 8, little);
        return value >= 1 && value <= 8 ? value : 1;
      }
    }
    return 1;
  }

  // EXIF data holding nothing but a rotation.
  function orientationExif(value) {
    return [0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01,
      0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, value, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00];
  }

  function cleanJpeg(bytes) {
    var parts = [bytes.subarray(0, 2)];
    var orientation = 1;
    var insertAt = 1;
    var pos = 2;
    while (pos + 1 < bytes.length) {
      if (bytes[pos] !== 0xFF) throw damaged();
      var marker = bytes[pos + 1];
      if (marker === 0xFF) {
        pos += 1;
        continue;
      }
      if (marker === 0xD9) {
        parts.push(bytes.subarray(pos, pos + 2));
        if (orientation > 1) {
          parts.splice(insertAt, 0, new Uint8Array([0xFF, 0xE1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
            .concat(orientationExif(orientation))));
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
      var end = pos + 2 + uint16(bytes, pos + 2, false);
      if (pos + 4 > bytes.length || end < pos + 4 || end > bytes.length) throw damaged();
      var label = ascii(bytes, pos + 4, Math.min(12, end - pos - 4));
      var keep = true;
      if (marker === 0xE1) {
        // EXIF (camera, place, and time) and XMP data.
        if (label.indexOf("Exif\0\0") === 0) orientation = exifOrientation(bytes, pos + 10, end);
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
        var start = pos;
        while (pos + 1 < bytes.length) {
          var next = bytes[pos + 1];
          if (bytes[pos] === 0xFF && next !== 0x00 && next !== 0xFF && (next < 0xD0 || next > 0xD7)) break;
          pos += 1;
        }
        parts.push(bytes.subarray(start, pos));
      }
    }
    throw damaged();
  }

  var crcTable = null;

  function crc32(bytes) {
    if (!crcTable) {
      crcTable = [];
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  var PNG_METADATA = { eXIf: true, tEXt: true, zTXt: true, iTXt: true, tIME: true };

  function cleanPng(bytes) {
    var parts = [bytes.subarray(0, 8)];
    var orientation = 1;
    var firstData = -1;
    var pos = 8;
    while (pos + 12 <= bytes.length) {
      var length = uint32(bytes, pos, false);
      var type = ascii(bytes, pos + 4, 4);
      var end = pos + 12 + length;
      if (end > bytes.length) throw damaged();
      if (type === "eXIf") orientation = exifOrientation(bytes, pos + 8, pos + 8 + length);
      if (!PNG_METADATA[type]) {
        if (type === "IDAT" && firstData < 0) firstData = parts.length;
        parts.push(bytes.subarray(pos, end));
      }
      pos = end;
      if (type === "IEND") {
        if (orientation > 1 && firstData > 0) {
          var chunk = [0x65, 0x58, 0x49, 0x66].concat(orientationExif(orientation));
          var crc = crc32(chunk);
          parts.splice(firstData, 0, new Uint8Array([0, 0, 0, chunk.length - 4].concat(chunk,
            [crc >>> 24, (crc >>> 16) & 0xFF, (crc >>> 8) & 0xFF, crc & 0xFF])));
        }
        return parts;
      }
    }
    throw damaged();
  }

  function cleanWebp(bytes) {
    var parts = [bytes.slice(0, 12)];
    var header = null;
    var orientation = 1;
    var riffEnd = Math.min(bytes.length, 8 + uint32(bytes, 4, true));
    var pos = 12;
    while (pos + 8 <= riffEnd) {
      var type = ascii(bytes, pos, 4);
      var length = uint32(bytes, pos + 4, true);
      if (pos + 8 + length > riffEnd) throw damaged();
      var end = Math.min(riffEnd, pos + 8 + length + (length & 1));
      if (type === "EXIF") {
        var at = ascii(bytes, pos + 8, 6) === "Exif\0\0" ? pos + 14 : pos + 8;
        orientation = exifOrientation(bytes, at, pos + 8 + length);
      } else if (type !== "XMP ") {
        var chunk = type === "VP8X" ? bytes.slice(pos, end) : bytes.subarray(pos, end);
        if (type === "VP8X" && length >= 10) header = chunk;
        parts.push(chunk);
      }
      pos = end;
    }
    if (parts.length < 2) throw damaged();
    if (!header) orientation = 1;
    if (orientation > 1) parts.push(new Uint8Array([0x45, 0x58, 0x49, 0x46, 26, 0, 0, 0].concat(orientationExif(orientation))));
    // The header's flags say which chunks follow: no XMP now, and EXIF
    // only for the rotation.
    if (header) header[8] &= orientation > 1 ? ~0x04 : ~0x0C;
    var size = parts.reduce(function (total, part) {
      return total + part.length;
    }, 0) - 8;
    parts[0].set([size & 0xFF, (size >>> 8) & 0xFF, (size >>> 16) & 0xFF, (size >>> 24) & 0xFF], 4);
    return parts;
  }

  function cleanGif(bytes) {
    var pos = 13;
    if (bytes.length < pos) throw damaged();
    if (bytes[10] & 0x80) pos += 3 * (1 << ((bytes[10] & 0x07) + 1));
    var parts = [bytes.subarray(0, pos)];
    var pictures = 0;
    while (pos < bytes.length && bytes[pos] !== 0x3B) {
      var start = pos;
      var keep = true;
      if (bytes[pos] === 0x2C) {
        // A picture: its descriptor, colour table, and code size.
        var packed = bytes[pos + 9];
        pos += 11;
        if (packed & 0x80) pos += 3 * (1 << ((packed & 0x07) + 1));
        pictures += 1;
      } else if (bytes[pos] === 0x21) {
        // An extension: comments and application data are left out,
        // apart from the setting that makes an animation repeat.
        var label = bytes[pos + 1];
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

  // The image without its metadata, ready to upload.
  function cleanImage(bytes) {
    var type = imageType(bytes);
    if (!type) throw new Error("Use a PNG, JPEG, GIF, or WebP image.");
    var clean = { "image/jpeg": cleanJpeg, "image/png": cleanPng, "image/gif": cleanGif, "image/webp": cleanWebp }[type];
    return new Blob(clean(bytes), { type: type });
  }

  /* Requests to Supabase ------------------------------------------------- */

  var CONSTRAINTS = {
    profiles_username_format: "Usernames use 3–30 lowercase letters, numbers, and single hyphens, and start and end with a letter or number.",
    profiles_username_reserved: "That username is reserved. Please choose another.",
    profiles_display_name_format: "Display names can be up to 60 characters, without < or >.",
    profiles_bio_format: "“About you” can be up to 300 characters on one line, without < or >.",
    profiles_website_format: "The website must be an address starting with https://."
  };

  function errorMessage(status, data) {
    data = data || {};
    var code = String(data.error_code || data.code || "");
    var text = String(data.msg || data.message || data.error_description || "");
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
      for (var name in CONSTRAINTS) {
        if (text.indexOf(name) !== -1) return CONSTRAINTS[name];
      }
      return "Please check the details you entered.";
    }
    if (typeof data.error === "string" && data.error && !/^[a-z_]+$/.test(data.error)) return data.error;
    if (status === 401) return "Your session has ended. Please sign in again.";
    if (status === 413) return "That's too large to send.";
    if (status >= 500) return "Something went wrong on the server. Please try again later.";
    return "Something went wrong. Please try again.";
  }

  function request(path, options) {
    options = options || {};
    var headers = { apikey: config.key };
    if (options.token) headers.Authorization = "Bearer " + options.token;
    if (options.json !== undefined) headers["Content-Type"] = "application/json";
    Object.keys(options.headers || {}).forEach(function (name) {
      headers[name] = options.headers[name];
    });
    return window.fetch(config.url + path, {
      method: options.method || (options.json !== undefined || options.body ? "POST" : "GET"),
      headers: headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (error) {
          data = null;
        }
        if (!response.ok) {
          var failure = new Error(errorMessage(response.status, data));
          failure.status = response.status;
          failure.details = data && Array.isArray(data.details) ? data.details : [];
          throw failure;
        }
        return data;
      });
    }, function () {
      throw new Error("The connection failed. Check your internet connection and try again.");
    });
  }

  /* Session ---------------------------------------------------------------- */

  function saveSession(data) {
    if (!data || !data.access_token || !data.user) return null;
    var session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: { id: data.user.id, email: data.user.email }
    };
    writeStore(SESSION_KEY, session);
    return session;
  }

  var refreshing = null;

  // The current session, refreshed first if it is about to expire; null
  // when signed out.
  function getSession() {
    var session = readStore(SESSION_KEY);
    if (!session || !session.access_token || !session.user || !UUID.test(session.user.id || "")) {
      return Promise.resolve(null);
    }
    if (session.expires_at * 1000 - 60000 > Date.now()) return Promise.resolve(session);
    if (!refreshing) {
      refreshing = request("/auth/v1/token?grant_type=refresh_token", { json: { refresh_token: session.refresh_token } })
        .then(saveSession, function (error) {
          if (error.status && error.status < 500) {
            writeStore(SESSION_KEY, null);
            return null;
          }
          throw error;
        })
        .then(function (fresh) {
          refreshing = null;
          return fresh;
        }, function (error) {
          refreshing = null;
          throw error;
        });
    }
    return refreshing;
  }

  function requireSession() {
    return getSession().then(function (session) {
      if (!session) {
        var error = new Error("Your session has ended. Please sign in again.");
        error.status = 401;
        throw error;
      }
      return session;
    });
  }

  function signOut() {
    var session = readStore(SESSION_KEY);
    writeStore(SESSION_KEY, null);
    if (!session) return Promise.resolve();
    return request("/auth/v1/logout?scope=local", { method: "POST", token: session.access_token })
      .catch(function () {});
  }

  /* Data ---------------------------------------------------------------- */

  function loadProfile(session) {
    return request("/rest/v1/profiles?id=eq." + session.user.id + "&select=id,username,display_name,bio,website",
      { token: session.access_token })
      .then(function (rows) {
        return rows && rows[0] ? rows[0] : null;
      });
  }

  function callFunction(payload) {
    return requireSession().then(function (session) {
      return request("/functions/v1/" + encodeURIComponent(config.fn), { json: payload, token: session.access_token });
    });
  }

  function uploadImage(file) {
    if (!file) return Promise.reject(new Error("Choose an image first."));
    if (file.size > config.maxBytes) {
      return Promise.reject(new Error("That image is larger than " + config.maxBytes / 1048576 + " MB."));
    }
    var image;
    return readFile(file).then(function (bytes) {
      image = cleanImage(bytes);
      return requireSession();
    }).then(function (session) {
      var path = session.user.id + "/" + randomId() + "." + IMAGE_TYPES[image.type];
      return request("/storage/v1/object/" + config.bucket + "/" + path, {
        method: "POST",
        token: session.access_token,
        body: image,
        headers: { "Content-Type": image.type, "x-upsert": "false" }
      }).then(function () {
        return config.url + "/storage/v1/object/public/" + config.bucket + "/" + path;
      }, function (error) {
        if (error.status === 403 || error.status === 400) {
          throw new Error("The image couldn't be uploaded. Check that it's a PNG, JPEG, GIF, or WebP image under " +
            config.maxBytes / 1048576 + " MB; each account can upload up to 200 images.");
        }
        throw error;
      });
    });
  }

  function profileFields(form) {
    return {
      display_name: form.elements.display_name.value.replace(/\s+/g, " ").trim(),
      bio: form.elements.bio.value.replace(/\s+/g, " ").trim(),
      website: form.elements.website.value.trim()
    };
  }

  function checkProfile(fields, problems) {
    if (!fields.display_name) problems.push("Add a display name.");
    else if (fields.display_name.length > 60) problems.push(CONSTRAINTS.profiles_display_name_format);
    if (/[<>]/.test(fields.display_name + fields.bio)) problems.push("Please don't use < or > in your profile.");
    if (fields.bio.length > 300) problems.push(CONSTRAINTS.profiles_bio_format);
    if (fields.website && !/^https:\/\/[^\s<>"'`]+$/.test(fields.website)) problems.push(CONSTRAINTS.profiles_website_format);
    return problems;
  }

  /* The account page ---------------------------------------------------- */

  var STATUS_LABELS = {
    processing: "Being checked",
    waiting: "Waiting for review",
    "update-waiting": "Published · changes waiting for review",
    published: "Published",
    changes: "Needs changes",
    removed: "Removed",
    declined: "Declined",
    error: "Couldn't be published",
    unknown: "Status unavailable"
  };

  function initAccount() {
    var email = "";
    var emailForm = $('[data-form="email"]');
    var codeForm = $('[data-form="code"]');
    var createForm = $('[data-form="create-profile"]');
    var editForm = $('[data-form="edit-profile"]');
    var deleteForm = $('[data-form="delete-account"]');
    var resendButton = $('[data-action="resend"]');
    var postsStatus = $("[data-posts-status]");
    var cooldown = 0;
    var cooldownTimer = null;

    function startCooldown() {
      cooldown = 60;
      window.clearInterval(cooldownTimer);
      setBusy(resendButton, true);
      resendButton.textContent = "Send a new code (60 s)";
      cooldownTimer = window.setInterval(function () {
        cooldown -= 1;
        if (cooldown <= 0) {
          window.clearInterval(cooldownTimer);
          setBusy(resendButton, false);
          resendButton.textContent = "Send a new code";
        } else {
          resendButton.textContent = "Send a new code (" + cooldown + " s)";
        }
      }, 1000);
    }

    function sendCode(address, status, button) {
      setBusy(button, true);
      setStatus(status, "Sending your code…", "pending");
      return request("/auth/v1/otp", { json: { email: address, create_user: true } })
        .then(function () {
          setStatus(status, "");
          startCooldown();
          return true;
        }, function (error) {
          setStatus(status, error.message, "error");
          return false;
        })
        .then(function (sent) {
          setBusy(button, false);
          return sent;
        });
    }

    function renderProfile(profile) {
      ["display_name", "username", "bio", "website"].forEach(function (field) {
        var target = $('[data-profile="' + field + '"]');
        if (target) target.textContent = profile[field] || "—";
      });
      $("[data-profile-link]").setAttribute("href",
        $("[data-profile-link]").getAttribute("href").split("?")[0] + "?u=" + encodeURIComponent(profile.username));
      editForm.elements.display_name.value = profile.display_name || "";
      editForm.elements.bio.value = profile.bio || "";
      editForm.elements.website.value = profile.website || "";
    }

    function renderPosts(posts) {
      var list = $("[data-posts]");
      list.textContent = "";
      if (!posts.length) {
        setStatus(postsStatus, "You haven't written any posts yet.", "");
        return;
      }
      setStatus(postsStatus, "");
      posts.forEach(function (post) {
        var status = STATUS_LABELS[post.status] ? post.status : "unknown";
        var item = element("li", "account-post");
        var main = element("div", "account-post__main");
        var title = element("h3", "account-post__title");
        if (post.url && (status === "published" || status === "update-waiting")) {
          var link = element("a", null, post.title);
          link.href = post.url;
          title.appendChild(link);
        } else {
          title.textContent = post.title;
        }
        main.appendChild(title);
        var meta = element("p", "account-post__meta");
        meta.appendChild(element("span", "status-badge status-badge--" + status, STATUS_LABELS[status]));
        meta.appendChild(element("span", null, "Sent " + formatDate(post.createdAt)));
        if (post.updatedAt && post.updatedAt !== post.createdAt) {
          meta.appendChild(element("span", null, "changed " + formatDate(post.updatedAt)));
        }
        main.appendChild(meta);
        if (post.problems && post.problems.length) {
          main.appendChild(element("p", "account-post__note", "To publish it, edit the post to fix:"));
          var problems = element("ul", "account-post__problems");
          post.problems.forEach(function (problem) {
            problems.appendChild(element("li", null, problem.replace(/`/g, "")));
          });
          main.appendChild(problems);
        }
        item.appendChild(main);
        if (status !== "removed" && status !== "declined") {
          var actions = element("div", "account-post__actions");
          var edit = element("a", "button button--secondary", "Edit");
          edit.href = $('[data-account-view="dashboard"] a[href$="/account/write/"]').getAttribute("href") +
            "?id=" + encodeURIComponent(post.id);
          edit.appendChild(element("span", "visually-hidden", " “" + post.title + "”"));
          var remove = element("button", "button button--ghost", "Remove");
          remove.type = "button";
          remove.appendChild(element("span", "visually-hidden", " “" + post.title + "”"));
          remove.addEventListener("click", function () {
            if (isBusy(remove)) return;
            if (!window.confirm("Remove “" + post.title + "” from the blog? This can't be undone.")) return;
            setBusy(remove, true);
            setStatus(postsStatus, "Removing the post…", "pending");
            callFunction({ action: "remove", id: post.id }).then(function () {
              return loadPosts("The post is being removed. It can take a minute or two to disappear from the blog.");
            }, function (error) {
              setStatus(postsStatus, error.message, "error");
              setBusy(remove, false);
            });
          });
          actions.appendChild(edit);
          actions.appendChild(remove);
          item.appendChild(actions);
        }
        list.appendChild(item);
      });
    }

    // Loads the list of posts, then shows the message (if any) and moves
    // focus to it, as the button that was used is gone.
    function loadPosts(message) {
      setStatus(postsStatus, "Loading your posts…", "pending");
      return callFunction({ action: "list" }).then(function (result) {
        renderPosts(result && result.posts ? result.posts : []);
        if (message) {
          setStatus(postsStatus, message, "success");
          postsStatus.focus();
        }
      }, function (error) {
        setStatus(postsStatus, "Your posts couldn't be loaded. " + error.message, "error");
      });
    }

    function showDashboard(session, profile, focus) {
      $$("[data-email]").forEach(function (target) {
        target.textContent = session.user.email || "";
      });
      renderProfile(profile);
      show("dashboard", focus);
      loadPosts();
    }

    function afterSignIn(session, focus) {
      return loadProfile(session).then(function (profile) {
        if (profile) {
          showDashboard(session, profile, focus);
        } else {
          show("create-profile", focus);
        }
      });
    }

    emailForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = emailForm.querySelector('button[type="submit"]');
      var status = emailForm.querySelector("[data-status]");
      if (isBusy(button)) return;
      var address = emailForm.elements.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        setStatus(status, "Enter a valid email address.", "error");
        emailForm.elements.email.focus();
        return;
      }
      sendCode(address, status, button).then(function (sent) {
        if (!sent) return;
        email = address;
        $$("[data-email]").forEach(function (target) {
          target.textContent = address;
        });
        codeForm.elements.code.value = "";
        setStatus(codeForm.querySelector("[data-status]"), "");
        show("code", true);
      });
    });

    codeForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = codeForm.querySelector('button[type="submit"]');
      var status = codeForm.querySelector("[data-status]");
      if (isBusy(button)) return;
      var code = codeForm.elements.code.value.replace(/\D/g, "");
      if (!/^\d{6,10}$/.test(code)) {
        setStatus(status, "Enter the 6-digit code from the email.", "error");
        codeForm.elements.code.focus();
        return;
      }
      setBusy(button, true);
      setStatus(status, "Signing you in…", "pending");
      request("/auth/v1/verify", { json: { type: "email", email: email, token: code } })
        .then(function (data) {
          var session = saveSession(data);
          if (!session) throw new Error("Signing in didn't work. Please try again.");
          setStatus(status, "");
          return afterSignIn(session, true);
        })
        .catch(function (error) {
          setStatus(status, error.message, "error");
        })
        .then(function () {
          setBusy(button, false);
        });
    });

    resendButton.addEventListener("click", function () {
      if (isBusy(resendButton) || !email) return;
      var status = codeForm.querySelector("[data-status]");
      sendCode(email, status, null).then(function (sent) {
        if (sent) setStatus(status, "A new code is on its way.", "success");
      });
    });

    $('[data-action="change-email"]').addEventListener("click", function () {
      setStatus(emailForm.querySelector("[data-status]"), "");
      show("signin", true);
    });

    $$('[data-action="sign-out"]').forEach(function (button) {
      button.addEventListener("click", function () {
        signOut().then(function () {
          setStatus(emailForm.querySelector("[data-status]"), "You're signed out.", "success");
          show("signin", true);
        });
      });
    });

    createForm.elements.username.addEventListener("input", function () {
      var field = createForm.elements.username;
      var cleaned = field.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (cleaned !== field.value) field.value = cleaned;
    });

    createForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = createForm.querySelector('button[type="submit"]');
      var status = createForm.querySelector("[data-status]");
      if (isBusy(button)) return;
      var fields = profileFields(createForm);
      fields.username = createForm.elements.username.value.trim().toLowerCase();
      var problems = [];
      if (!USERNAME.test(fields.username) || fields.username.indexOf("--") !== -1) {
        problems.push(CONSTRAINTS.profiles_username_format);
      }
      checkProfile(fields, problems);
      if (!createForm.elements.terms.checked) problems.push("Agree to the Terms to create your profile.");
      if (problems.length) {
        setStatus(status, "Please fix the following:", "error", problems);
        return;
      }
      setBusy(button, true);
      setStatus(status, "Creating your profile…", "pending");
      requireSession()
        .then(function (session) {
          fields.id = session.user.id;
          return request("/rest/v1/profiles", {
            json: fields,
            token: session.access_token,
            headers: { Prefer: "return=representation" }
          }).then(function (rows) {
            setStatus(status, "");
            showDashboard(session, rows[0], true);
          });
        })
        .catch(function (error) {
          setStatus(status, error.message, "error");
        })
        .then(function () {
          setBusy(button, false);
        });
    });

    editForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = editForm.querySelector('button[type="submit"]');
      var status = editForm.querySelector("[data-status]");
      if (isBusy(button)) return;
      var fields = profileFields(editForm);
      var problems = checkProfile(fields, []);
      if (problems.length) {
        setStatus(status, "Please fix the following:", "error", problems);
        return;
      }
      setBusy(button, true);
      setStatus(status, "Saving…", "pending");
      requireSession()
        .then(function (session) {
          return request("/rest/v1/profiles?id=eq." + session.user.id, {
            method: "PATCH",
            json: fields,
            token: session.access_token,
            headers: { Prefer: "return=representation" }
          });
        })
        .then(function (rows) {
          renderProfile(rows[0]);
          setStatus(status, "Your profile is saved.", "success");
        })
        .catch(function (error) {
          setStatus(status, error.message, "error");
        })
        .then(function () {
          setBusy(button, false);
        });
    });

    deleteForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = deleteForm.querySelector('button[type="submit"]');
      var status = deleteForm.querySelector("[data-status]");
      if (isBusy(button)) return;
      var removePosts = deleteForm.elements.remove_posts.checked;
      var question = removePosts
        ? "Delete your account and remove your published posts? This can't be undone."
        : "Delete your account? Your published posts stay on the blog. This can't be undone.";
      if (!window.confirm(question)) return;
      setBusy(button, true);
      setStatus(status, "Deleting your account…", "pending");
      callFunction({ action: "delete-account", removePosts: removePosts })
        .then(function () {
          writeStore(SESSION_KEY, null);
          writeStore(DRAFT_KEY, null);
          setStatus(emailForm.querySelector("[data-status]"), "Your account was deleted.", "success");
          show("signin", true);
        }, function (error) {
          setStatus(status, error.message, "error");
        })
        .then(function () {
          setBusy(button, false);
        });
    });

    getSession()
      .then(function (session) {
        if (!session) {
          show("signin");
          return;
        }
        return afterSignIn(session, false);
      })
      .catch(function (error) {
        setStatus($('[data-account-view="loading"]'), "Your account couldn't be loaded. " + error.message, "error");
      });
  }

  /* The editor ------------------------------------------------------------ */

  function insertImage(textarea, url) {
    var placeholder = "Describe the image";
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var before = textarea.value.slice(0, start);
    var after = textarea.value.slice(end);
    var gapBefore = !before || /\n\n$/.test(before) ? "" : /\n$/.test(before) ? "\n" : "\n\n";
    var gapAfter = /^\n/.test(after) ? "\n" : "\n\n";
    var markdown = "![" + placeholder + "](" + url + ")";
    textarea.value = before + gapBefore + markdown + gapAfter + after;
    var at = before.length + gapBefore.length + 2;
    textarea.focus();
    textarea.setSelectionRange(at, at + placeholder.length);
  }

  function initWrite() {
    var form = $('[data-form="post"]');
    var status = form.querySelector("[data-status]");
    var submitButton = form.querySelector('button[type="submit"]');
    var coverInput = $('[data-file="cover"]');
    var bodyInput = $('[data-file="body"]');
    var coverPreview = $("[data-cover-preview]");
    var chooseCover = $('[data-action="choose-cover"]');
    var removeCover = $('[data-action="remove-cover"]');
    var addImage = $('[data-action="add-image"]');
    var editingId = new URLSearchParams(window.location.search).get("id");
    var coverUrl = "";
    var draftTimer = null;

    if (editingId && !UUID.test(editingId)) editingId = null;

    function setCover(url) {
      coverUrl = url || "";
      coverPreview.textContent = "";
      coverPreview.hidden = !coverUrl;
      removeCover.hidden = !coverUrl;
      if (coverUrl) {
        // The description is typed in the field below the preview. Loaded
        // without cookies, like every other request to Supabase.
        var image = element("img");
        image.alt = "";
        image.crossOrigin = "anonymous";
        image.src = coverUrl;
        coverPreview.appendChild(image);
      }
      chooseCover.textContent = coverUrl ? "Choose another cover image" : "Choose a cover image";
    }

    function values() {
      return {
        title: form.elements.title.value.replace(/\s+/g, " ").trim(),
        summary: form.elements.summary.value.replace(/\s+/g, " ").trim(),
        tags: form.elements.tags.value.split(",").map(function (tag) {
          return tag.trim();
        }).filter(Boolean),
        coverUrl: coverUrl,
        coverAlt: form.elements.coverAlt.value.replace(/\s+/g, " ").trim(),
        body: form.elements.body.value
      };
    }

    function fill(post) {
      form.elements.title.value = post.title || "";
      form.elements.summary.value = post.summary || "";
      form.elements.tags.value = (post.tags || []).join(", ");
      form.elements.coverAlt.value = post.coverAlt || post.cover_alt || "";
      form.elements.body.value = post.body || "";
      setCover(post.coverUrl || post.cover_url || "");
    }

    function saveDraft() {
      if (editingId) return;
      window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(function () {
        var draft = values();
        draft.body = form.elements.body.value;
        writeStore(DRAFT_KEY, draft);
      }, 600);
    }

    form.addEventListener("input", saveDraft);

    chooseCover.addEventListener("click", function () {
      coverInput.click();
    });

    removeCover.addEventListener("click", function () {
      setCover("");
      saveDraft();
      chooseCover.focus();
    });

    addImage.addEventListener("click", function () {
      bodyInput.click();
    });

    function upload(input, button, done) {
      var file = input.files && input.files[0];
      input.value = "";
      if (!file || isBusy(button)) return;
      setBusy(button, true);
      setStatus(status, "Uploading the image…", "pending");
      uploadImage(file)
        .then(function (url) {
          done(url);
          saveDraft();
        })
        .catch(function (error) {
          setStatus(status, error.message, "error");
        })
        .then(function () {
          setBusy(button, false);
        });
    }

    coverInput.addEventListener("change", function () {
      upload(coverInput, chooseCover, function (url) {
        setCover(url);
        setStatus(status, "The cover image is added. Describe it in the box below.", "success");
        form.elements.coverAlt.focus();
      });
    });

    bodyInput.addEventListener("change", function () {
      upload(bodyInput, addImage, function (url) {
        insertImage(form.elements.body, url);
        setStatus(status, "The image is added to your post. Type a short description of it to replace the selected text.", "success");
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (isBusy(submitButton)) return;
      var post = values();
      var problems = [];
      if (!post.title) problems.push("Add a title.");
      if (!post.body.trim()) problems.push("Write the post.");
      if (post.coverUrl && !post.coverAlt) problems.push("Describe the cover image for people who can't see it.");
      if (!form.elements.confirm.checked) problems.push("Tick the confirmation box.");
      if (problems.length) {
        setStatus(status, "Please fix the following:", "error", problems);
        status.focus();
        return;
      }
      post.confirm = true;
      setBusy(submitButton, true);
      setStatus(status, "Sending your post…", "pending");
      callFunction({ action: "submit", id: editingId || undefined, post: post })
        .then(function () {
          if (!editingId) writeStore(DRAFT_KEY, null);
          setStatus(status, "Your post has been sent.", "success");
          window.location.assign(form.getAttribute("data-thanks"));
          return true;
        }, function (error) {
          setStatus(status, error.message, "error", error.details);
          status.focus();
        })
        .then(function (leaving) {
          if (!leaving) setBusy(submitButton, false);
        });
    });

    getSession()
      .then(function (session) {
        if (!session) {
          show("signin-needed");
          return;
        }
        return loadProfile(session).then(function (profile) {
          if (!profile) {
            show("profile-needed");
            return;
          }
          if (editingId) {
            return request("/rest/v1/submissions?id=eq." + editingId +
              "&select=title,summary,tags,cover_url,cover_alt,body", { token: session.access_token })
              .then(function (rows) {
                if (!rows || !rows[0]) throw new Error("That post couldn't be found.");
                fill(rows[0]);
                $("[data-editor-title]").textContent = "Edit your post";
                document.title = "Edit your post" + document.title.slice(document.title.indexOf(" · "));
                show("editor");
              });
          }
          var draft = readStore(DRAFT_KEY);
          if (draft && (draft.title || draft.body)) {
            fill(draft);
            setStatus(status, "Your unsent draft is back where you left it.", "success");
          }
          show("editor");
        });
      })
      .catch(function (error) {
        setStatus($('[data-account-view="loading"]'), "The editor couldn't be loaded. " + error.message, "error");
      });
  }

  /* The author page -------------------------------------------------------- */

  function postCard(post) {
    var card = element("article", "post-card" + (post.image ? " post-card--with-image" : ""));
    if (post.image) {
      var media = element("div", "post-card__media");
      var image = element("img", "post-card__image");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = post.image;
      media.appendChild(image);
      card.appendChild(media);
    }
    var body = element("div", "post-card__body");
    var title = element("h3", "post-card__title");
    var link = element("a", null, post.title);
    link.href = post.url;
    title.appendChild(link);
    body.appendChild(title);
    if (post.description) body.appendChild(element("p", "post-card__summary", post.description));
    var meta = element("p", "post-card__meta");
    var date = element("span");
    var time = element("time", null, formatDate(post.date));
    time.setAttribute("datetime", post.date);
    date.appendChild(time);
    meta.appendChild(date);
    meta.appendChild(element("span", null, post.reading_minutes + " min read"));
    body.appendChild(meta);
    if (post.tags && post.tags.length) {
      var tags = element("ul", "tag-list tag-list--small");
      post.tags.forEach(function (tag, index) {
        var item = element("li");
        var tagLink = element("a", "tag tag--link", tag);
        tagLink.href = app.getAttribute("data-posts-index").replace(/posts\.json$/, "tags/") +
          "#tag-" + ((post.tag_ids && post.tag_ids[index]) || "");
        item.appendChild(tagLink);
        tags.appendChild(item);
      });
      body.appendChild(tags);
    }
    card.appendChild(body);
    return card;
  }

  function initAuthor() {
    var username = (new URLSearchParams(window.location.search).get("u") || "").toLowerCase();
    if (!USERNAME.test(username)) {
      show("missing");
      return;
    }
    Promise.all([
      request("/rest/v1/profiles?username=eq." + encodeURIComponent(username) +
        "&select=username,display_name,bio,website").catch(function () {
        return [];
      }),
      window.fetch(app.getAttribute("data-posts-index")).then(function (response) {
        return response.json();
      })
    ]).then(function (results) {
      var profile = results[0] && results[0][0];
      var posts = (results[1] || []).filter(function (post) {
        return post.author_username === username;
      });
      // Only authors with a published post have a public page.
      if (!posts.length) {
        show("missing");
        return;
      }
      var name = (profile && profile.display_name) || posts[0].author || username;
      var heading = document.querySelector(".page-header__title");
      if (heading) heading.textContent = name;
      document.title = name + document.title.slice(document.title.indexOf(" · "));
      $('[data-author="username"]').textContent = "@" + username + " · " + posts.length +
        (posts.length === 1 ? " post" : " posts");
      if (profile && profile.bio) {
        $('[data-author="bio"]').textContent = profile.bio;
        $('[data-author="bio"]').hidden = false;
      }
      if (profile && /^https:\/\/[^\s<>"'`]+$/.test(profile.website || "")) {
        var website = $('[data-author="website"]');
        var link = element("a", null, profile.website.replace(/^https:\/\//, "").replace(/\/$/, ""));
        link.href = profile.website;
        link.target = "_blank";
        link.rel = "noopener noreferrer nofollow ugc";
        link.appendChild(element("span", "visually-hidden", " (opens in a new tab)"));
        website.appendChild(link);
        website.hidden = false;
      }
      var list = $("[data-author-posts]");
      posts.forEach(function (post) {
        var item = element("li");
        item.appendChild(postCard(post));
        list.appendChild(item);
      });
      show("profile");
    }).catch(function () {
      show("missing");
    });
  }

  var page = app.getAttribute("data-account-app");
  if (page === "account") initAccount();
  else if (page === "write") initWrite();
  else if (page === "author") initAuthor();
})();

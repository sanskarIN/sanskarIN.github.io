#!/usr/bin/env python3
"""Publishes blog posts written with the "Write a blog post" issue form.

Run by .github/workflows/publish-blog-post.yml:

    python .github/scripts/publish_post.py labels    create the blog's labels
    python .github/scripts/publish_post.py publish   handle the issue event

For each issue event, the script looks at the issue as it is now and brings
the website in line with it:

  1. It reads the form and checks it. If something needs fixing, a comment on
     the issue says what.
  2. Posts by the repository owner (and collaborators) are published straight
     away. Posts by anyone else wait until the owner adds the "approved"
     label, and wait again if their author edits them after that.
  3. Images attached to the issue are downloaded, checked, scaled down if
     they are very large, and saved without location or camera details.
     Images from other websites are turned into links.
  4. The Markdown is converted to HTML and cleaned with an allowlist, so a
     post cannot add scripts, styles, forms, or embedded content, and any
     Liquid tags in it are shown as plain text.
  5. The post is written to _posts/, its images to assets/images/blog/, and
     the change is committed and pushed. Then GitHub Pages is asked to
     rebuild the site (pushes made by a workflow do not trigger a build).

The "unpublish" label, or deleting the issue, removes the post again.

Posts written with an account on the website arrive the same way: the "blog"
Edge Function (supabase/functions/blog/) opens the issue with the owner's
token and marks which account wrote it. Those posts always wait for review,
and may only use images from that account's own upload folder. The one
exception is the site owner's own account (owner_username in
_data/accounts.yml, which only the site admin can take): its posts are the
owner's, published like the owner's posts from GitHub.

Limits and the review setting come from _data/blog.yml; the site address and
the owner's name from _config.yml. The issue is only ever handled as data: it
is never run, and never inserted into a shell command.
"""

import base64
import binascii
import hashlib
import html
import io
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import warnings
from datetime import datetime, timezone
from pathlib import Path

import nh3
import yaml
from markdown_it import MarkdownIt
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
POSTS_DIR = ROOT / "_posts"
IMAGES_DIR = ROOT / "assets" / "images" / "blog"
IMAGES_URL = "/assets/images/blog"

API_URL = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
USER_AGENT = "sanskarIN.github.io blog publisher"

# Labels used by the blog: name -> (color, description).
LABELS = {
    "blog-post": ("B93C0B", "A post for the blog"),
    "awaiting-review": ("FBCA04", "Blog post waiting for the owner's review"),
    "approved": ("1A7F37", "Publishes this blog post (owner only)"),
    "needs-changes": ("D93F0B", "Blog post needs changes before it can be published"),
    "published": ("0969DA", "This post is on the blog"),
    "unpublish": ("6E7781", "Removes this post from the blog (owner only)"),
    "from-website": ("5319E7", "Blog post sent from an account on the website"),
}
STATUS_LABELS = ("awaiting-review", "needs-changes", "published")

# Headings of the issue form fields (.github/ISSUE_TEMPLATE/blog-post.yml).
FIELDS_BEFORE_POST = ("Summary", "Tags", "Cover image", "Cover image description")
POST_FIELD = "Post"
CONFIRMATION_FIELD = "Confirmation"
NO_RESPONSE = "_No response_"

# Authors whose posts are published without review.
TRUSTED_AUTHORS = {"OWNER", "MEMBER", "COLLABORATOR"}

# Marks a post sent from a website account (see supabase/functions/blog/).
ACCOUNT_MARKER = re.compile(r"\A<!-- blog-account: ([A-Za-z0-9_-]+) -->")
ACCOUNT_USERNAME = re.compile(r"[a-z0-9][a-z0-9-]{1,28}[a-z0-9]")
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
ACCOUNT_IMAGE_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}")

# Addresses already used by blog pages: /blog/tags/ and /blog/feed.xml.
RESERVED_SLUGS = {"tags", "feed", "index", "page"}

# The comment the workflow keeps up to date on each post's issue.
STATUS_MARKER = "<!-- blog-post-status: {state} -->"
STATUS_PATTERN = re.compile(r"\A<!-- blog-post-status: ([a-z]+) -->")
BOT_LOGIN = "github-actions[bot]"

# HTML a post may contain. Everything else is removed; links and images may
# only use these URL schemes (or a relative URL).
ALLOWED_TAGS = {
    "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre",
    "code", "em", "strong", "b", "i", "u", "del", "s", "ins", "mark", "sub", "sup", "kbd",
    "small", "abbr", "q", "ul", "ol", "li", "dl", "dt", "dd", "a", "img",
    "table", "thead", "tbody", "tr", "th", "td", "details", "summary",
}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title"},
    "img": {"src", "alt", "title", "width", "height"},
    "abbr": {"title"},
    "ol": {"start"},
    "th": {"colspan", "rowspan"},
    "td": {"colspan", "rowspan"},
}
URL_SCHEMES = {"http", "https", "mailto"}

# Image formats accepted (Pillow format name -> file extension). Only these
# decoders are ever used.
IMAGE_FORMATS = {"JPEG": "jpg", "PNG": "png", "GIF": "gif", "WEBP": "webp"}
IMAGE_SIGNATURES = (
    (b"\xff\xd8\xff", "JPEG"),
    (b"\x89PNG\r\n\x1a\n", "PNG"),
    (b"GIF87a", "GIF"),
    (b"GIF89a", "GIF"),
)
Image.MAX_IMAGE_PIXELS = 50_000_000

# Images uploaded to GitHub issues live at these addresses.
ATTACHMENT_PATHS = (
    re.compile(r"/user-attachments/(?:assets|files)/[^/?#]+(?:/[^/?#]+)?"),
    re.compile(r"/[\w.-]+/[\w.-]+/assets/\d+/[\w-]+"),
)
URL_IN_TEXT = re.compile(r"""https://[^\s<>"'()\[\]]+""")

# Tokens in cleaned HTML: links (to know when an image sits inside one) and images.
HTML_TOKEN = re.compile(r'<a\b(?:[^>"]|"[^"]*")*>|</a>|<img\b(?:[^>"]|"[^"]*")*>')
HTML_ATTRIBUTE = re.compile(r'([^\s"\'<>/=]+)(?:="([^"]*)")?')


class PostProblem(Exception):
    """Something the author can fix by editing the issue."""

    def __init__(self, messages):
        super().__init__("; ".join(messages))
        self.messages = list(messages)


# -----------------------------------------------------------------------------
# Settings
# -----------------------------------------------------------------------------

def load_settings():
    config = yaml.safe_load((ROOT / "_config.yml").read_text(encoding="utf-8"))
    blog = yaml.safe_load((ROOT / "_data" / "blog.yml").read_text(encoding="utf-8")) or {}
    limits = blog.get("limits") or {}
    site_url = str(config["url"]).rstrip("/") + str(config.get("baseurl") or "").rstrip("/")
    accounts_file = ROOT / "_data" / "accounts.yml"
    accounts = (yaml.safe_load(accounts_file.read_text(encoding="utf-8")) or {}) if accounts_file.exists() else {}
    supabase_url = str(accounts.get("supabase_url") or "").strip().rstrip("/")
    bucket = str(accounts.get("images_bucket") or "blog-images")
    return {
        # Where images uploaded with website accounts live (None: accounts are off).
        "account_images": f"{supabase_url}/storage/v1/object/public/{bucket}/" if supabase_url else None,
        "site_url": site_url,
        "owner_name": str(config["author"]["name"]),
        # The site owner's own username on the website (see site_account()).
        "owner_username": str(accounts.get("owner_username") or "").strip().lower(),
        "form": str(blog.get("form") or "blog-post.yml"),
        "review": blog.get("review_visitor_posts", True) is not False,
        "image_bytes": int(float(limits.get("image_size_mb", 10)) * 1024 * 1024),
        "image_size_mb": limits.get("image_size_mb", 10),
        "images_per_post": int(limits.get("images_per_post", 20)),
        "image_max_side": int(limits.get("image_max_side", 2000)),
        "title_length": int(limits.get("title_length", 100)),
        "summary_length": int(limits.get("summary_length", 200)),
        "tags": int(limits.get("tags", 5)),
    }


# -----------------------------------------------------------------------------
# GitHub API
# -----------------------------------------------------------------------------

class GitHub:
    def __init__(self, repository, token):
        self.repo = repository
        self.token = token

    def request(self, method, path, body=None, expected=(200, 201, 204)):
        url = path if path.startswith(("https://", "http://")) else API_URL + path
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("X-GitHub-Api-Version", "2022-11-28")
        req.add_header("User-Agent", USER_AGENT)
        req.add_unredirected_header("Authorization", f"Bearer {self.token}")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    status, headers, raw = response.status, response.headers, response.read()
            except urllib.error.HTTPError as error:
                status, headers, raw = error.code, error.headers, error.read()
            except (urllib.error.URLError, TimeoutError) as error:
                if attempt == 2:
                    raise RuntimeError(f"GitHub API {method} {path}: {error}") from error
                time.sleep(2 ** attempt)
                continue
            if status >= 500 and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            break
        try:
            payload = json.loads(raw) if raw else None
        except ValueError:
            payload = None
        if status not in expected:
            raise RuntimeError(f"GitHub API {method} {path} returned {status}: {raw[:300]!r}")
        return status, headers, payload

    def paginate(self, path):
        items, url = [], path
        while url:
            _, headers, page = self.request("GET", url)
            items.extend(page or [])
            url = None
            for part in (headers.get("Link") or "").split(","):
                match = re.search(r'<([^>]+)>;\s*rel="next"', part)
                if match and match.group(1).startswith(API_URL + "/"):
                    url = match.group(1)
        return items

    def issue(self, number):
        return self.request("GET", f"/repos/{self.repo}/issues/{number}")[2]

    def ensure_labels(self):
        existing = {label["name"].lower() for label in self.paginate(f"/repos/{self.repo}/labels?per_page=100")}
        for name, (color, description) in LABELS.items():
            if name not in existing:
                self.request("POST", f"/repos/{self.repo}/labels",
                             {"name": name, "color": color, "description": description},
                             expected=(201, 422))
                print(f"Created label: {name}")

    def add_labels(self, number, names):
        if names:
            self.request("POST", f"/repos/{self.repo}/issues/{number}/labels", {"labels": sorted(names)})

    def remove_label(self, number, name):
        self.request("DELETE", f"/repos/{self.repo}/issues/{number}/labels/{urllib.parse.quote(name)}",
                     expected=(200, 204, 404))

    def set_state(self, number, state, reason=None):
        body = {"state": state}
        if reason:
            body["state_reason"] = reason
        self.request("PATCH", f"/repos/{self.repo}/issues/{number}", body)

    def set_status(self, number, state, text):
        """Keeps one status comment per issue. A new state gets a new comment,
        so the author is notified; the same state is updated in place."""
        body = STATUS_MARKER.format(state=state) + "\n" + text
        latest = None
        for comment in self.paginate(f"/repos/{self.repo}/issues/{number}/comments?per_page=100"):
            if comment["user"]["login"] == BOT_LOGIN and STATUS_PATTERN.match(comment["body"] or ""):
                latest = comment
        if latest and STATUS_PATTERN.match(latest["body"]).group(1) == state:
            if latest["body"] != body:
                self.request("PATCH", f"/repos/{self.repo}/issues/comments/{latest['id']}", {"body": body})
        else:
            self.request("POST", f"/repos/{self.repo}/issues/{number}/comments", {"body": body})

    def request_pages_build(self):
        status, _, _ = self.request("POST", f"/repos/{self.repo}/pages/builds",
                                    expected=(201, 403, 404, 409, 422))
        if status == 201:
            print("Requested a GitHub Pages build.")
        else:
            print(f"::warning::Could not request a GitHub Pages build ({status}). "
                  "The post appears after the next push to the repository.")


# -----------------------------------------------------------------------------
# Reading the issue form
# -----------------------------------------------------------------------------

def clean_line(text):
    """One line of plain text: no control or direction-changing characters,
    no angle brackets, and single spaces."""
    text = " ".join(unicodedata.normalize("NFC", text or "").split())
    kept = []
    for char in text:
        category = unicodedata.category(char)
        if category == "Cc" or (category == "Cf" and char not in "‌‍"):
            continue
        kept.append(char)
    return "".join(kept).replace("<", "‹").replace(">", "›").strip()


def form_sections(body):
    """Splits the issue body into the form's fields (text under each '### Label')."""
    lines = (body or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    headings = [(index, line[4:].strip()) for index, line in enumerate(lines) if line.startswith("### ")]
    post_at = next((index for index, label in headings if label == POST_FIELD), None)
    if post_at is None:
        return None
    positions = {POST_FIELD: post_at}
    for label in FIELDS_BEFORE_POST:
        found = next((index for index, name in headings if name == label and index < post_at), None)
        if found is not None:
            positions[label] = found
    confirmation = [index for index, label in headings if label == CONFIRMATION_FIELD and index > post_at]
    if confirmation:
        positions[CONFIRMATION_FIELD] = confirmation[-1]
    ordered = sorted(positions.items(), key=lambda item: item[1])
    sections = {}
    for number, (label, start) in enumerate(ordered):
        end = ordered[number + 1][1] if number + 1 < len(ordered) else len(lines)
        value = "\n".join(lines[start + 1:end]).strip("\n")
        sections[label] = "" if value.strip() in ("", NO_RESPONSE) else value
    return sections


def parse_tags(text, limit, problems):
    tags = []
    for raw in re.split(r"[,\n]", text):
        tag = clean_line(raw).lower().lstrip("#")
        tag = re.sub(r"\s+", "-", tag)
        tag = "".join(char for char in tag if char.isalnum() or char in "+#.-")
        tag = re.sub(r"-{2,}", "-", tag).strip("-").rstrip(".")[:30].strip("-")
        if tag and tag not in tags:
            tags.append(tag)
    if len(tags) > limit:
        problems.append(f"Use at most {limit} tags (there are {len(tags)}).")
    return tags[:limit]


def site_account(issue):
    """The website account that wrote a post sent from the website, or None.
    Only issues opened with the repository owner's token (as the "blog" Edge
    Function does) can carry the account marker."""
    owner = os.environ["GITHUB_REPOSITORY"].split("/")[0].lower()
    if str((issue.get("user") or {}).get("login", "")).lower() != owner:
        return None
    match = ACCOUNT_MARKER.match(issue.get("body") or "")
    if not match:
        return None
    encoded = match.group(1)
    try:
        data = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode("utf-8"))
    except (ValueError, binascii.Error, UnicodeDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    username, account_id = data.get("username"), data.get("id")
    name = clean_line(str(data.get("name") or ""))[:60]
    if not (isinstance(username, str) and ACCOUNT_USERNAME.fullmatch(username) and "--" not in username
            and isinstance(account_id, str) and UUID.fullmatch(account_id) and name):
        return None
    return {"id": account_id, "username": username, "name": name}


def image_check(account, settings):
    """Which image addresses a post may use: images attached on GitHub, and
    for website accounts, images in that account's own upload folder."""
    prefix = settings.get("account_images")
    own = f"{prefix}{account['id']}/" if account and prefix else None

    def allowed(url):
        if is_attachment(url):
            return True
        return bool(own) and url.startswith(own) and ACCOUNT_IMAGE_NAME.fullmatch(url[len(own):]) is not None

    return allowed


def is_attachment(url):
    """True for images uploaded to GitHub issues and comments."""
    try:
        parts = urllib.parse.urlsplit(url)
    except ValueError:
        return False
    if parts.scheme != "https" or parts.username or parts.password or parts.port:
        return False
    if parts.hostname == "github.com":
        return any(pattern.fullmatch(parts.path) for pattern in ATTACHMENT_PATHS)
    return parts.hostname == "user-images.githubusercontent.com"


def read_form(issue, settings, is_image=None):
    """Returns the post's fields, or raises PostProblem with everything to fix."""
    is_image = is_image or is_attachment
    problems, notes = [], []
    form_url = f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/issues/new?template={settings['form']}"

    title = clean_line(re.sub(r"^\s*\[post\]\s*:?", "", issue.get("title") or "", flags=re.I))
    if not title:
        problems.append("Add a title: replace the issue title with the title of your post.")
    elif len(title) > settings["title_length"]:
        problems.append(f"Shorten the title to {settings['title_length']} characters or fewer "
                        f"(it has {len(title)}).")

    sections = form_sections(issue.get("body"))
    if sections is None:
        raise PostProblem(problems + [
            "The post form couldn't be read. Keep the `### Post` heading and the other headings "
            f"from the form, or write the post with the [blog post form]({form_url})."
        ])

    summary = clean_line(sections.get("Summary", ""))
    if len(summary) > settings["summary_length"]:
        problems.append(f"Shorten the summary to {settings['summary_length']} characters or fewer "
                        f"(it has {len(summary)}).")

    tags = parse_tags(sections.get("Tags", ""), settings["tags"], problems)

    cover_text = sections.get("Cover image", "")
    cover_urls = [url for url in URL_IN_TEXT.findall(cover_text) if is_image(url)]
    cover_url = cover_urls[0] if cover_urls else None
    if cover_text and not cover_url:
        problems.append("Upload the cover image to this issue (drag it into the Cover image box). "
                        "Images on other websites can't be used.")
    if len(set(cover_urls)) > 1:
        notes.append("Only the first cover image is used.")
    cover_alt = clean_line(sections.get("Cover image description", ""))
    if cover_url and not cover_alt:
        problems.append("Describe the cover image in the Cover image description box, "
                        "for people who can't see it.")
    if len(cover_alt) > 250:
        problems.append(f"Shorten the cover image description to 250 characters or fewer (it has {len(cover_alt)}).")

    markdown = sections.get(POST_FIELD, "")
    if not markdown.strip():
        problems.append("Write the post: the Post box is empty.")

    confirmation = sections.get(CONFIRMATION_FIELD, "")
    if not re.search(r"^\s*[-*]\s+\[[xX]\]", confirmation, re.M):
        problems.append("Tick the confirmation box at the end of the form.")

    if problems:
        raise PostProblem(problems)
    return {
        "title": title,
        "summary": summary,
        "tags": tags,
        "cover_url": cover_url,
        "cover_alt": cover_alt if cover_url else "",
        "markdown": markdown,
        "notes": notes,
    }


# -----------------------------------------------------------------------------
# Turning Markdown into safe HTML
# -----------------------------------------------------------------------------

def render_markdown(markdown, link_rel):
    """GitHub-style Markdown (as in the issue preview) to cleaned HTML."""
    renderer = MarkdownIt("gfm-like", {"html": True, "linkify": True, "breaks": True, "typographer": False})
    markup = nh3.clean(
        renderer.render(markdown),
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=URL_SCHEMES,
        link_rel=link_rel,
        strip_comments=True,
    )
    # Links whose address was removed (for example "javascript:") become text.
    markup = re.sub(r'<a(?: title="[^"]*")? rel="[^"]*">(.*?)</a>', r"\1", markup, flags=re.S)
    # The post title is the page's only <h1>. The post's own top heading level
    # becomes <h2> (sections of the page), and the levels below it follow.
    levels = [int(level) for level in re.findall(r"<h([1-6])>", markup)]
    offset = 2 - min(levels) if levels else 0
    return re.sub(r"<(/?)h([1-6])>",
                  lambda m: f"<{m.group(1)}h{min(max(int(m.group(2)) + offset, 2), 6)}>", markup)


def tag_attributes(token):
    inner = re.sub(r"^<[a-zA-Z]+|/?>$", "", token)
    return {name.lower(): html.unescape(value or "") for name, value in HTML_ATTRIBUTE.findall(inner)}


def image_sources(markup):
    return [tag_attributes(token).get("src", "") for token in HTML_TOKEN.findall(markup)
            if token.startswith("<img")]


def rewrite_images(markup, replace_image):
    """Calls replace_image(attributes, inside_link) for every <img> tag."""
    depth = 0

    def substitute(match):
        nonlocal depth
        token = match.group(0)
        if token == "</a>":
            depth = max(depth - 1, 0)
            return token
        if token.startswith("<a"):
            depth += 1
            return token
        return replace_image(tag_attributes(token), depth > 0)

    return HTML_TOKEN.sub(substitute, markup)


def finish_markup(markup):
    # Wide tables and code blocks scroll sideways, and can be reached and
    # scrolled with the keyboard.
    markup = markup.replace("<table>", '<div class="table-scroll" role="region" aria-label="Table" tabindex="0"><table>')
    markup = markup.replace("</table>", "</table></div>")
    markup = markup.replace("<pre>", '<pre tabindex="0">')
    # Jekyll runs Liquid on posts: braces become character references, so
    # "{{ ... }}" and "{% ... %}" written in a post are shown, not run.
    return markup.replace("{", "&#123;").replace("}", "&#125;")


def plain_text(markup):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", markup)).split())


def shorten(text, limit):
    if len(text) <= limit:
        return text
    cut = text[:limit + 1].rsplit(" ", 1)[0] if " " in text[:limit + 1] else text[:limit]
    return cut.rstrip(" ,.;:–—-") + "…"


def weak_description(alt):
    alt = alt.strip().lower()
    return (not alt or alt in {"image", "img", "picture", "photo", "screenshot", "untitled"}
            or re.fullmatch(r".+\.(png|jpe?g|gif|webp)", alt) is not None
            or re.fullmatch(r"(img|dsc|image|screenshot|photo|pxl)[\s_-]?[\d\s_.:-]+(at[\d\s_.:apm-]+)?", alt) is not None)


# -----------------------------------------------------------------------------
# Images
# -----------------------------------------------------------------------------

class HttpsOnlyRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != "https":
            raise urllib.error.URLError("redirected to a non-HTTPS address")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(url, limit):
    opener = urllib.request.build_opener(HttpsOnlyRedirects)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "image/*"})
    size_mb = f"{limit / 1024 / 1024:g} MB"
    for attempt in range(3):
        try:
            with opener.open(request, timeout=60) as response:
                length = response.headers.get("Content-Length")
                if length and length.isdigit() and int(length) > limit:
                    raise PostProblem([f"An image is larger than {size_mb}: {url}"])
                data = response.read(limit + 1)
            if len(data) > limit:
                raise PostProblem([f"An image is larger than {size_mb}: {url}"])
            return data
        except urllib.error.HTTPError as error:
            if error.code < 500 or attempt == 2:
                raise PostProblem([f"An image couldn't be downloaded (error {error.code}): {url}. "
                                   "Try uploading it again."]) from error
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            if attempt == 2:
                raise PostProblem([f"An image couldn't be downloaded: {url}. Try uploading it again."]) from error
        time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def sniff_format(data):
    for signature, name in IMAGE_SIGNATURES:
        if data.startswith(signature):
            return name
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "WEBP"
    return None


def process_image(data, url, max_side, limit):
    """Checks an image and re-encodes it without metadata. Returns
    (bytes, extension, width, height, was_scaled_down)."""
    problem = PostProblem([f"This file isn't a PNG, JPEG, GIF, or WebP image: {url}"])
    if sniff_format(data) is None:
        raise problem
    formats = list(IMAGE_FORMATS)
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            with Image.open(io.BytesIO(data), formats=formats) as probe:
                probe.verify()
            image = Image.open(io.BytesIO(data), formats=formats)
            image.load()
            # Phone cameras often save photos as MPO: a JPEG with extra
            # pictures attached. Only the main picture is kept.
            kind = "JPEG" if image.format == "MPO" else image.format
            output = io.BytesIO()
            scaled = False
            if kind in ("GIF", "WEBP") and getattr(image, "is_animated", False):
                durations = []
                for frame in range(image.n_frames):
                    image.seek(frame)
                    image.load()
                    durations.append(image.info.get("duration", 100))
                image.seek(0)
                loop = image.info.get("loop", 0)
                image.info = {}
                if kind == "GIF":
                    image.save(output, "GIF", save_all=True, duration=durations, loop=loop)
                else:
                    image.save(output, "WEBP", save_all=True, duration=durations, loop=loop, quality=85)
            else:
                image = ImageOps.exif_transpose(image)
                if max(image.size) > max_side:
                    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
                    scaled = True
                icc_profile = image.info.get("icc_profile")
                transparency = image.info.get("transparency")
                image.info = {}
                if kind == "JPEG":
                    if image.mode not in ("RGB", "L"):
                        image = image.convert("RGB")
                    image.save(output, "JPEG", quality=85, optimize=True, progressive=True, icc_profile=icc_profile)
                elif kind == "PNG":
                    extra = {} if transparency is None else {"transparency": transparency}
                    image.save(output, "PNG", optimize=True, icc_profile=icc_profile, **extra)
                elif kind == "WEBP":
                    image.save(output, "WEBP", quality=85, icc_profile=icc_profile)
                else:
                    extra = {} if transparency is None else {"transparency": transparency}
                    image.save(output, "GIF", optimize=True, **extra)
            width, height = image.size
        except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
            raise PostProblem([f"This image has too many pixels: {url}"]) from error
        except PostProblem:
            raise
        except Exception as error:
            raise problem from error
    result = output.getvalue()
    if len(result) > limit:
        raise PostProblem([f"This image is too large even after compression: {url}"])
    return result, IMAGE_FORMATS[kind], width, height, scaled


# -----------------------------------------------------------------------------
# Posts on disk
# -----------------------------------------------------------------------------

def read_front_matter(path):
    text = path.read_text(encoding="utf-8")
    match = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not match:
        return {}, text
    try:
        data = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        data = {}
    return (data if isinstance(data, dict) else {}), text


def post_slug(path):
    match = re.match(r"\d{4}-\d{2}-\d{2}-(.+)\.[^.]+$", path.name)
    return match.group(1) if match else path.stem


def all_posts():
    if not POSTS_DIR.is_dir():
        return []
    return sorted(path for path in POSTS_DIR.iterdir() if path.is_file() and not path.name.startswith("."))


def find_post(number):
    for path in all_posts():
        data, text = read_front_matter(path)
        if data.get("source_issue") == number:
            return {"path": path, "data": data, "text": text, "slug": post_slug(path)}
    return None


def new_slug(title, number):
    text = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if len(slug) > 60:
        slug = slug[:61].rsplit("-", 1)[0] if "-" in slug[:61] else slug[:60]
    slug = slug.strip("-") or f"post-{number}"
    taken = {post_slug(path) for path in all_posts()}
    if slug in RESERVED_SLUGS or slug in taken or (IMAGES_DIR / slug).exists():
        slug = f"{slug}-{number}"
    return slug


def post_url(settings, slug):
    return f"{settings['site_url']}/blog/{slug}/"


def front_matter(fields):
    lines = ["---"]
    for key, value in fields.items():
        if value is None or value == "" or value == []:
            continue
        if isinstance(value, int) or key in ("date", "last_modified_at"):
            lines.append(f"{key}: {value}")
        else:
            lines.append(f"{key}: {json.dumps(value, ensure_ascii=False)}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def without_modified_date(text):
    return re.sub(r"^last_modified_at: .*\n", "", text, count=1, flags=re.M)


def owners_account(account, settings):
    """Whether a website account is the site owner's own: only the site admin can
    take owner_username (supabase/schema.sql), so its posts are the owner's."""
    return bool(account and settings["owner_username"] and account["username"] == settings["owner_username"])


def build_post(issue, form, settings, existing, trusted, account=None, is_image=None):
    """Downloads and prepares everything for the post. Nothing is written yet."""
    is_image = is_image or is_attachment
    number = issue["number"]
    login = issue["user"]["login"]
    by_owner = account is None or owners_account(account, settings)
    is_owner = by_owner and login.lower() == os.environ["GITHUB_REPOSITORY"].split("/")[0].lower()
    link_rel = "noopener noreferrer" if trusted else "noopener noreferrer nofollow ugc"
    slug = existing["slug"] if existing else new_slug(form["title"], number)
    notes = list(form["notes"])

    markup = render_markdown(form["markdown"], link_rel)
    sources = [src for src in image_sources(markup) if is_image(src)]
    wanted = list(dict.fromkeys(([form["cover_url"]] if form["cover_url"] else []) + sources))
    if len(wanted) > settings["images_per_post"]:
        raise PostProblem([f"Use at most {settings['images_per_post']} images (there are {len(wanted)})."])

    images, files, problems = {}, {}, []
    for url in wanted:
        try:
            data = download(url, settings["image_bytes"])
            content, extension, width, height, scaled = process_image(
                data, url, settings["image_max_side"], settings["image_bytes"])
        except PostProblem as problem:
            problems.extend(problem.messages)
            continue
        name = f"{hashlib.sha256(content).hexdigest()[:16]}.{extension}"
        images[url] = {"src": f"{IMAGES_URL}/{slug}/{name}", "width": width, "height": height}
        files[name] = content
        if scaled:
            notes.append(f"Large images were scaled down to {settings['image_max_side']:,} pixels "
                         "on the longest side.")
    if problems:
        raise PostProblem(problems)

    external, weak = [], 0

    def replace_image(attributes, inside_link):
        nonlocal weak
        src, alt = attributes.get("src", ""), attributes.get("alt", "")
        if src in images:
            image = images[src]
            weak += weak_description(alt)
            return (f'<img src="{html.escape(image["src"])}" alt="{html.escape(alt)}" '
                    f'width="{image["width"]}" height="{image["height"]}" loading="lazy" decoding="async">')
        if src.startswith("/") and not src.startswith("//"):
            return f'<img src="{html.escape(src)}" alt="{html.escape(alt)}" loading="lazy" decoding="async">'
        label = html.escape(alt or "Image")
        if not src.startswith(("https://", "http://")):
            return label
        external.append(src)
        if inside_link:
            return label
        return f'<a href="{html.escape(src)}" rel="{link_rel}">{label}</a>'

    markup = rewrite_images(markup, replace_image)
    text = plain_text(markup)
    if not text and "<img" not in markup:
        raise PostProblem(["Write the post: there is no text or image in the Post box."])
    if external:
        notes.append("Images from other websites were turned into links. To show an image in the post, "
                     "upload it to this issue instead.")
    if weak:
        notes.append(f"{weak} image{'s' if weak != 1 else ''} in the post "
                     f"{'have' if weak != 1 else 'has'} no real description (for example, the text is just "
                     '"Image"). Describe each image for people who can\'t see it: change the text in `![…]` '
                     'or in `alt="…"`.')
    if files:
        notes.append(f"{len(files)} image{'s were' if len(files) != 1 else ' was'} copied to the website, "
                     "with location and camera details removed.")

    cover = images.get(form["cover_url"]) if form["cover_url"] else None
    if not by_owner:
        author, author_url = account["name"], f"/blog/authors/?u={account['username']}"
    elif is_owner:
        author, author_url = settings["owner_name"], "/about/"
    else:
        author, author_url = login, f"https://github.com/{login}"
    fields = {
        "title": form["title"],
        "description": form["summary"] or shorten(clean_line(text), 160),
        "date": "{date}",
        "last_modified_at": None,
        "author": author,
        "author_url": author_url,
        "author_login": login if by_owner else None,
        "author_username": None if by_owner else account["username"],
        "image": cover["src"] if cover else None,
        "image_alt": form["cover_alt"] if cover else None,
        "image_width": cover["width"] if cover else None,
        "image_height": cover["height"] if cover else None,
        "tags": form["tags"],
        "source_issue": number,
    }
    return {
        "slug": slug,
        "fields": fields,
        "markup": finish_markup(markup),
        "files": files,
        "notes": list(dict.fromkeys(notes)),
    }


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def save_post(post, existing):
    """Writes the post and its images. Returns "created", "updated" or "unchanged"."""
    slug, fields = post["slug"], dict(post["fields"])
    if existing:
        match = re.search(r"^date: (.+)$", existing["text"], re.M)
        date = match.group(1).strip() if match else now_iso()
        path = existing["path"]
    else:
        date = now_iso()
        path = POSTS_DIR / f"{date[:10]}-{slug}.html"
    fields["date"] = date
    content = front_matter(fields) + post["markup"].rstrip("\n") + "\n"

    image_dir = IMAGES_DIR / slug
    wanted = set(post["files"])
    current = {entry.name for entry in image_dir.iterdir()} if image_dir.is_dir() else set()
    if existing and without_modified_date(existing["text"]) == content and current == wanted:
        return "unchanged"

    if existing:
        fields["last_modified_at"] = now_iso()
        content = front_matter(fields) + post["markup"].rstrip("\n") + "\n"
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    if wanted:
        image_dir.mkdir(parents=True, exist_ok=True)
    for name, data in post["files"].items():
        target = image_dir / name
        if not target.exists():
            target.write_bytes(data)
    for name in current - wanted:
        (image_dir / name).unlink()
    if image_dir.is_dir() and not any(image_dir.iterdir()):
        image_dir.rmdir()
    return "updated" if existing else "created"


def remove_post(existing):
    existing["path"].unlink()
    image_dir = IMAGES_DIR / existing["slug"]
    if image_dir.is_dir():
        for entry in image_dir.iterdir():
            entry.unlink()
        image_dir.rmdir()


# -----------------------------------------------------------------------------
# Git
# -----------------------------------------------------------------------------

def git(*args, check=True):
    env = dict(os.environ)
    name, email = os.environ["COMMIT_NAME"], os.environ["COMMIT_EMAIL"]
    env.update(GIT_AUTHOR_NAME=name, GIT_AUTHOR_EMAIL=email, GIT_COMMITTER_NAME=name, GIT_COMMITTER_EMAIL=email)
    result = subprocess.run(["git", *args], cwd=ROOT, env=env, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(f"git {args[0]} failed: {result.stderr.strip()}")
    return result


def commit_and_push(message, branch):
    paths = [path for path in ("_posts", "assets/images/blog")
             if (ROOT / path).exists() or git("ls-files", "--", path).stdout.strip()]
    if not paths:
        return False
    git("add", "--all", "--", *paths)
    if git("diff", "--cached", "--quiet", check=False).returncode == 0:
        return False
    git("commit", "--quiet", "-m", message)
    for attempt in range(5):
        if git("push", "--quiet", "origin", f"HEAD:{branch}", check=False).returncode == 0:
            print(f"Pushed: {message}")
            return True
        time.sleep(2 ** attempt)
        git("pull", "--quiet", "--rebase", "origin", branch)
    raise RuntimeError("The post was committed but could not be pushed.")


# -----------------------------------------------------------------------------
# Messages on the issue
# -----------------------------------------------------------------------------

def bullet_list(items):
    return "\n".join(f"- {item}" for item in items)


def with_notes(text, notes):
    return text + ("\n\n**Notes**\n\n" + bullet_list(notes) if notes else "")


def owner_help(review):
    return ("\n\n<sub>Site owner: add the `approved` label to publish this post, or close the issue "
            "to decline it.</sub>") if review else ""


# -----------------------------------------------------------------------------
# Handling an issue event
# -----------------------------------------------------------------------------

def handle_issue_event(gh, settings, event):
    action = event.get("action")
    number = event["issue"]["number"]
    branch = event["repository"]["default_branch"]

    if action == "deleted":
        existing = find_post(number)
        if existing:
            remove_post(existing)
            title = existing["data"].get("title") or existing["slug"]
            if commit_and_push(f"Remove blog post: {title} (issue deleted)", branch):
                gh.request_pages_build()
        return

    issue = gh.issue(number)
    labels = {label["name"] for label in issue.get("labels") or []}
    if "blog-post" not in labels and not re.match(r"\s*\[post\]", issue.get("title") or "", re.I):
        print("Not a blog post issue.")
        return
    gh.ensure_labels()
    if "blog-post" not in labels:
        gh.add_labels(number, ["blog-post"])
        labels.add("blog-post")

    author = issue["user"]["login"]
    account = site_account(issue)
    if account is None and (issue.get("body") or "").startswith("<!-- blog-account:") \
            and author.lower() == os.environ["GITHUB_REPOSITORY"].split("/")[0].lower():
        # Never treat a damaged website post as the owner's own post.
        gh.set_status(number, "error", "**This post couldn't be read.** It was sent from the website, "
                                       "but its account details are missing or damaged, so it wasn't published.")
        return
    is_image = image_check(account, settings)
    # Posts from website accounts are opened with the owner's token, but they
    # are visitors' posts: they always wait for review. Except the owner's own.
    trusted = (issue.get("author_association") in TRUSTED_AUTHORS
               and (account is None or owners_account(account, settings)))
    where = "it from your account on the website" if account else "this issue"
    is_open = issue.get("state") == "open"
    existing = find_post(number)
    live_url = post_url(settings, existing["slug"]) if existing else None

    if not is_open and not existing and action == "edited":
        print("Closed issue without a published post: edits are ignored.")
        return

    def update_labels(published, waiting=False, changes=False):
        wanted = {name for name, on in (("published", published), ("awaiting-review", waiting),
                                        ("needs-changes", changes)) if on}
        gh.add_labels(number, wanted - labels)
        for name in (set(STATUS_LABELS) & labels) - wanted:
            gh.remove_label(number, name)

    # (For website accounts, the Edge Function takes back the approval itself
    # when the author changes a post.)
    edited_after_approval = (action == "edited" and settings["review"] and not trusted and account is None
                             and "approved" in labels and event["sender"]["login"] == author)
    if edited_after_approval:
        gh.remove_label(number, "approved")
        labels.discard("approved")

    if "unpublish" in labels:
        if existing:
            remove_post(existing)
            if commit_and_push(f"Remove blog post: {existing['data'].get('title') or existing['slug']}", branch):
                gh.request_pages_build()
        update_labels(published=False)
        gh.set_status(number, "removed",
                      "**Removed from the blog.** This post is no longer on the website."
                      "\n\n<sub>Site owner: remove the `unpublish` label to publish it again.</sub>")
        if is_open:
            gh.set_state(number, "closed", "not_planned")
        return

    allowed = trusted or "approved" in labels or not settings["review"]
    try:
        form = read_form(issue, settings, is_image)
        if allowed:
            post = build_post(issue, form, settings, existing, trusted, account, is_image)
        else:
            precheck_images(form, settings, is_image)
    except PostProblem as problem:
        update_labels(published=bool(existing), changes=True)
        text = (f"**This post can't be published yet.** Please edit {where} to fix the following. "
                "It's checked again after every edit.\n\n" + bullet_list(problem.messages))
        if existing:
            text += f"\n\nThe version published earlier stays on the blog: {live_url}"
        gh.set_status(number, "changes", text)
        return

    if not allowed:
        update_labels(published=bool(existing), waiting=True)
        if existing:
            text = ("**Thanks for the update!** Your changes will be published after the site owner reviews "
                    f"them. Until then, the blog shows the version approved earlier: {live_url}")
        else:
            text = ("**Thanks for your post!** It will be published after the site owner reviews it. "
                    f"You can keep editing {where} until then.")
        gh.set_status(number, "waiting", with_notes(text, form["notes"]) + owner_help(settings["review"]))
        if not is_open and existing:
            gh.set_state(number, "open")
        return

    result = save_post(post, existing)
    url = post_url(settings, post["slug"])
    if result != "unchanged":
        verb = "Publish" if result == "created" else "Update"
        if commit_and_push(f"{verb} blog post: {post['fields']['title']}", branch):
            gh.request_pages_build()
    update_labels(published=True)
    if result == "unchanged":
        text = f"**Published.** The post is up to date: {url}"
    else:
        text = (f"**{'Published' if result == 'created' else 'Updated'}!** "
                f"{'Your post is on the blog' if result == 'created' else 'The post now shows your changes'}: "
                f"{url}\n\nIt can take a minute or two to appear.")
    text += (f"\n\nTo change the post, edit {where}" +
             (" — the changes are published after the site owner reviews them." if settings["review"] and not trusted
              else "; the post updates automatically.") +
             (" To have it removed, delete it from your account or email the site owner." if account
              else " To have it removed, comment on this issue."))
    gh.set_status(number, "published", with_notes(text, post["notes"]))
    if is_open:
        gh.set_state(number, "closed", "completed")


def precheck_images(form, settings, is_image=None):
    """For posts waiting for review: checks the images' size and type without
    decoding them. They are fully checked when the post is approved."""
    is_image = is_image or is_attachment
    markup = render_markdown(form["markdown"], "noopener noreferrer")
    wanted = list(dict.fromkeys(([form["cover_url"]] if form["cover_url"] else [])
                                + [src for src in image_sources(markup) if is_image(src)]))
    if len(wanted) > settings["images_per_post"]:
        raise PostProblem([f"Use at most {settings['images_per_post']} images (there are {len(wanted)})."])
    problems = []
    for url in wanted:
        try:
            if sniff_format(download(url, settings["image_bytes"])) is None:
                problems.append(f"This file isn't a PNG, JPEG, GIF, or WebP image: {url}")
        except PostProblem as problem:
            problems.extend(problem.messages)
    if problems:
        raise PostProblem(problems)


def main(argv):
    command = argv[1] if len(argv) > 1 else ""
    if command not in ("labels", "publish"):
        print(__doc__)
        return 2
    gh = GitHub(os.environ["GITHUB_REPOSITORY"], os.environ["GITHUB_TOKEN"])
    if command == "labels":
        gh.ensure_labels()
        return 0
    if os.environ.get("GITHUB_EVENT_NAME") != "issues":
        print("Nothing to do: not an issue event.")
        return 0
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    settings = load_settings()
    try:
        handle_issue_event(gh, settings, event)
    except Exception:
        if event.get("action") != "deleted":
            try:
                gh.set_status(event["issue"]["number"], "error",
                              "**Something went wrong while publishing this post.** The site owner can see "
                              "the details in the repository's Actions tab. Editing the issue tries again.")
            except Exception as error:
                print(f"Could not report the error on the issue: {error}")
        raise
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

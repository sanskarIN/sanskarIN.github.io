"""Validate and publish explicit document attachments from the account editor.

The source bucket is public by design (the editor warns before upload).
Only the signed-in author's folder is accepted, and published copies use
content-derived names without account identifiers.
"""
import hashlib
import html
import io
import posixpath
import re
import stat
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

MAX_BYTES = 10_000_000  # strictly less than 10 decimal MB
MAX_FILES = 5
MAX_EXPANDED = 64 * 1024 * 1024
MAX_PREVIEW = 20_000
NAME = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-([a-z0-9][a-z0-9-]{0,59})\.(pdf|pptx)")
SLIDE = re.compile(r"ppt/slides/slide([1-9][0-9]*)\.xml")
TEXT = "{http://schemas.openxmlformats.org/drawingml/2006/main}t"
PRESENTATION = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
OFFICE_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PACKAGE_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"
CONTENT_TYPE = "{http://schemas.openxmlformats.org/package/2006/content-types}"
PPTX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"


def source_prefix(image_prefix):
    if not image_prefix:
        return None
    return image_prefix.rsplit("/", 2)[0] + "/blog-attachments/"


def own_source(url, prefix, account):
    if not prefix or not account:
        return None
    own = prefix + account["id"] + "/"
    if not url.startswith(own):
        return None
    return NAME.fullmatch(url[len(own):])


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.URLError("Attachment redirects are not allowed")


def fetch_document(url):
    if urllib.parse.urlsplit(url).scheme != "https":
        raise ValueError("Attachment URL must use HTTPS")
    try:
        opener = urllib.request.build_opener(NoRedirect())
        with opener.open(urllib.request.Request(url, headers={"Accept": "application/pdf, application/vnd.openxmlformats-officedocument.presentationml.presentation"}), timeout=30) as response:
            data = response.read(MAX_BYTES)
    except (OSError, urllib.error.URLError) as exc:
        raise ValueError("Attachment could not be downloaded; upload it again") from exc
    if not data or len(data) >= MAX_BYTES:
        raise ValueError("Attachments must be nonempty and smaller than 10 MB")
    return data


def read_xml(archive, name):
    """Allow bounded UTF-8 XML only; reject entity declarations before parsing."""
    if archive.getinfo(name).file_size > 1_000_000:
        raise ValueError("Presentation XML exceeds the safety limit")
    raw = archive.read(name)
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Unsupported presentation XML encoding") from exc
    if "\x00" in text or "<!DOCTYPE" in text.upper() or "<!ENTITY" in text.upper():
        raise ValueError("Unsupported XML declaration")
    return ET.fromstring(text)


def safe_archive_name(name):
    """Reject ambiguous ZIP paths even though we never extract the archive."""
    parts = name.rstrip("/").split("/")
    return bool(name and "\\" not in name and not name.startswith("/")
                and all(part not in ("", ".", "..") and ":" not in part
                        and not any(ord(char) < 32 for char in part) for part in parts))


def ordered_slides(archive):
    """Read the authoritative presentation order, not ZIP filename order."""
    types = read_xml(archive, "[Content_Types].xml")
    if not any(node.get("PartName") == "/ppt/presentation.xml"
               and node.get("ContentType") == PPTX_CONTENT_TYPE
               for node in types.findall(CONTENT_TYPE + "Override")):
        raise ValueError("Not a non-macro PPTX presentation")
    presentation = read_xml(archive, "ppt/presentation.xml")
    if presentation.tag != PRESENTATION + "presentation":
        raise ValueError("Invalid presentation root")
    relations = read_xml(archive, "ppt/_rels/presentation.xml.rels")
    targets = {}
    for rel in relations.findall(PACKAGE_REL + "Relationship"):
        if not (rel.get("Type") or "").endswith("/slide"):
            continue
        if rel.get("TargetMode") == "External":
            raise ValueError("External slide references are not supported")
        target = rel.get("Target") or ""
        path = posixpath.normpath(target.lstrip("/") if target.startswith("/") else "ppt/" + target)
        if not SLIDE.fullmatch(path) or path not in archive.namelist() or rel.get("Id") in targets:
            raise ValueError("Invalid slide reference")
        targets[rel.get("Id")] = path
    order = []
    for slide in presentation.findall(PRESENTATION + "sldIdLst/" + PRESENTATION + "sldId"):
        target = targets.get(slide.get(OFFICE_REL + "id"))
        if not target or target in order:
            raise ValueError("Invalid or duplicate slide reference")
        order.append(target)
    if not order or len(order) > 100:
        raise ValueError("Presentations must contain 1–100 slides")
    return order


def preview_presentation(data):
    """Bounded text-only preview; does not execute macros or render objects."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            names = [entry.filename for entry in entries]
            if (len(entries) > 2000 or len(set(names)) != len(names)
                    or sum(entry.file_size for entry in entries) > MAX_EXPANDED
                    or any(entry.flag_bits & 1 for entry in entries)
                    or any(not safe_archive_name(name) for name in names)
                    or any(stat.S_ISLNK(entry.external_attr >> 16) for entry in entries)
                    or len({name.casefold() for name in names}) != len(names)):
                raise ValueError("Presentation archive exceeds safety limits")
            if not {"[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"}.issubset(names):
                raise ValueError("Not a valid PPTX presentation")
            if any("vbaproject" in name.lower() or "/embeddings/" in name.lower()
                   or "/activex/" in name.lower() or "/oleobjects/" in name.lower() for name in names):
                raise ValueError("Presentations with macros or embedded objects are not supported")
            if archive.testzip() is not None:
                raise ValueError("Presentation archive contains a damaged member")
            slides = ordered_slides(archive)
            preview = []
            remaining = MAX_PREVIEW
            for number, name in enumerate(slides, 1):
                root = read_xml(archive, name)
                if root.tag != PRESENTATION + "sld":
                    raise ValueError("Invalid slide root")
                if remaining <= 0 or root.get("show") in ("0", "false"):
                    continue
                text = " ".join(" ".join(node.itertext()) for node in root.iter(TEXT))
                text = " ".join(text.split())[:remaining]
                if text:
                    preview.append({"number": number, "text": text})
                    remaining -= len(text)
            return preview
    except (zipfile.BadZipFile, ET.ParseError, RuntimeError, NotImplementedError, KeyError) as exc:
        raise ValueError("Invalid or unsupported PPTX file") from exc


def prepare_document(data, stem, extension):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,59}", stem):
        raise ValueError("Invalid document filename")
    if not data or len(data) >= MAX_BYTES:
        raise ValueError("Attachments must be nonempty and smaller than 10 MB")
    if extension == "pdf":
        if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-4096:]:
            raise ValueError("Not a valid PDF file")
        preview = []
    elif extension == "pptx":
        preview = preview_presentation(data)
    else:
        raise ValueError("Only PDF and PPTX are supported")
    digest = hashlib.sha256(data).hexdigest()
    name = f"{stem}-{digest[:20]}.{extension}"
    return name, {"id": f"asset-{stem}-{digest[:20]}",
                  "name": name, "title": stem.replace("-", " "),
                  "format": extension.upper(), "bytes": len(data),
                  "sha256": digest, "slides": preview}


def collect(markup, prefix, account, slug, token_pattern, attributes):
    """Rewrite only actual sanitized anchor links, never code or plain text."""
    assets, files, seen = [], {}, {}

    def replace(match):
        token = match.group(0)
        if not token.startswith("<a"):
            return token
        url = attributes(token).get("href", "")
        if not prefix or not url.startswith(prefix):
            return token
        source = own_source(url, prefix, account)
        if not source:
            raise ValueError("Use only attachments uploaded from your own account")
        if url not in seen:
            if len(seen) >= MAX_FILES:
                raise ValueError("Use at most five attachments per post")
            data = fetch_document(url)
            name, asset = prepare_document(data, *source.groups())
            asset["path"] = f"/assets/files/blog/{slug}/{name}"
            if name not in files:
                assets.append(asset)
                files[name] = data
            seen[url] = asset["id"]
        # The public article never links to the staging folder.
        return '<a href="#' + html.escape(seen[url], quote=True) + '" rel="noopener noreferrer">'

    return token_pattern.sub(replace, markup), assets, files

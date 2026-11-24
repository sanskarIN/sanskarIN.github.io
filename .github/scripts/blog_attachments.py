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
import zlib
import xml.etree.ElementTree as ET

MAX_BYTES = 10_000_000  # strictly less than 10 decimal MB
MAX_FILES = 5
MAX_EXPANDED = 64 * 1024 * 1024
MAX_PREVIEW = 20_000
MAX_SLIDES = 250
MAX_CHART_EXPANDED = 16 * 1024 * 1024
NAME = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-([a-z0-9][a-z0-9-]{0,59})\.(pdf|pptx|md|docx|bib|html\.txt)")
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
        with opener.open(urllib.request.Request(url, headers={"Accept": "application/pdf, application/vnd.openxmlformats-officedocument.presentationml.presentation, text/markdown, text/plain, application/vnd.openxmlformats-officedocument.wordprocessingml.document"}), timeout=30) as response:
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
    if not order or len(order) > MAX_SLIDES:
        raise ValueError(f"Presentations must contain 1–{MAX_SLIDES} slides")
    return order


CHART_BOOK = re.compile(r"ppt/embeddings/[A-Za-z0-9_.-]+\.xlsx", re.I)
CHART_REL = re.compile(r"ppt/charts/_rels/chart[0-9]+\.xml\.rels")
WORKBOOK_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
SHEET = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
# Only ordinary chart-data workbooks, not arbitrary embedded Office files.
WORKBOOK_PART = re.compile(
    r"(?:\[Content_Types\]\.xml|_rels/\.rels|docProps/(?:app|core)\.xml|"
    r"xl/(?:workbook|styles|sharedStrings)\.xml|xl/_rels/workbook\.xml\.rels|"
    r"xl/worksheets/sheet[0-9]+\.xml|xl/theme/theme[0-9]+\.xml)"
)


def validate_chart_workbook(data):
    with zipfile.ZipFile(io.BytesIO(data)) as book:
        members = book.infolist()
        names = [member.filename for member in members]
        size = sum(member.file_size for member in members)
        if (len(members) > 128 or size > MAX_CHART_EXPANDED
                or len(set(name.casefold() for name in names)) != len(names)
                or any(not safe_archive_name(member.filename) or member.flag_bits & 1
                       or stat.S_ISLNK(member.external_attr >> 16)
                       or not WORKBOOK_PART.fullmatch(member.filename) for member in members)):
            raise ValueError("Unsupported embedded chart workbook")
        if not {"[Content_Types].xml", "xl/workbook.xml", "_rels/.rels"}.issubset(names):
            raise ValueError("Invalid embedded chart workbook")
        if book.testzip() is not None:
            raise ValueError("Damaged embedded chart workbook")
        types = read_xml(book, "[Content_Types].xml")
        if not any(node.get("PartName") == "/xl/workbook.xml"
                   and node.get("ContentType") == WORKBOOK_TYPE for node in types):
            raise ValueError("Only non-macro Excel chart data is supported")
        if any("macro" in (node.get("ContentType") or "").lower() for node in types):
            raise ValueError("Macros in chart workbooks are not supported")
        for name in names:
            root = read_xml(book, name)
            if name.endswith(".rels"):
                for rel in root.findall(PACKAGE_REL + "Relationship"):
                    kind = (rel.get("Type") or "").rsplit("/", 1)[-1]
                    if rel.get("TargetMode") == "External" or kind not in {
                        "officeDocument", "core-properties", "extended-properties",
                        "worksheet", "styles", "sharedStrings", "theme"
                    }:
                        raise ValueError("Unsupported chart workbook relationship")
            elif any(node.tag in {SHEET + "f", SHEET + "definedName", SHEET + "externalReference",
                                  SHEET + "oleObject", SHEET + "ddeLink"} for node in root.iter()):
                raise ValueError("Active formulas or external chart workbook data are not supported")
        return size


def validate_presentation_objects(archive, names):
    embedded = set()
    for name in names:
        lower = name.lower()
        if "vbaproject" in lower or "/activex/" in lower or "/oleobjects/" in lower:
            raise ValueError("Presentations with macros or active objects are not supported")
        if "/embeddings/" in lower:
            if not CHART_BOOK.fullmatch(name):
                raise ValueError("Only ordinary embedded Excel chart data is supported")
            embedded.add(name)
    types = read_xml(archive, "[Content_Types].xml")
    if any(any(word in (node.get("ContentType") or "").lower()
               for word in ("macroenabled", "vbaproject", "activex", "oleobject")) for node in types):
        raise ValueError("Macro-enabled or active presentations are not supported")
    referenced = set()
    for name in names:
        if not name.endswith(".rels"):
            continue
        for rel in read_xml(archive, name).findall(PACKAGE_REL + "Relationship"):
            kind = (rel.get("Type") or "").rsplit("/", 1)[-1].lower()
            if rel.get("TargetMode") == "External" and kind != "hyperlink":
                raise ValueError("External presentation objects are not supported")
            if kind in {"oleobject", "vbaproject", "control", "activexcontrol"}:
                raise ValueError("Active presentation objects are not supported")
            if kind == "package":
                target = rel.get("Target") or ""
                path = posixpath.normpath(target.lstrip("/") if target.startswith("/") else
                                          posixpath.join(posixpath.dirname(posixpath.dirname(name)), target))
                if not CHART_REL.fullmatch(name) or path not in embedded:
                    raise ValueError("Only chart-linked Excel data can be embedded")
                referenced.add(path)
    if embedded != referenced:
        raise ValueError("Unreferenced embedded workbook is not supported")
    expanded = 0
    for name in sorted(embedded):
        expanded += validate_chart_workbook(archive.read(name))
        if expanded > MAX_CHART_EXPANDED:
            raise ValueError("Combined chart workbooks exceed the safety limit")


def preview_presentation(data):
    """Bounded text-only preview; does not execute macros or render objects."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            names = [entry.filename for entry in entries]
            if (len(entries) > 4000 or len(set(names)) != len(names)
                    or sum(entry.file_size for entry in entries) > MAX_EXPANDED
                    or any(entry.flag_bits & 1 for entry in entries)
                    or any(not safe_archive_name(name) for name in names)
                    or any(stat.S_ISLNK(entry.external_attr >> 16) for entry in entries)
                    or len({name.casefold() for name in names}) != len(names)):
                raise ValueError("Presentation archive exceeds safety limits")
            if not {"[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"}.issubset(names):
                raise ValueError("Not a valid PPTX presentation")
            if archive.testzip() is not None:
                raise ValueError("Presentation archive contains a damaged member")
            validate_presentation_objects(archive, names)
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
    except (zipfile.BadZipFile, ET.ParseError, RuntimeError, NotImplementedError, KeyError,
            OSError, EOFError, zlib.error) as exc:
        raise ValueError("Invalid or unsupported PPTX file") from exc


def preview_source(data, label):
    """Validate plain UTF-8 and keep a bounded, inert source preview."""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError(f"{label} attachments must use UTF-8") from exc
    if not text.strip() or any(ord(char) < 32 and char not in "\t\r\n" for char in text):
        raise ValueError(f"{label} attachments must contain nonempty text without binary control characters")
    # Jekyll interprets a leading delimiter as page front matter, even in assets.
    if re.match(r"\A---[ \t]*(?:\r?\n|\r|$)", text):
        raise ValueError(f"{label} attachments must not begin with a front matter delimiter (---)")
    return text[:MAX_PREVIEW], len(text) > MAX_PREVIEW


def preview_bibtex(data):
    """Keep BibTeX/BibLaTeX source inert; do not interpret TeX or fetch references."""
    return preview_source(data, "BibTeX")


def preview_markdown(data):
    return preview_source(data, "Markdown")


def preview_html(data):
    return preview_source(data, "HTML")


WORD = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"


def preview_word(data):
    """Extract main document text only; never execute fields or load relationships."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            names = [entry.filename for entry in entries]
            if (len(entries) > 2000 or len({name.casefold() for name in names}) != len(names)
                    or sum(entry.file_size for entry in entries) > MAX_EXPANDED
                    or any(entry.flag_bits & 1 or stat.S_ISLNK(entry.external_attr >> 16)
                           for entry in entries)
                    or any(not safe_archive_name(name) for name in names)):
                raise ValueError("Word archive exceeds safety limits")
            if not {"[Content_Types].xml", "_rels/.rels", "word/document.xml"}.issubset(names):
                raise ValueError("Not a valid DOCX document")
            if any("vbaproject" in name.lower() or "/embeddings/" in name.lower()
                   or "/activex/" in name.lower() or "/oleobjects/" in name.lower()
                   for name in names):
                raise ValueError("Word documents with macros or embedded objects are not supported")
            if archive.testzip() is not None:
                raise ValueError("Word archive contains a damaged member")
            types = read_xml(archive, "[Content_Types].xml")
            if not any(node.get("PartName") == "/word/document.xml"
                       and node.get("ContentType") == DOCX_CONTENT_TYPE
                       for node in types.findall(CONTENT_TYPE + "Override")):
                raise ValueError("Not a non-macro DOCX document")
            if any("macroenabled" in (node.get("ContentType") or "").lower()
                   for node in types):
                raise ValueError("Macro-enabled Word documents are not supported")
            for name in names:
                if name.endswith(".rels"):
                    relationships = read_xml(archive, name)
                    for rel in relationships.findall(PACKAGE_REL + "Relationship"):
                        kind = (rel.get("Type") or "").rsplit("/", 1)[-1].lower()
                        if kind in {"oleobject", "package", "afchunk", "vbaproject", "attachedtemplate"}:
                            raise ValueError("Unsupported Word relationship")
                        if rel.get("TargetMode") == "External" and kind != "hyperlink":
                            raise ValueError("External Word objects are not supported")
            root = read_xml(archive, "word/document.xml")
            body = root.find(WORD + "body")
            if root.tag != WORD + "document" or body is None:
                raise ValueError("Invalid Word document root")
            if any(node.tag in {WORD + "altChunk", WORD + "object", WORD + "subDoc"}
                   for node in body.iter()):
                raise ValueError("Embedded Word content is not supported")
            paragraphs = []
            for paragraph in body.iter(WORD + "p"):
                parts = []
                for node in paragraph.iter():
                    if node.tag == WORD + "t":
                        parts.append(node.text or "")
                    elif node.tag == WORD + "tab":
                        parts.append("\t")
                    elif node.tag in {WORD + "br", WORD + "cr"}:
                        parts.append("\n")
                paragraphs.append("".join(parts))
            text = "\n".join(paragraphs)
            return text[:MAX_PREVIEW], len(text) > MAX_PREVIEW
    except (zipfile.BadZipFile, ET.ParseError, RuntimeError, NotImplementedError, KeyError,
            OSError, EOFError, zlib.error) as exc:
        raise ValueError("Invalid or unsupported DOCX file") from exc


def prepare_document(data, stem, extension):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,59}", stem):
        raise ValueError("Invalid document filename")
    if not data or len(data) >= MAX_BYTES:
        raise ValueError("Attachments must be nonempty and smaller than 10 MB")
    extra = {}
    # HTML uploads use a neutral .txt suffix on both public hosts.
    if extension == "html.txt":
        extension = "html"
    if extension == "pdf":
        if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-4096:]:
            raise ValueError("Not a valid PDF file")
        preview = []
    elif extension == "pptx":
        preview = preview_presentation(data)
    elif extension == "md":
        source, truncated = preview_markdown(data)
        preview = []
        extra = {"markdown_preview": source, "markdown_truncated": truncated}
    elif extension in ("html", "docx", "bib"):
        parser = {"html": preview_html, "docx": preview_word, "bib": preview_bibtex}[extension]
        source, truncated = parser(data)
        preview = []
        extra = {"document_preview": source, "document_truncated": truncated}
    else:
        raise ValueError("Only PDF, PPTX, Markdown, HTML, DOCX and BibTeX are supported")
    digest = hashlib.sha256(data).hexdigest()
    name = f"{stem}-{digest[:20]}.{extension}"
    anchor = f"asset-{stem}-{digest[:20]}" + (f"-{extension}" if extension in ("md", "html", "docx", "bib") else "")
    storage_name = name + ".txt" if extension == "html" else name
    return storage_name, {"id": anchor,
                  "name": name, "title": stem.replace("-", " "),
                  "format": extension.upper(), "bytes": len(data),
                  "sha256": digest, "slides": preview, **extra}


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

#!/usr/bin/env python3
"""Build typed terminal data from the same authoring sources as Jekyll.

The browser's terminal currently consumes Jekyll's /terminal.json. Keep that
stable until Python and Jekyll agree on their outputs in production CI; this
module is the independently implemented replacement, not a file-name trick.
"""

import json
from datetime import date, datetime, time, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


def read_yaml(root, path):
    with (root / path).open("r", encoding="utf-8") as stream:
        return yaml.safe_load(stream)


def require_dict(value, name):
    if not isinstance(value, dict):
        raise ValueError(f"{name}: expected object")
    return value


def nonempty(value, name):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name}: expected non-empty string")
    return value


def site_url(path, baseurl):
    if not isinstance(path, str) or not path.startswith("/") or path.startswith("//"):
        raise ValueError("Expected a site-rooted path")
    if not baseurl:
        return path
    prefix = "/" + baseurl.strip("/")
    return prefix + (path if path != "/" else "/")


def parse_front_matter(path):
    raw = path.read_text(encoding="utf-8")
    if not raw.startswith("---\n"):
        raise ValueError(f"Missing front matter: {path}")
    closing = raw.find("\n---\n", 4)
    if closing < 0:
        raise ValueError(f"Unclosed front matter: {path}")
    fields = yaml.safe_load(raw[4:closing])
    require_dict(fields, str(path))
    return fields


def published_posts(root):
    posts_dir = root / "_posts"
    posts = []
    if not posts_dir.exists():
        return posts
    for path in posts_dir.iterdir():
        if path.suffix not in (".md", ".markdown", ".html"):
            continue
        fields = parse_front_matter(path)
        dt = fields.get("date")
        if isinstance(dt, date) and not isinstance(dt, datetime):
            dt = datetime.combine(dt, time.min, tzinfo=timezone.utc)
        elif isinstance(dt, str):
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        if not isinstance(dt, datetime):
            raise ValueError(f"{path.name}: invalid date")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        # _config.yml timezone is UTC. Interpret absolute timestamps as UTC.
        dt = dt.astimezone(timezone.utc)
        if len(path.name) < 12 or path.name[4] != "-" or path.name[7] != "-" or path.name[10] != "-":
            raise ValueError(f"Invalid dated filename: {path.name}")
        slug = path.stem[11:]
        if not slug or "/" in slug:
            raise ValueError(f"Invalid post slug: {path.name}")
        title = nonempty(fields.get("title"), path.name + ".title")
        posts.append({
            "title": title,
            "url": f"/blog/{slug}/",
            "date": f"{dt.day} {dt.strftime('%b %Y')}",
            "tags": fields.get("tags") or [],
            "description": fields.get("description") or "",
            "_datetime": dt,
            "_source": path.name,
        })
    # Jekyll sorts site.posts in reverse date order, breaking ties by path.
    posts.sort(key=lambda x: (x["_datetime"], x["_source"]), reverse=True)
    return posts


def terminal_data(root=ROOT):
    config = require_dict(read_yaml(root, "_config.yml"), "config")
    nav = require_dict(read_yaml(root, "_data/navigation.yml"), "navigation")
    social = require_dict(read_yaml(root, "_data/social.yml"), "social")
    contact = require_dict(read_yaml(root, "_data/contact.yml"), "contact")
    github = require_dict(json.loads((root / "_data/github.json").read_text(encoding="utf-8")), "github")
    focus = read_yaml(root, "_data/focus.yml")
    technologies = read_yaml(root, "_data/technologies.yml")
    author = require_dict(config.get("author"), "author")
    profiles = require_dict(social.get("profiles"), "social.profiles")
    groups = require_dict(social.get("groups"), "social.groups")
    baseurl = config.get("baseurl", "")
    if not isinstance(baseurl, str):
        raise ValueError("baseurl: invalid string")
    emails = require_dict(contact.get("email"), "contact.email")
    nav_main = nav.get("main")
    if not isinstance(nav_main, list):
        raise ValueError("navigation.main must be a list")
    featured = []
    records = github.get("repositories") or []
    if not isinstance(records, list):
        raise ValueError("github.repositories must be a list")
    for name in github.get("featured") or []:
        matches = [record for record in records if record.get("name") == name]
        if matches:
            repo = matches[0]
            featured.append({
                "name": repo.get("name"),
                "url": repo.get("url"),
                "description": repo.get("description") or "",
                "language": repo.get("language"),
                "stars": repo.get("stars") or 0,
            })
    result = {
        "name": nonempty(author.get("name"), "author.name"),
        "username": nonempty(author.get("username"), "author.username"),
        "community": nonempty(author.get("community_username"), "author.community_username"),
        "tagline": nonempty(config.get("tagline"), "site.tagline"),
        "pages": [
            {"title": item["title"], "url": site_url(item["url"], baseurl)}
            for item in nav_main
        ],
        "profiles": [],
        "support": [],
        "emails": [
            {"label": "Business", "address": emails["business_primary"]},
            {"label": "Support", "address": emails["support"]},
        ],
        "focus": [{"title": area["title"], "summary": area["summary"]} for area in focus],
        "technologies": [
            {"group": item["group"], "items": item["items"]}
            for item in technologies
        ],
        "projects": None if not records else {
            "total": github.get("totals", {}).get("repositories") or 0,
            "stars": github.get("totals", {}).get("stars") or 0,
            "featured": featured,
        },
        "posts": [
            {"title": p["title"], "url": site_url(p["url"], baseurl), "date": p["date"]}
            for p in published_posts(root)[:5]
        ],
        "links": {
            "projects": site_url(config["projects_url"], baseurl),
            "blog": site_url("/blog/", baseurl),
            "feed": site_url("/blog/feed.xml", baseurl),
            "about": site_url("/about/", baseurl),
            "contact": site_url("/contact/", baseurl),
        }
    }
    for group_name in ("developer", "social"):
        for profile_key in groups[group_name]["items"]:
            profile = profiles[profile_key]
            if profile.get("url"):
                result["profiles"].append({
                    "key": profile_key,
                    "name": profile["name"],
                    "handle": profile.get("handle"),
                    "url": profile["url"],
                })
    for profile_key in groups["products"]["items"]:
        profile = profiles[profile_key]
        if profile.get("url"):
            result["support"].append({
                "key": profile_key,
                "name": profile["name"],
                "url": profile["url"],
                "note": profile.get("note"),
            })
    return result

def render_terminal_json(root=ROOT):
    """Deterministic UTF-8 JSON at the existing public terminal URL."""
    return json.dumps(terminal_data(root), ensure_ascii=False, indent=2) + "\n"


def write_terminal_json(root=ROOT):
    """Refresh the published feed after modifying posts or GitHub data."""
    output = root / "terminal.json"
    output.write_text(render_terminal_json(root), encoding="utf-8")
    return output


if __name__ == "__main__":
    print(render_terminal_json(), end="")

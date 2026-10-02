#!/usr/bin/env python3
"""Refreshes _data/github.json: the public GitHub repositories shown on the
Projects page (/projects/) and in the Home page's "Open source" section.

Run by .github/workflows/update-github-data.yml every day, whenever
_data/projects.yml changes, and from the Actions tab:

    python .github/scripts/update_github_data.py            fetch, save, commit, push
    python .github/scripts/update_github_data.py --dry-run  fetch and save only

Only public information is read: the account's public repositories and
their languages, the repositories pinned on the profile, and the
contribution calendar shown on the profile. The settings in
_data/projects.yml decide which repositories are shown and featured.

The file is rewritten, committed, and pushed only when something besides its
timestamp changed. Then GitHub Pages is asked to rebuild the site, because
pushes made by a workflow don't trigger a build. If GitHub can't be reached,
the script fails and the file is left as it was.
"""

import http.client
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SETTINGS = ROOT / "_data" / "projects.yml"
OUTPUT = ROOT / "_data" / "github.json"
API_URL = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
GRAPHQL_URL = os.environ.get("GITHUB_GRAPHQL_URL", API_URL + "/graphql")
USER_AGENT = "sanskarIN.github.io GitHub data"

MAX_FEATURED = 6
MAX_TOPICS = 6
MAX_LANGUAGES = 6  # in the language bar; the rest are grouped as "Other"
DEFAULT_COLOR = "#8b949e"

USERNAME = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?")
REPO_URL = re.compile(r"https://github\.com/[A-Za-z0-9-]+/[A-Za-z0-9._-]+")
WEB_URL = re.compile(r"https?://[^\s<>\"'`]{1,300}")
COLOR = re.compile(r"#[0-9A-Fa-f]{6}")
INVISIBLE = re.compile(r"[\x00-\x1f\x7f-\x9f​-‏ -‮⁦-⁩﻿]")

# Language colors from GitHub Linguist (MIT License). GitHub's GraphQL API
# returns these colors itself; this list is only used when that API can't be.
LANGUAGE_COLORS = {
    "Assembly": "#6E4C13", "Astro": "#ff5a03", "Batchfile": "#C1F12E", "C": "#555555",
    "C#": "#178600", "C++": "#f34b7d", "CMake": "#DA3434", "CSS": "#663399",
    "Clojure": "#db5855", "Dart": "#00B4AB", "Dockerfile": "#384d54", "Elixir": "#6e4a7e",
    "F#": "#b845fc", "GDScript": "#355570", "Go": "#00ADD8", "Groovy": "#4298b8",
    "HTML": "#e34c26", "Haskell": "#5e5086", "Java": "#b07219", "JavaScript": "#f1e05a",
    "Jupyter Notebook": "#DA5B0B", "Kotlin": "#A97BFF", "Lua": "#000080", "Makefile": "#427819",
    "Nix": "#7e7eff", "Objective-C": "#438eff", "PHP": "#4F5D95", "Perl": "#0298c3",
    "PowerShell": "#012456", "Python": "#3572A5", "R": "#198CE7", "Ruby": "#701516",
    "Rust": "#dea584", "SCSS": "#c6538c", "Scala": "#c22d40", "Shell": "#89e051",
    "Svelte": "#ff3e00", "Swift": "#F05138", "TypeScript": "#3178c6", "Vue": "#41b883",
    "WebAssembly": "#04133b", "Zig": "#ec915c",
}

CONTRIBUTION_LEVELS = {"NONE": 0, "FIRST_QUARTILE": 1, "SECOND_QUARTILE": 2,
                       "THIRD_QUARTILE": 3, "FOURTH_QUARTILE": 4}

PINNED_QUERY = """
query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes { ... on Repository { name owner { login } } }
    }
  }
}"""

CALENDAR_QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}"""

LANGUAGES_QUERY = """
query($login: String!, $after: String) {
  user(login: $login) {
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, privacy: PUBLIC) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        languages(first: 25, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
  }
}"""


# -----------------------------------------------------------------------------
# GitHub API
# -----------------------------------------------------------------------------

class GitHub:
    def __init__(self, token):
        self.token = token

    def send(self, method, url, body=None):
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("X-GitHub-Api-Version", "2022-11-28")
        req.add_header("User-Agent", USER_AGENT)
        if self.token:
            req.add_unredirected_header("Authorization", f"Bearer {self.token}")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    return response.status, response.headers, response.read()
            except urllib.error.HTTPError as error:
                if error.code >= 500 and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                return error.code, error.headers, error.read()
            except (OSError, http.client.HTTPException) as error:
                # Network errors: no connection, a dropped connection, a timeout.
                if attempt == 2:
                    raise RuntimeError(f"GitHub API {method} {url}: {error}") from error
                time.sleep(2 ** attempt)
        raise RuntimeError(f"GitHub API {method} {url} failed")

    def get(self, url):
        if url.startswith("/"):
            url = API_URL + url
        status, headers, raw = self.send("GET", url)
        if status != 200:
            raise RuntimeError(f"GitHub API GET {url} returned {status}: {raw[:300]!r}")
        return headers, json.loads(raw)

    def paginate(self, path):
        items, url = [], API_URL + path
        while url:
            headers, page = self.get(url)
            items.extend(page)
            url = None
            for part in (headers.get("Link") or "").split(","):
                match = re.search(r'<([^>]+)>;\s*rel="next"', part)
                if match and match.group(1).startswith(API_URL + "/"):
                    url = match.group(1)
        return items

    def graphql(self, query, variables):
        """The query's data, or None when the GraphQL API can't answer it."""
        try:
            status, _, raw = self.send("POST", GRAPHQL_URL, {"query": query, "variables": variables})
            payload = json.loads(raw) if raw else None
        except (RuntimeError, ValueError) as error:
            status, payload = None, {"errors": str(error)}
        if status == 200 and isinstance(payload, dict) and payload.get("data") and not payload.get("errors"):
            return payload["data"]
        detail = payload.get("errors") if isinstance(payload, dict) else payload
        print(f"::warning::GitHub's GraphQL API couldn't be used ({status}): {str(detail)[:300]}")
        return None

    def request_pages_build(self, repository):
        try:
            status, _, _ = self.send("POST", f"{API_URL}/repos/{repository}/pages/builds")
        except RuntimeError as error:
            status = str(error)
        if status == 201:
            print("Requested a GitHub Pages build.")
        else:
            print(f"::warning::Could not request a GitHub Pages build ({status}). "
                  "The new data appears after the next push to the repository.")


# -----------------------------------------------------------------------------
# Settings and cleaning
# -----------------------------------------------------------------------------

def load_settings():
    data = yaml.safe_load(SETTINGS.read_text(encoding="utf-8")) or {}
    login = str(data.get("github_user") or "").strip()
    if not USERNAME.fullmatch(login):
        raise SystemExit(f"_data/projects.yml: github_user {login!r} isn't a GitHub username.")

    def names(key):
        value = data.get(key) or []
        if not isinstance(value, list):
            raise SystemExit(f"_data/projects.yml: {key} must be a list of repository names.")
        return [str(item).strip() for item in value if str(item).strip()]

    return {
        "login": login,
        "featured": names("featured"),
        "hidden": {name.lower() for name in names("hidden")},
        "show_forks": data.get("show_forks") is True,
        "show_archived": data.get("show_archived") is not False,
    }


def clean_text(text, limit):
    """One line of plain text, shortened at a word boundary if it's long."""
    text = re.sub(r"\s+", " ", INVISIBLE.sub(" ", str(text or ""))).strip()
    if len(text) > limit:
        text = text[:limit - 1].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    return text


def day(timestamp):
    return str(timestamp)[:10] if timestamp else None


def homepage_of(repo):
    url = str(repo.get("homepage") or "").strip()
    if not WEB_URL.fullmatch(url) or url.rstrip("/").lower() == repo["html_url"].rstrip("/").lower():
        return None
    return url


def license_of(repo):
    info = repo.get("license") or {}
    spdx = info.get("spdx_id")
    if spdx and spdx != "NOASSERTION":
        return spdx
    return None


def color_of(language, colors):
    color = colors.get(language) or LANGUAGE_COLORS.get(language) or DEFAULT_COLOR
    return color if COLOR.fullmatch(color) else DEFAULT_COLOR


# -----------------------------------------------------------------------------
# Building the data
# -----------------------------------------------------------------------------

def shown_repositories(repos, settings):
    login = settings["login"].lower()
    shown = []
    for repo in repos:
        name = repo.get("name") or ""
        if repo.get("private") or (repo.get("owner") or {}).get("login", "").lower() != login:
            continue
        if not REPO_URL.fullmatch(repo.get("html_url") or ""):
            continue
        if name.lower() == login or name.lower() in settings["hidden"]:
            continue
        if repo.get("fork") and not settings["show_forks"]:
            continue
        if repo.get("archived") and not settings["show_archived"]:
            continue
        shown.append(repo)
    # Most recently changed first.
    shown.sort(key=lambda repo: (repo.get("pushed_at") or "", repo["name"].lower()), reverse=True)
    return shown


def repository_record(repo, colors):
    language = repo.get("language") or None
    return {
        "name": repo["name"],
        "url": repo["html_url"],
        "description": clean_text(repo.get("description"), 280),
        "homepage": homepage_of(repo),
        "language": language,
        "language_color": color_of(language, colors) if language else None,
        "stars": int(repo.get("stargazers_count") or 0),
        "forks": int(repo.get("forks_count") or 0),
        "topics": [clean_text(topic, 50) for topic in (repo.get("topics") or [])][:MAX_TOPICS],
        "license": license_of(repo),
        "fork": bool(repo.get("fork")),
        "archived": bool(repo.get("archived")),
        "created": day(repo.get("created_at")),
        "pushed": day(repo.get("pushed_at") or repo.get("updated_at")),
    }


def language_sizes(gh, login, repos):
    """{repository name (lowercase): {language: bytes}} and {language: color}."""
    sizes, colors, after = {}, {}, None
    while True:
        data = gh.graphql(LANGUAGES_QUERY, {"login": login, "after": after})
        if data is None:
            break
        page = data["user"]["repositories"]
        for node in page["nodes"]:
            languages = {}
            for edge in node["languages"]["edges"]:
                languages[edge["node"]["name"]] = int(edge["size"])
                if edge["node"].get("color"):
                    colors[edge["node"]["name"]] = edge["node"]["color"]
            sizes[node["name"].lower()] = languages
        if not page["pageInfo"]["hasNextPage"]:
            return sizes, colors
        after = page["pageInfo"]["endCursor"]
    # Without GraphQL: one REST request per repository.
    sizes = {}
    for repo in repos:
        if not repo.get("fork"):
            _, languages = gh.get(f"/repos/{repo['full_name']}/languages")
            sizes[repo["name"].lower()] = {name: int(size) for name, size in languages.items()}
    return sizes, {}


def language_summary(repos, sizes, colors):
    """The languages of the repositories (not forks), largest first."""
    totals = {}
    for repo in repos:
        if repo.get("fork"):
            continue
        for name, size in sizes.get(repo["name"].lower(), {}).items():
            totals[name] = totals.get(name, 0) + size
    grand = sum(totals.values())
    if not grand:
        return [], 0
    ranked = sorted(totals.items(), key=lambda item: (-item[1], item[0]))
    shown, rest = ranked[:MAX_LANGUAGES], ranked[MAX_LANGUAGES:]
    if len(rest) == 1:
        shown, rest = ranked, []
    summary = [{"name": name, "color": color_of(name, colors), "percent": round(100 * size / grand, 1)}
               for name, size in shown]
    if rest:
        summary.append({"name": "Other", "color": DEFAULT_COLOR,
                        "percent": round(100 * sum(size for _, size in rest) / grand, 1), "other": True})
    return summary, len(totals)


def pinned_names(gh, login):
    data = gh.graphql(PINNED_QUERY, {"login": login})
    if data is None or not data.get("user"):
        return []
    return [node["name"] for node in data["user"]["pinnedItems"]["nodes"]
            if node and (node.get("owner") or {}).get("login", "").lower() == login.lower()]


def featured_names(records, settings, pinned):
    by_name = {record["name"].lower(): record["name"] for record in records}
    for candidates in (settings["featured"], pinned):
        chosen = []
        for name in candidates:
            actual = by_name.get(name.lower())
            if actual and actual not in chosen:
                chosen.append(actual)
        if chosen:
            return chosen[:MAX_FEATURED]
    ranked = sorted((record for record in records if not record["fork"] and not record["archived"]),
                    key=lambda record: (-record["stars"], -int((record["pushed"] or "0").replace("-", ""))))
    return [record["name"] for record in ranked[:MAX_FEATURED]]


def activity(gh, login):
    """The contribution calendar shown on the GitHub profile, or None."""
    data = gh.graphql(CALENDAR_QUERY, {"login": login})
    if data is None or not data.get("user"):
        return None
    calendar = data["user"]["contributionsCollection"]["contributionCalendar"]
    days = sorted((d for week in calendar["weeks"] for d in week["contributionDays"]), key=lambda d: d["date"])
    if not days:
        return None
    counts = [int(d["contributionCount"]) for d in days]
    levels = [CONTRIBUTION_LEVELS.get(d["contributionLevel"], 0) for d in days]
    start = date.fromisoformat(days[0]["date"])
    first_weekday = (start.weekday() + 1) % 7  # Sunday is 0, as on GitHub
    weeks = (len(days) + first_weekday + 6) // 7

    # A month label above the first column that starts in that month.
    months, previous = [], None
    for week in range(weeks):
        sunday = start + timedelta(days=7 * week - first_weekday)
        if sunday.month != previous:
            months.append({"week": week, "label": sunday.strftime("%b")})
            previous = sunday.month
    if len(months) > 1 and months[1]["week"] < 3:
        months.pop(0)  # too little of the first month to label it

    longest = current = 0
    for count in counts:
        current = current + 1 if count else 0
        longest = max(longest, current)
    busiest = max(range(len(counts)), key=lambda i: (counts[i], -i))
    return {
        "total": int(calendar["totalContributions"]),
        "start": days[0]["date"],
        "end": days[-1]["date"],
        "first_weekday": first_weekday,
        "weeks": weeks,
        "counts": counts,
        "levels": levels,
        "months": months,
        "active_days": sum(1 for count in counts if count),
        "longest_streak": longest,
        "busiest": {"date": days[busiest]["date"], "count": counts[busiest]} if counts[busiest] else None,
    }


def build(gh, settings):
    login = settings["login"]
    _, user = gh.get(f"/users/{login}")
    repos = gh.paginate(f"/users/{login}/repos?type=owner&sort=pushed&per_page=100")
    shown = shown_repositories(repos, settings)
    sizes, colors = language_sizes(gh, login, shown)
    records = [repository_record(repo, colors) for repo in shown]
    languages, language_count = language_summary(shown, sizes, colors)
    return {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "user": {"login": user.get("login") or login, "url": f"https://github.com/{user.get('login') or login}"},
        "totals": {
            "repositories": len(records),
            "stars": sum(record["stars"] for record in records),
            "forks": sum(record["forks"] for record in records),
            "languages": language_count,
        },
        "languages": languages,
        "featured": featured_names(records, settings, pinned_names(gh, login)),
        "repositories": records,
        "activity": activity(gh, login),
    }


def comparable(data, own_repository):
    """The data without what changes on every run: the timestamp, and the
    last-push date of this website's own repository (each update pushes)."""
    copy = json.loads(json.dumps(data))
    copy.pop("generated_at", None)
    for repo in copy.get("repositories") or []:
        if repo.get("name", "").lower() == own_repository:
            repo.pop("pushed", None)
    return copy


# -----------------------------------------------------------------------------
# Saving
# -----------------------------------------------------------------------------

def git(*args, check=True):
    env = dict(os.environ)
    name, email = os.environ["COMMIT_NAME"], os.environ["COMMIT_EMAIL"]
    env.update(GIT_AUTHOR_NAME=name, GIT_AUTHOR_EMAIL=email, GIT_COMMITTER_NAME=name, GIT_COMMITTER_EMAIL=email)
    result = subprocess.run(["git", *args], cwd=ROOT, env=env, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(f"git {args[0]} failed: {result.stderr.strip()}")
    return result


def commit_and_push(branch):
    path = str(OUTPUT.relative_to(ROOT))
    git("add", "--", path)
    if git("diff", "--cached", "--quiet", check=False).returncode == 0:
        return False
    git("commit", "--quiet", "-m", "Update GitHub data for the Projects page")
    for attempt in range(5):
        if git("push", "--quiet", "origin", f"HEAD:{branch}", check=False).returncode == 0:
            print("Pushed the new data.")
            return True
        time.sleep(2 ** attempt)
        git("pull", "--quiet", "--rebase", "origin", branch)
    raise RuntimeError("The data was committed but could not be pushed.")


def main(argv):
    dry_run = "--dry-run" in argv
    repository = os.environ.get("GITHUB_REPOSITORY", "sanskarIN/sanskarIN.github.io")
    settings = load_settings()
    gh = GitHub(os.environ.get("GITHUB_TOKEN", ""))
    data = build(gh, settings)

    old = None
    if OUTPUT.exists():
        try:
            old = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except ValueError:
            old = None
    own = repository.split("/")[-1].lower()
    print(f"{data['totals']['repositories']} repositories, {data['totals']['stars']} stars, "
          f"{data['totals']['languages']} languages; featured: {', '.join(data['featured']) or 'none'}; "
          f"activity: {'yes' if data['activity'] else 'unavailable'}.")
    if old is not None and comparable(old, own) == comparable(data, own):
        print("No changes.")
        return 0

    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {OUTPUT.relative_to(ROOT)}.")
    if not dry_run and commit_and_push(os.environ.get("BRANCH", "main")):
        gh.request_pages_build(repository)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""Stage website-generated changes on reviewable GitHub pull requests.

The automation branches are intentionally separate from protected main.
A closed PR's old branch can be reused with an exact force-with-lease;
an open PR is updated without rewriting its history.
"""

import json
import os
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SAFE_BRANCH = re.compile(r"automation/(?:github-data|blog-post-[1-9][0-9]*)\Z")


def git(*args, check=True):
    env = dict(os.environ)
    name = env.get("COMMIT_NAME", "sanskarIN")
    email = env.get("COMMIT_EMAIL", "sanskarin@outlook.in")
    env.update(GIT_AUTHOR_NAME=name, GIT_AUTHOR_EMAIL=email,
               GIT_COMMITTER_NAME=name, GIT_COMMITTER_EMAIL=email)
    proc = subprocess.run(["git", *args], cwd=ROOT, env=env,
                          text=True, capture_output=True, check=False)
    if check and proc.returncode:
        raise RuntimeError(
            f"git {args[0]} failed (exit {proc.returncode}): "
            f"{proc.stderr.strip() or proc.stdout.strip()}"
        )
    return proc


class Proposal:
    """One automation branch, optionally backed by an existing open PR."""

    def __init__(self, branch, title, body, base="main"):
        if not SAFE_BRANCH.fullmatch(branch):
            raise ValueError(f"Unsafe automation branch: {branch!r}")
        self.repo = os.environ["GITHUB_REPOSITORY"]
        self.token = os.environ["GITHUB_TOKEN"]
        self.branch = branch
        self.base = base
        self.title = title
        self.body = body
        self.open_pr = None
        self.replace_sha = None
        self.prepared = False

    def api(self, method, path, data=None):
        host = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
        body = json.dumps(data).encode("utf-8") if data is not None else None
        request = urllib.request.Request(host + path, method=method, data=body, headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self.token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "sanskarIN.github.io content automation",
        })
        if body is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:500]
            raise RuntimeError(
                f"GitHub {method} {path}: HTTP {error.code}: {detail}"
            ) from error

    def find_pr(self):
        owner = self.repo.split("/", 1)[0]
        query = urllib.parse.urlencode({
            "state": "open", "base": self.base,
            "head": f"{owner}:{self.branch}", "per_page": "100",
        })
        result = self.api("GET", f"/repos/{self.repo}/pulls?{query}")
        return next((p for p in result
                     if p.get("head", {}).get("ref") == self.branch
                     and p.get("base", {}).get("ref") == self.base), None)

    def prepare(self):
        """Run before reading or modifying generated files."""
        git("fetch", "--quiet", "origin")
        self.open_pr = self.find_pr()
        remote = git("ls-remote", "--heads", "origin",
                     f"refs/heads/{self.branch}").stdout.strip()
        remote_sha = remote.split()[0] if remote else None
        if self.open_pr and not remote_sha:
            raise RuntimeError("The open automation PR has no remote branch.")
        if self.open_pr:
            git("checkout", "-B", self.branch, f"origin/{self.branch}")
        else:
            # A previously merged/closed PR may leave a stale branch behind.
            # Start clean from main; replace that branch only with an exact lease.
            git("checkout", "-B", self.branch, f"origin/{self.base}")
            self.replace_sha = remote_sha
        self.prepared = True

    @property
    def url(self):
        return self.open_pr.get("html_url") if self.open_pr else None

    def cancel(self):
        """Withdraw a pending PR when a post becomes unapproved or invalid."""
        if self.open_pr:
            self.api("PATCH", f"/repos/{self.repo}/pulls/{self.open_pr['number']}",
                     {"state": "closed"})
            print(f"Closed obsolete proposal: {self.url}")
            self.open_pr = None

    def propose(self, message):
        """Commit staged changes, push to the automation branch, open a PR.

        Returns the open PR URL, or None if main already matches the output.
        """
        if not self.prepared:
            raise RuntimeError("Call prepare() before proposing changes.")
        status = git("diff", "--cached", "--quiet", check=False).returncode
        if status == 0:
            return self.url
        if status != 1:
            raise RuntimeError(f"Could not inspect staged changes: git diff exit {status}")
        git("commit", "--quiet", "-m", message)
        # A submitted post can be withdrawn before first publication.
        # When that leaves no PR diff, do not propose an empty change.
        diff = git("diff", "--quiet", f"origin/{self.base}...HEAD",
                   check=False).returncode
        if diff == 0:
            self.cancel()
            return None
        if diff != 1:
            raise RuntimeError(f"Could not compare proposal to main: exit {diff}")
        push_args = ["push", "--quiet"]
        if self.replace_sha:
            push_args.append(
                f"--force-with-lease=refs/heads/{self.branch}:{self.replace_sha}"
            )
        push_args.extend(["origin", f"HEAD:refs/heads/{self.branch}"])
        git(*push_args)
        if not self.open_pr:
            try:
                self.open_pr = self.api("POST", f"/repos/{self.repo}/pulls", {
                    "title": self.title, "head": self.branch,
                    "base": self.base, "body": self.body,
                    "maintainer_can_modify": True,
                })
            except RuntimeError as error:
                raise RuntimeError(
                    f"{error} (GitHub Actions must be allowed to create pull requests "
                    "under repository Settings > Actions > General.)"
                ) from error
        print(f"Changes proposed for review: {self.url}")
        return self.url

#!/usr/bin/env python3
"""Sets up accounts on Supabase and turns them on: sign-up and sign-in with an
emailed 6-digit code, author profiles, and writing posts on the website.

Run by .github/workflows/setup-accounts.yml from the Actions tab, and whenever
supabase/ changes on main:

    python3 .github/scripts/setup_accounts.py              set up, commit, push
    python3 .github/scripts/setup_accounts.py --no-commit  set up, save only

It does what README.md → "Setting up accounts" describes, through the
Supabase Management API:

  1. checks the GitHub token for the function, and that the project is
     running (waiting while it starts);
  2. runs supabase/schema.sql: the tables, the image bucket, and the rules;
  3. sets up sign-in: 6-digit codes that work for 10 minutes, the email
     templates, the site address, and the SMTP service that sends the emails;
  4. gives the "blog" Edge Function the GitHub token and deploys it;
  5. checks that sign-in, the database, and the function answer;
  6. writes the project address, its publishable key, and the email service
     to _data/accounts.yml (with new policy dates in _data/legal.yml when the
     policies change), commits, pushes, and asks GitHub Pages to rebuild.

Settings, from the workflow's secrets and variables:

  SUPABASE_ACCESS_TOKEN  a Supabase personal access token (sbp_…)
  SUPABASE_PROJECT_REF   the project's reference ID, or its address
  BLOG_GITHUB_TOKEN      the function's GitHub token: this repository only,
                         with Issues: Read and write
  SMTP_USER              the login of the service that sends the emails;
  SMTP_PASSWORD          Gmail and Brevo are recognised from the login. Leave
                         both empty to keep SMTP settings made in Supabase.
  SMTP_HOST, SMTP_PORT, SMTP_SENDER_EMAIL, SMTP_SENDER_NAME,
  EMAIL_SERVICE, EMAIL_SERVICE_PRIVACY_URL
                         optional: for other services, or to change the
                         defaults

When it runs for a push, it only keeps an existing setup up to date: it does
nothing while the secrets are missing or accounts are off. The tokens and the
password go only to Supabase; they are never printed or written to the
repository.
"""

import base64
import http.client
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "_config.yml"
ACCOUNTS = ROOT / "_data" / "accounts.yml"
LEGAL = ROOT / "_data" / "legal.yml"
SCHEMA = ROOT / "supabase" / "schema.sql"
FUNCTIONS = ROOT / "supabase" / "functions"
API_URL = "https://api.supabase.com/v1"
GITHUB_API_URL = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
USER_AGENT = "sanskarIN.github.io accounts setup"

CODE_LENGTH = 6    # the account page asks for a 6-digit code
CODE_MINUTES = 10  # how long a code works
WAIT_MINUTES = 10  # how long to wait for a project that is starting
CHECK_MINUTES = 3  # how long to wait for the checks to pass after the changes
TOKEN_WARNING_DAYS = 14
POLICIES = ("terms", "privacy", "cookies", "accessibility")

SUBJECT = "Your sign-in code for sanskarIN.github.io"
TEMPLATE = """<h2>Your sign-in code</h2>
<p>Enter this code on sanskarIN.github.io to sign in: <strong>{{ .Token }}</strong></p>
<p>It works once and expires in %d minutes. If you didn't ask for it, you can ignore this email.</p>
""" % CODE_MINUTES

# SMTP services recognised from SMTP_HOST ("gmail", "brevo", or a host name
# below) or, without SMTP_HOST, from SMTP_USER. With Gmail the login is also
# the sender; Brevo gives a separate login, so SMTP_SENDER_EMAIL is needed.
# For any other service, set SMTP_HOST, EMAIL_SERVICE and
# EMAIL_SERVICE_PRIVACY_URL.
EMAIL_SERVICES = {
    "gmail": {
        "name": "Gmail",
        "privacy": "https://policies.google.com/privacy",
        "hosts": ("smtp.gmail.com", "smtp.googlemail.com"),
        "logins": ("@gmail.com", "@googlemail.com"),
        "login_is_sender": True,
    },
    "brevo": {
        "name": "Brevo",
        "privacy": "https://www.brevo.com/legal/privacypolicy/",
        "hosts": ("smtp-relay.brevo.com", "smtp-relay.sendinblue.com"),
        "logins": ("@smtp-brevo.com",),
        "login_is_sender": False,
    },
}

PROJECT_REF = re.compile(r"(?<![a-z])[a-z]{20}(?![a-z])")
# The pattern Supabase checks sender addresses against.
EMAIL = re.compile(r"(?!\.)(?!.*\.\.)[A-Za-z0-9_'+\-.]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}")
HOST = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?")
NAME = re.compile(r"[a-z0-9][a-z0-9_-]{0,62}")
PUBLISHABLE_KEY = re.compile(r"sb_publishable_[A-Za-z0-9_-]{8,}")
JWT = re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")

CHECK_SQL = """select
  to_regclass('public.profiles') is not null as profiles,
  to_regclass('public.submissions') is not null as submissions,
  exists (select 1 from storage.buckets where id = '%s' and public) as bucket,
  coalesce((select bool_and(relrowsecurity) from pg_class
            where oid in (to_regclass('public.profiles'), to_regclass('public.submissions'))), false)
    as row_security;"""

SECRETS = []


class SetupError(Exception):
    """A problem the person running the setup can fix; the message says how."""


class NetworkError(Exception):
    """No answer: no connection, a dropped connection, or a timeout."""


# -----------------------------------------------------------------------------
# Small helpers
# -----------------------------------------------------------------------------

def setting(name):
    return (os.environ.get(name) or "").strip()


def keep_secret(value):
    """Hides value in the workflow's log, and in every message this script prints."""
    if value and value not in SECRETS:
        SECRETS.append(value)
        if os.environ.get("GITHUB_ACTIONS") == "true":
            print(f"::add-mask::{value}")


def scrub(text):
    for value in SECRETS:
        text = text.replace(value, "***")
    return text


def and_list(items):
    items = list(items)
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def readable(status):
    return str(status).lower().replace("_", " ")


def parse_json(raw):
    try:
        return json.loads(raw) if raw else None
    except ValueError:
        return None


def error_detail(raw):
    """The message in an error response, on one line."""
    data = parse_json(raw)
    if isinstance(data, dict):
        for key in ("message", "msg", "error_description", "error"):
            if isinstance(data.get(key), str) and data[key]:
                return scrub(" ".join(data[key].split()))[:300]
    text = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else str(raw or "")
    return scrub(" ".join(text.split()))[:300] or "no details"


def summary(*lines):
    """Adds lines to the run's summary on GitHub."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as file:
            file.write("\n".join(lines) + "\n")


# -----------------------------------------------------------------------------
# Reading and writing one-line YAML values, keeping the files' comments
# -----------------------------------------------------------------------------

def read_value(text, key):
    """The value of a top-level `key: value` line, or "" when there's none."""
    match = re.search(rf"(?m)^{re.escape(key)}:(.*)$", text)
    if not match:
        return ""
    rest = match.group(1).strip()
    if rest.startswith('"'):
        quoted = re.match(r'"(?:[^"\\]|\\.)*"', rest)
        if quoted:
            value = parse_json(quoted.group(0))
            return value if isinstance(value, str) else quoted.group(0)[1:-1]
    if rest.startswith("'"):
        quoted = re.match(r"'(?:[^']|'')*'", rest)
        if quoted:
            return quoted.group(0)[1:-1].replace("''", "'")
    return re.split(r"\s+#", rest, maxsplit=1)[0].strip()


def write_value(text, key, value, quote=True):
    line = f"{key}: {json.dumps(value) if quote else value}"
    new, count = re.subn(rf"(?m)^{re.escape(key)}:.*$", lambda _: line, text, count=1)
    if count != 1:
        raise SetupError(f"There's no `{key}:` line to fill in.")
    return new


def site_setting(name):
    """A top-level value from _config.yml, such as url or title."""
    return read_value(CONFIG.read_text(encoding="utf-8"), name)


# -----------------------------------------------------------------------------
# HTTP
# -----------------------------------------------------------------------------

def send(method, url, headers, data=None, timeout=60):
    """One request: (status, headers, body). NetworkError when there's no answer."""
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("User-Agent", USER_AGENT)
    for name, value in headers.items():
        if name.lower() == "authorization":
            request.add_unredirected_header(name, value)
        else:
            request.add_header(name, value)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()
    except (OSError, http.client.HTTPException) as error:
        raise NetworkError(scrub(str(error))) from error


def retry_delay(headers, attempt):
    try:
        return min(max(int(headers.get("Retry-After", "")), 1), 60)
    except (TypeError, ValueError):
        return 2 ** attempt


class Supabase:
    """The Supabase Management API, for one project."""

    def __init__(self, token, ref):
        self.token, self.ref = token, ref

    def request(self, method, path, body=None, content_type=None):
        url = f"{API_URL}/projects/{self.ref}{path}"
        headers = {"Authorization": f"Bearer {self.token}", "Accept": "application/json"}
        data = body
        if body is not None and content_type is None:
            data, content_type = json.dumps(body).encode("utf-8"), "application/json"
        if content_type:
            headers["Content-Type"] = content_type
        for attempt in range(5):
            try:
                status, response_headers, raw = send(method, url, headers, data, timeout=120)
            except NetworkError as error:
                if attempt == 4:
                    raise SetupError(f"Supabase couldn't be reached: {error}") from error
                time.sleep(2 ** attempt)
                continue
            if (status == 429 or status >= 500) and attempt < 4:
                time.sleep(retry_delay(response_headers, attempt))
                continue
            break
        if 200 <= status < 300:
            return parse_json(raw)
        raise SetupError(self.explain(method, path, status, raw))

    def explain(self, method, path, status, raw):
        detail = error_detail(raw)
        if status == 401:
            return ("Supabase didn't accept SUPABASE_ACCESS_TOKEN (401). Create a new access token at "
                    "https://supabase.com/dashboard/account/tokens and update the secret.")
        if status == 403:
            return (f"SUPABASE_ACCESS_TOKEN isn't allowed to manage this project (403: {detail}). "
                    "Use a token from an account that owns or administers it.")
        if status == 404 and path == "":
            return (f"There's no Supabase project {self.ref} for this access token. Check SUPABASE_PROJECT_REF, "
                    "and that the token comes from the account that has the project.")
        return f"Supabase answered {status} to {method} {path.split('?')[0] or '/'}: {detail}"


# -----------------------------------------------------------------------------
# The steps
# -----------------------------------------------------------------------------

def project_ref(value):
    match = PROJECT_REF.search(value.lower())
    if not match:
        raise SetupError("SUPABASE_PROJECT_REF should be the project's reference ID: the 20 letters in its address, "
                         "https://<reference ID>.supabase.co (Project Settings → General).")
    return match.group(0)


def check_blog_token(token, repository):
    """Checks that the function's GitHub token can open issues here, without opening one:
    an issue without a title is refused (422) only after the permissions are checked."""
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"}
    try:
        status, response_headers, raw = send("POST", f"{GITHUB_API_URL}/repos/{repository}/issues", headers, b"{}", 30)
    except NetworkError as error:
        print(f"::warning::BLOG_GITHUB_TOKEN couldn't be checked: {error}")
        return
    if status == 401:
        raise SetupError("GitHub didn't accept BLOG_GITHUB_TOKEN (401): it has expired or was deleted. "
                         "Create a new one (README.md → Setting up accounts) and update the secret.")
    if status in (403, 404):
        raise SetupError(f"BLOG_GITHUB_TOKEN can't open issues in {repository} ({status}). It needs access to "
                         "this repository with the permission Issues: Read and write.")
    if status == 410:
        raise SetupError(f"Issues are turned off in {repository}, and posts from accounts become issues. "
                         "Turn them on in Settings → General → Features.")
    if status != 422:
        print(f"::warning::BLOG_GITHUB_TOKEN couldn't be checked: GitHub answered {status} ({error_detail(raw)}).")
        return
    expires = (response_headers.get("GitHub-Authentication-Token-Expiration") or "")[:10]
    try:
        days = (datetime.strptime(expires, "%Y-%m-%d").date() - datetime.now(timezone.utc).date()).days
    except ValueError:
        print("BLOG_GITHUB_TOKEN can open issues here.")
        return
    print(f"BLOG_GITHUB_TOKEN can open issues here; it expires on {expires}.")
    if days <= TOKEN_WARNING_DAYS:
        print(f"::warning::BLOG_GITHUB_TOKEN expires on {expires}. Before then, create a new one, update the "
              "secret, and run this workflow again; until you do, accounts can't send posts.")


def running_project(api):
    """The project's details, once it is running."""
    deadline = time.monotonic() + WAIT_MINUTES * 60
    while True:
        project = api.request("GET", "") or {}
        status = project.get("status") or "UNKNOWN"
        if status == "ACTIVE_HEALTHY":
            return project
        if status == "ACTIVE_UNHEALTHY":
            print("::warning::Supabase reports the project as running but unhealthy; continuing anyway.")
            return project
        if status in ("INACTIVE", "PAUSING", "PAUSE_FAILED", "GOING_DOWN"):
            raise SetupError("The Supabase project is paused. Restore it in the Supabase dashboard "
                             "(https://supabase.com/dashboard), wait until it is running, then run this workflow again.")
        if status in ("REMOVED", "INIT_FAILED", "RESTORE_FAILED"):
            raise SetupError(f"The Supabase project can't be used ({readable(status)}). Check it in the Supabase dashboard.")
        if time.monotonic() >= deadline:
            raise SetupError(f"The Supabase project is still {readable(status)} after {WAIT_MINUTES} minutes. "
                             "Run this workflow again later.")
        print(f"The project is {readable(status)}; waiting…")
        time.sleep(15)


def known_service(host, login):
    host, login = host.lower(), login.lower()
    for key, service in EMAIL_SERVICES.items():
        if host == key or host in service["hosts"] or (not host and login.endswith(service["logins"])):
            return service
    return None


def email_settings(current, accounts, sender_name):
    """The SMTP settings to save in Supabase (none, to keep the current ones), and the
    name and privacy policy of the service that sends the emails."""
    login, password, host = setting("SMTP_USER"), setting("SMTP_PASSWORD"), setting("SMTP_HOST")
    smtp = {}
    if login or password or host:
        if not (login and password):
            raise SetupError("Set both SMTP_USER and SMTP_PASSWORD (or neither, to keep the SMTP settings "
                             "made in the Supabase dashboard).")
        service = known_service(host, login)
        if service and host.lower() not in service["hosts"]:
            host = service["hosts"][0]
        if not host:
            raise SetupError("Set SMTP_HOST to the SMTP server of the service that sends the emails. "
                             "Gmail and Brevo are recognised from SMTP_USER.")
        if not HOST.fullmatch(host):
            raise SetupError("SMTP_HOST should be a host name, such as smtp.example.com.")
        port = setting("SMTP_PORT") or "587"
        if not (port.isdigit() and 0 < int(port) < 65536):
            raise SetupError("SMTP_PORT should be a port number, such as 587.")
        if service is EMAIL_SERVICES["gmail"]:
            # App passwords are shown in groups of four; the spaces aren't part of them.
            password = re.sub(r"\s+", "", password)
            keep_secret(password)
        sender = setting("SMTP_SENDER_EMAIL")
        if not sender and (service is None or service["login_is_sender"]) and EMAIL.fullmatch(login):
            sender = login
        if not sender:
            raise SetupError("Set SMTP_SENDER_EMAIL to the address the emails come from "
                             "(with Brevo, a sender you have added there).")
        if not EMAIL.fullmatch(sender):
            raise SetupError("SMTP_SENDER_EMAIL should be an email address.")
        smtp = {
            "smtp_host": host,
            "smtp_port": port,
            "smtp_user": login,
            "smtp_pass": password,
            "smtp_admin_email": sender,
            "smtp_sender_name": setting("SMTP_SENDER_NAME") or sender_name,
        }
    elif current.get("smtp_host"):
        service = known_service(str(current.get("smtp_host") or ""), str(current.get("smtp_user") or ""))
    else:
        raise SetupError("Add SMTP_USER and SMTP_PASSWORD for the service that sends the sign-in codes. Without "
                         "one, Supabase sends emails only to the members of your Supabase team, so visitors "
                         "couldn't sign up. README.md → Setting up accounts explains how.")

    name = setting("EMAIL_SERVICE") or (service["name"] if service else "")
    privacy = setting("EMAIL_SERVICE_PRIVACY_URL") or (service["privacy"] if service else "")
    if not name and not smtp:
        name, privacy = accounts["email_service"], accounts["email_service_privacy_url"]
    if not name or not re.fullmatch(r"[^\x00-\x1f\x7f]{1,60}", name):
        raise SetupError("Set EMAIL_SERVICE to the name of the service that sends the emails, such as Mailjet: "
                         "the Privacy Policy names it.")
    if not re.fullmatch(r"https://[^\s\"'<>]+", privacy):
        raise SetupError("Set EMAIL_SERVICE_PRIVACY_URL to the address of the email service's privacy policy "
                         "(https://…): the Privacy Policy links to it.")
    return smtp, name, privacy


def set_up_database(api, bucket):
    api.request("POST", "/database/query", {"query": SCHEMA.read_text(encoding="utf-8")})
    # The API picks up new tables by itself; this makes it happen right away.
    api.request("POST", "/database/query", {"query": "notify pgrst, 'reload schema';"})
    rows = api.request("POST", "/database/query", {"query": CHECK_SQL % bucket})
    row = rows[0] if isinstance(rows, list) and rows and isinstance(rows[0], dict) else {}
    missing = [label for key, label in (("profiles", "the profiles table"), ("submissions", "the submissions table"),
                                        ("bucket", f"the public {bucket} bucket"),
                                        ("row_security", "row-level security on both tables"))
               if row.get(key) is not True]
    if missing:
        raise SetupError(f"supabase/schema.sql ran, but {and_list(missing)} {'is' if len(missing) == 1 else 'are'} "
                         "missing. Run it in the SQL Editor to see what went wrong.")
    print("Database: the tables, the image bucket, and their security rules are in place.")

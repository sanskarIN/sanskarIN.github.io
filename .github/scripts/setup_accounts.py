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

"""Regression tests for protected-branch content automation (no network)."""

import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pr_updates import Proposal


class ProposalTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "GITHUB_REPOSITORY": "owner/site",
            "GITHUB_TOKEN": "test-token",
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    def git_result(self, *args, check=True):
        self.calls.append(args)
        if args[0] == "ls-remote":
            return subprocess.CompletedProcess(args, 0, self.remote)
        if args[:3] == ("diff", "--cached", "--quiet"):
            return subprocess.CompletedProcess(args, self.staged)
        if args[:2] == ("diff", "--quiet"):
            return subprocess.CompletedProcess(args, self.net_diff)
        return subprocess.CompletedProcess(args, 0, "")

    def setup_mock(self, remote="", staged=1, net_diff=1, open_pr=None):
        self.calls = []
        self.remote = remote
        self.staged = staged
        self.net_diff = net_diff
        self.pr = open_pr
        self.git_patch = patch("pr_updates.git", side_effect=self.git_result)
        self.find_patch = patch.object(Proposal, "find_pr", return_value=open_pr)
        self.git_patch.start()
        self.find_patch.start()
        self.addCleanup(self.git_patch.stop)
        self.addCleanup(self.find_patch.stop)

    def test_rejects_untrusted_branch_names(self):
        for name in ("main", "automation/blog-post-0", "automation/../main",
                     "automation/github-data-extra", "automation/blog-post-3/escape"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                Proposal(name, "title", "body")

    def test_fresh_proposal_uses_unprotected_branch(self):
        self.setup_mock()
        p = Proposal("automation/github-data", "Refresh data", "Review this")
        p.prepare()
        with patch.object(p, "api", return_value={"html_url": "https://github.com/owner/site/pull/7"}):
            self.assertEqual(p.propose("Refresh"), "https://github.com/owner/site/pull/7")
        self.assertIn(("checkout", "-B", "automation/github-data", "origin/main"), self.calls)
        self.assertIn(("push", "--quiet", "origin",
                       "HEAD:refs/heads/automation/github-data"), self.calls)
        self.assertNotIn(("push", "--quiet", "origin", "HEAD:main"), self.calls)

    def test_existing_open_pr_is_updated_without_force(self):
        open_pr = {"number": 7, "html_url": "https://github.com/owner/site/pull/7"}
        self.setup_mock(remote="abcdef\trefs/heads/automation/blog-post-49",
                        open_pr=open_pr)
        p = Proposal("automation/blog-post-49", "Update post", "Review this")
        p.prepare()
        with patch.object(p, "api") as api:
            self.assertEqual(p.propose("Edit post"), open_pr["html_url"])
            api.assert_not_called()
        self.assertIn(("checkout", "-B", "automation/blog-post-49",
                       "origin/automation/blog-post-49"), self.calls)
        self.assertIn(("push", "--quiet", "origin",
                       "HEAD:refs/heads/automation/blog-post-49"), self.calls)

    def test_previous_closed_pr_branch_uses_exact_lease(self):
        self.setup_mock(remote="abc123\trefs/heads/automation/github-data")
        p = Proposal("automation/github-data", "Refresh data", "Review this")
        p.prepare()
        with patch.object(p, "api", return_value={"html_url": "https://github.com/owner/site/pull/8"}):
            p.propose("Refresh")
        self.assertIn(("push", "--quiet",
                       "--force-with-lease=refs/heads/automation/github-data:abc123",
                       "origin", "HEAD:refs/heads/automation/github-data"), self.calls)

    def test_no_change_does_not_create_pr(self):
        self.setup_mock(staged=0)
        p = Proposal("automation/github-data", "Refresh data", "Review this")
        p.prepare()
        with patch.object(p, "api") as api:
            self.assertIsNone(p.propose("Refresh"))
            api.assert_not_called()

    def test_cancel_pending_pr_if_change_undoes_proposal(self):
        pr = {"number": 9, "html_url": "https://github.com/owner/site/pull/9"}
        self.setup_mock(remote="abc123\trefs/heads/automation/blog-post-49",
                        open_pr=pr, net_diff=0)
        p = Proposal("automation/blog-post-49", "Remove", "Review this")
        p.prepare()
        with patch.object(p, "api", return_value={"state": "closed"}) as api:
            self.assertIsNone(p.propose("Withdraw"))
            api.assert_called_once_with(
                "PATCH", "/repos/owner/site/pulls/9", {"state": "closed"})
        self.assertFalse(any(c[0] == "push" for c in self.calls))


if __name__ == "__main__":
    unittest.main()

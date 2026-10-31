"""Exercise the project-data publishing entrypoint with no network or git writes."""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import update_github_data as updater


def snapshot(repos):
    return {
        "generated_at": "2026-10-31T00:00:00Z",
        "user": {"login": "owner", "url": "https://github.com/owner"},
        "totals": {"repositories": repos, "stars": 2, "forks": 0, "languages": 3},
        "featured": ["sample"],
        "languages": [],
        "repositories": [],
        "activity": None,
    }


class UpdateEntryPointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.output = self.root / "_data" / "github.json"
        self.output.parent.mkdir()
        self.output.write_text(json.dumps(snapshot(0)), encoding="utf-8")
        patches = [
            patch.object(updater, "ROOT", self.root),
            patch.object(updater, "OUTPUT", self.output),
            patch.object(updater, "load_settings", return_value={"login": "owner"}),
            patch.object(updater, "build", return_value=snapshot(1)),
            patch.object(updater, "GitHub"),
            patch.object(updater, "Proposal"),
            patch.object(updater, "git"),
            patch.dict(os.environ, {"GITHUB_REPOSITORY": "owner/site",
                                    "GITHUB_TOKEN": "test-token"}),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def test_main_opens_pr_instead_of_pushing_to_main(self):
        self.assertEqual(updater.main([]), 0)
        updater.Proposal.assert_called_once()
        args = updater.Proposal.call_args.args
        self.assertEqual(args[0], "automation/github-data")
        updater.Proposal.return_value.prepare.assert_called_once()
        updater.git.assert_called_once_with("add", "--", "_data/github.json")
        updater.Proposal.return_value.propose.assert_called_once_with(
            "Update GitHub data for the Projects page")
        self.assertEqual(json.loads(self.output.read_text())["totals"]["repositories"], 1)

    def test_dry_run_does_not_create_pr(self):
        self.assertEqual(updater.main(["--dry-run"]), 0)
        updater.Proposal.assert_not_called()
        updater.git.assert_not_called()

    def test_unchanged_snapshot_does_not_propose_commit(self):
        self.output.write_text(json.dumps(snapshot(1)), encoding="utf-8")
        self.assertEqual(updater.main([]), 0)
        updater.Proposal.return_value.prepare.assert_called_once()
        updater.Proposal.return_value.propose.assert_not_called()
        updater.git.assert_not_called()


if __name__ == "__main__":
    unittest.main()

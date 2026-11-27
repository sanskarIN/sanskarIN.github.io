import copy
import html
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_navigation import (
    audit_page, check_build, current_group, output_path, route_valid,
    validate_navigation,
)


DATA = {
    "main": [
        {"title": "Home", "url": "/"},
        {"title": "About", "url": "/about/"},
        {"title": "Projects", "url": "/projects/"},
        {"title": "Scarp Lang", "url": "/ScarpLang/"},
        {"title": "Articles & notes", "url": "/articles/"},
        {"title": "Research", "url": "/research/"},
    ],
    "header": [
        {"url": "/"},
        {"url": "/about/"},
        {"group": "work", "title": "Work", "urls": ["/projects/", "/ScarpLang/"]},
        {"group": "writing", "title": "Writing", "urls": ["/articles/", "/research/"]},
    ],
}


def markup(route="/", baseurl=""):
    labels, slots = validate_navigation(DATA)

    def link(url):
        current = ' aria-current="page"' if route == url else ""
        return f'<a href="{baseurl}{url}"{current}>{html.escape(labels[url])}</a>'

    items = []
    for slot in slots:
        if not slot.group:
            items.append("<li>" + link(slot.urls[0]) + "</li>")
            continue
        state = " data-nav-current" if current_group(slot, route) else ""
        links = "".join("<li>" + link(url) + "</li>" for url in slot.urls)
        items.append(
            f'<li><details data-nav-group="{slot.group}"{state}>'
            f'<summary><span>{slot.title}</span></summary>'
            f'<ul data-nav-panel aria-label="{slot.title}">{links}</ul></details></li>'
        )
    return (
        f'<link rel="stylesheet" href="{baseurl}/assets/css/navigation-groups.css?v=1">'
        f'<script src="{baseurl}/assets/js/navigation-groups.js?v=1" defer></script>'
        '<button type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button>'
        '<nav id="site-nav" data-grouped-navigation aria-label="Main">'
        '<ul>' + "".join(items) + '</ul></nav>'
    )


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.data = copy.deepcopy(DATA)

    def reject(self, pattern):
        with self.assertRaisesRegex(ValueError, pattern):
            validate_navigation(self.data)

    def test_complete_config(self):
        labels, slots = validate_navigation(self.data)
        self.assertEqual(len(labels), 6)
        self.assertEqual(len(slots), 4)
        self.assertEqual(slots[2].urls, ("/projects/", "/ScarpLang/"))
        self.assertEqual(labels["/articles/"], "Articles & notes")

    def test_main_and_header_lists_required(self):
        for key in ("main", "header"):
            with self.subTest(key=key):
                original = self.data.pop(key)
                self.reject(key + " must")
                self.data[key] = original

    def test_duplicate_main(self):
        self.data["main"].append(self.data["main"][0])
        self.reject("duplicate main")

    def test_main_entry_schema(self):
        self.data["main"][1]["group"] = "about"
        self.reject("main entries require")

    def test_invalid_main_label(self):
        self.data["main"][1]["title"] = " "
        self.reject("invalid main label")

    def test_unknown_direct_route(self):
        self.data["header"][1]["url"] = "/unknown/"
        self.reject("unknown header route")

    def test_unknown_group_route(self):
        self.data["header"][2]["urls"][0] = "/unknown/"
        self.reject("unknown group route")

    def test_missing_destination(self):
        self.data["header"].pop(1)
        self.reject("header coverage: missing")

    def test_duplicate_across_groups(self):
        self.data["header"][3]["urls"].append("/projects/")
        self.reject("duplicate=.*projects")

    def test_duplicate_within_group(self):
        self.data["header"][2]["urls"].append("/projects/")
        self.reject("duplicate=.*projects")

    def test_group_name_unique(self):
        self.data["header"][3]["group"] = "work"
        self.reject("duplicate group name")

    def test_group_name_slug(self):
        self.data["header"][2]["group"] = "Work Stuff"
        self.reject("invalid group name")

    def test_group_label(self):
        self.data["header"][2]["title"] = ""
        self.reject("invalid group label")

    def test_single_route_not_a_group(self):
        self.data["header"][2]["urls"] = ["/projects/"]
        self.reject("at least two routes")

    def test_home_not_in_group(self):
        self.data["header"][2]["urls"].append("/")
        self.reject("home must remain")

    def test_home_first(self):
        self.data["header"][0], self.data["header"][1] = self.data["header"][1], self.data["header"][0]
        self.reject("home must be the first")

    def test_home_required(self):
        self.data["main"].pop(0)
        self.reject("main must contain home")

    def test_invalid_header_schema(self):
        self.data["header"][2]["url"] = "/projects/"
        self.reject("header entry requires")

    def test_safe_root_relative_routes(self):
        for route in ("/", "/ScarpLang/", "/research/deep-work/", "/a.b/~user/"):
            with self.subTest(route=route):
                self.assertTrue(route_valid(route))
        for route in ("//example.com/", "https://example.com/", "/a", "/a/?q=1",
                      "/a/#x", "/a/../", "/./", "/%2e%2e/", "/a//b/", None, 42):
            with self.subTest(route=route):
                self.assertFalse(route_valid(route))

    def test_group_current_only_matches_route_boundary(self):
        _, slots = validate_navigation(self.data)
        self.assertTrue(current_group(slots[2], "/ScarpLang/"))
        self.assertTrue(current_group(slots[3], "/research/paper/"))
        self.assertFalse(current_group(slots[3], "/researcher/"))
        self.assertFalse(current_group(slots[3], "/"))


class RenderTests(unittest.TestCase):
    def setUp(self):
        self.labels, self.slots = validate_navigation(DATA)

    def audit(self, source, route="/", baseurl=""):
        return audit_page(source, route, self.labels, self.slots, baseurl)

    def assert_error(self, source, message, route="/"):
        errors = self.audit(source, route)
        self.assertTrue(any(message in error for error in errors), errors)

    def test_every_main_route_and_nested_publication(self):
        for route in (*self.labels, "/research/paper/", "/sanskar/"):
            with self.subTest(route=route):
                self.assertEqual(self.audit(markup(route), route), [])

    def test_subdirectory_deployment(self):
        route = "/articles/"
        self.assertEqual(self.audit(markup(route, "/portfolio"), route, "/portfolio"), [])

    def test_no_js_navigation_visible(self):
        source = markup().replace('<nav id=', '<nav hidden id=')
        self.assert_error(source, "navigation is hidden")

    def test_duplicate_navigation_id(self):
        self.assert_error(markup() + '<div id="site-nav"></div>', "duplicate navigation ID")

    def test_mobile_toggle_targets_navigation(self):
        source = markup().replace('aria-controls="site-nav"', 'aria-controls="other"')
        self.assert_error(source, "mobile toggle target")

    def test_mobile_toggle_closed_initially(self):
        source = markup().replace('aria-expanded="false"', 'aria-expanded="true"')
        self.assert_error(source, "mobile toggle starts expanded")

    def test_missing_native_disclosure(self):
        source = markup().replace("<details", "<div").replace("</details>", "</div>")
        self.assert_error(source, "native disclosure")

    def test_group_open_initially(self):
        source = markup().replace('data-nav-group="work"', 'data-nav-group="work" open')
        self.assert_error(source, "group initially open")

    def test_group_summary_label(self):
        source = markup().replace("<span>Work</span>", "<span>Other</span>")
        self.assert_error(source, "group label mismatch")

    def test_hidden_group_panel(self):
        source = markup().replace("data-nav-panel", "hidden data-nav-panel")
        self.assert_error(source, "panel unusable")

    def test_incorrect_group_current_state(self):
        self.assert_error(markup("/research/"), "incorrect group current state")
        source = markup("/research/").replace(" data-nav-current", "")
        self.assert_error(source, "incorrect group current state", "/research/")

    def test_exact_current_link(self):
        source = markup("/research/").replace(' aria-current="page"', "")
        self.assert_error(source, "incorrect current-page state", "/research/")

    def test_missing_destination(self):
        source = markup().replace('<li><a href="/research/">Research</a></li>', "")
        self.assert_error(source, "header destination coverage")

    def test_duplicate_destination(self):
        source = markup().replace('href="/research/"', 'href="/articles/"')
        self.assert_error(source, "header destination coverage")

    def test_wrong_link_label(self):
        source = markup().replace("Articles &amp; notes", "Other")
        self.assert_error(source, "incorrect label")

    def test_disabled_link(self):
        source = markup().replace('href="/projects/"', 'href="/projects/" aria-disabled="true"')
        self.assert_error(source, "disabled navigation link")

    def test_untabbable_link(self):
        source = markup().replace('href="/projects/"', 'href="/projects/" tabindex="-1"')
        self.assert_error(source, "untabbable navigation link")

    def test_no_application_menu_role(self):
        source = markup().replace('<nav id=', '<nav role="menubar" id=')
        self.assert_error(source, "must not imitate application menus")

    def test_missing_script_and_stylesheet(self):
        self.assert_error(markup().replace("navigation-groups.js", "other.js"), "navigation-groups.js")
        self.assert_error(markup().replace("navigation-groups.css", "other.css"), "navigation-groups.css")

    def test_script_defers(self):
        source = markup().replace(" defer", "")
        self.assert_error(source, "script must defer")


class BuildTests(unittest.TestCase):
    def test_output_path(self):
        root = Path("_site")
        self.assertEqual(output_path(root, "/"), root / "index.html")
        self.assertEqual(output_path(root, "/ScarpLang/"), root / "ScarpLang/index.html")
        self.assertEqual(output_path(root, "/404.html"), root / "404.html")
        with self.assertRaises(ValueError):
            output_path(root, "/../private/")

    def test_build_includes_publications_and_assets(self):
        with TemporaryDirectory() as directory:
            output = Path(directory)
            routes = [*(entry["url"] for entry in DATA["main"]), "/sanskar/", "/research/paper/"]
            for route in routes:
                path = output_path(output, route)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(markup(route), encoding="utf-8")
            for asset in ("assets/js/navigation-groups.js", "assets/css/navigation-groups.css"):
                path = output / asset
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("/* fixture */", encoding="utf-8")
            with patch("check_navigation.read_yaml", side_effect=[DATA, {}]), \
                 patch("check_navigation.published_posts", return_value=[{"url": "/research/paper/"}]):
                check_build(output)
            output_path(output, "/research/paper/").unlink()
            (output / "assets/js/navigation-groups.js").unlink()
            with patch("check_navigation.read_yaml", side_effect=[DATA, {}]), \
                 patch("check_navigation.published_posts", return_value=[{"url": "/research/paper/"}]):
                with self.assertRaises(AssertionError) as error:
                    check_build(output)
            self.assertIn("/research/paper/: generated page missing", str(error.exception))
            self.assertIn("missing generated asset", str(error.exception))


if __name__ == "__main__":
    unittest.main()

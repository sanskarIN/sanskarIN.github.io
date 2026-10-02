---
layout: legal
title: Accessibility
eyebrow: Information
lead: How this website is built to work for as many people as possible, and how to report a barrier.
description: "Accessibility practices used on sanskarIN.github.io and how to report an accessibility barrier."
permalink: /accessibility/
policy: accessibility
---
{%- comment -%}
  When you change this page, update `accessibility` in _data/legal.yml.
  Only describe practices the website actually follows.
{%- endcomment %}
{%- include accounts-config.html -%}
{%- assign form_key = site.data.contact.form.access_key | strip -%}
{%- assign contact_form = site.data.contact.form %}

## Commitment

I want this website to work for everyone, including people who use assistive technologies such as screen readers, screen magnifiers, voice control, or keyboard-only navigation.

## Standards

The website is designed and built with the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA as its target. This is a goal, not a claim of conformance: the website has not been formally audited or certified.

## Practices used on this website

- **Semantic HTML:** pages use meaningful elements and landmarks — header, navigation, main content, and footer — so assistive technologies can convey their structure.
- **Keyboard navigation:** every link and control can be reached and used with a keyboard, in a logical order. A "Skip to content" link is the first item on every page.
- **Heading hierarchy:** each page has one main heading, with section headings nested in order beneath it.
- **Focus indicators:** keyboard focus is always shown with a clearly visible outline.
- **Color contrast:** text colors meet WCAG AA contrast ratios (at least 4.5:1 for normal text) in both the light and dark themes.
- **Not relying on color alone:** links within text are underlined, and the current page in the navigation is marked with an underline and identified to screen readers.
- **Text alternatives:** icons are decorative and hidden from assistive technology. Icon-only buttons have text labels, and links that open in a new tab say so.
- **Accessible controls:** the menu button and the theme switch are real buttons that announce their state — expanded or collapsed, on or off.
- **Search:** the search opens from the header or with a keyboard shortcut: <kbd>/</kbd>, or <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> on a Mac). The number of results is announced to screen readers, the arrow keys move through the results, Enter opens one, and Escape closes the search and returns focus to where you were.
- **Projects:** the repository filters have visible labels, and the number of matching repositories is announced as you type. The contribution chart is summarized in text, and the share of each language is listed in text as well as shown in a bar.
{% if form_key != "" %}- **Forms:** every field in the contact form has a visible label, required fields are marked in text, and the result of sending a message is announced to screen readers.
{% endif %}{% if accounts_on %}- **Accounts:** the sign-in, profile, and post editor forms have visible labels, problems are listed in text and announced to screen readers, and keyboard focus moves to each new step, such as entering the emailed code.
{% endif %}- **Blog posts:** the post form asks authors to describe every image, a cover image can't be published without a description, and wide tables and code blocks in posts can be scrolled with the keyboard. Longer posts include a list of their sections, and each code example has a labeled copy button that announces when the code has been copied.
- **Reduced motion:** the website uses very little animation and respects your device's "reduce motion" setting.
- **Responsive design:** layouts adapt from small phones to large screens without horizontal scrolling, and text can be zoomed to 200% and beyond.
- **Mobile accessibility:** buttons and menu links are sized for touch, and the website works in both portrait and landscape orientation.
- **Light and dark themes:** the website follows your device's color setting, and you can switch themes manually.
- **Works without JavaScript:** all content and navigation remain available if JavaScript is turned off{% if accounts_on %}, apart from signing in and writing on this website, which need it{% endif %}. The search and the project filters need JavaScript too, so they are hidden without it; every project is still listed.

## Known limitations

Linked third-party services, such as GitHub, LinkedIn, and Discord, are outside my control and may have accessibility issues of their own. {% if accounts_on %}Writing a blog post with GitHub depends on the accessibility of GitHub's issue form; the editor on this website is an alternative.{% else %}Writing a blog post happens on GitHub, so it depends on the accessibility of GitHub's issue form.{% endif %}

Blog posts are written by their authors, including visitors. Their structure is checked automatically, but their text and image descriptions are not, so some posts may not fully meet accessibility guidelines. Please tell me about any post that causes you problems.

## Feedback

If you run into an accessibility barrier on this website, please tell me by emailing {% include email-link.html key="support" %}. It helps to include:

- the address (URL) of the page;
- a description of the problem; and
- the device, browser, and any assistive technology you use.

I will do my best to fix any accessibility problem you report.

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
{% if form_key != "" %}- **Forms:** every field in the contact form has a visible label, required fields are marked in text, and the result of sending a message is announced to screen readers.
{% endif %}- **Reduced motion:** the website uses very little animation and respects your device's "reduce motion" setting.
- **Responsive design:** layouts adapt from small phones to large screens without horizontal scrolling, and text can be zoomed to 200% and beyond.
- **Mobile accessibility:** buttons and menu links are sized for touch, and the website works in both portrait and landscape orientation.
- **Light and dark themes:** the website follows your device's color setting, and you can switch themes manually.
- **Works without JavaScript:** all content and navigation remain available if JavaScript is turned off.

## Known limitations

Linked third-party services, such as GitHub, LinkedIn, and Discord, are outside my control and may have accessibility issues of their own.

## Feedback

If you run into an accessibility barrier on this website, please tell me by emailing {% include email-link.html key="support" %}. It helps to include:

- the address (URL) of the page;
- a description of the problem; and
- the device, browser, and any assistive technology you use.

I will do my best to fix any accessibility problem you report.

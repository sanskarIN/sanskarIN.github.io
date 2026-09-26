---
layout: legal
title: Terms and Conditions
eyebrow: Legal
lead: The terms that apply when you use this website.
description: "Terms and conditions for using sanskarIN.github.io, the personal website of Sanskar."
permalink: /terms/
policy: terms
---
{%- comment -%}
  When you change this page, update `terms` in _data/legal.yml.
  These are general terms for a personal website. Details such as a legal
  name, jurisdiction, or governing law are intentionally not included —
  see README.md → "Legal pages" before adding them.
{%- endcomment %}
{%- assign form_key = site.data.contact.form.access_key | strip -%}
{%- assign contact_form = site.data.contact.form -%}
{%- assign blog = site.data.blog -%}
{%- capture blog_form_url -%}{{ site.repository_url }}/issues/new?template={{ blog.form }}{%- endcapture %}

## Introduction

These Terms and Conditions ("Terms") apply to your use of {{ site.display_url }} (the "website"), the personal website of Sanskar ("I", "me", "my"). The website presents my work as a software developer, links to my profiles on other services, and explains how to contact me. How information is handled is described in the [Privacy Policy]({{ '/privacy/' | relative_url }}) and the [Cookie Policy]({{ '/cookies/' | relative_url }}).

## Acceptance of these Terms

By accessing or using the website, you agree to these Terms. If you do not agree with them, please do not use the website.

## Using the website

The website is free to access and does not require an account. You may browse it, read its content, and link to it. Its content is provided for general information about me and my work. Writing a post for the [blog]({{ '/blog/' | relative_url }}) requires a GitHub account, as described in [Blog posts](#blog-posts).

## Intellectual property

Unless stated otherwise, the website's content — including its text, design, graphics, logo, and code — is owned by me and protected by applicable intellectual-property laws. You may not copy, reproduce, modify, or redistribute it without my permission, except where the law allows. Blog posts written by visitors belong to their authors, as described in [Blog posts](#blog-posts).

Third-party material used by the website, such as fonts, icons, and the names and logos of other services, belongs to its respective owners and is used under their licenses or terms. The [Credits]({{ '/credits/' | relative_url }}) page lists these materials and their licenses.

Software projects I publish on GitHub are governed by the licenses in their own repositories, not by these Terms.

## User conduct

When using the website, you agree not to:

- use it in a way that breaks any applicable law or regulation;
- attempt to gain unauthorized access to the website, its hosting infrastructure, or related accounts;
- interfere with or disrupt the website, for example by sending malicious code or excessive automated traffic;
- misrepresent your identity or suggest an affiliation with me that does not exist;
- use the website's content in a way that infringes the rights of others;{% if form_key == "" %} or{% endif %}
{% if form_key != "" %}- send spam, malicious content, or unlawful material through the contact form; or
{% endif %}- submit blog posts that break the rules in [Blog posts](#blog-posts).

## Blog posts

Anyone with a GitHub account can write a post for the blog using the {% include link.html url=blog_form_url label="blog post form" %} on GitHub. These terms apply to every post you submit:

- **Your post, your rights:** you confirm that you wrote the post and that you have the right to publish its text and images. You keep ownership of your post.
- **Permission to publish:** by submitting a post, you give me a free, non-exclusive, worldwide permission to publish, display, and store it — including its images — on this website, in the blog's feed, and in the website's public repository on GitHub, and to make the changes needed to publish it, such as converting its formatting and resizing or re-encoding its images.
- **Review:** {% if blog.review_visitor_posts %}posts from visitors are published only after I review them, and edits to a published post are reviewed again. {% endif %}I may decline, remove, or stop showing any post at any time, without giving a reason.
- **What's not allowed:** posts must not contain unlawful content; material that infringes someone else's copyright, trademark, or other rights; spam or advertising; malicious code or links; hateful, harassing, or sexually explicit content; or another person's personal information without their permission.
- **Views:** posts by visitors express their authors' own views, not mine, and I am not responsible for them.
- **Removing your post:** to have your post taken down, comment on its GitHub issue or email {% include email-link.html key="business_primary" %}. It is then removed from the website, although earlier versions remain in the repository's public history on GitHub.
- **GitHub's terms:** posts are written and stored on GitHub, so GitHub's own terms of service and policies also apply.

## External links

The website links to other websites and services, including GitHub, LinkedIn, Dev.to, Discord, X, Instagram, Threads, Pinterest, Bluesky, Buy Me a Coffee, and Gumroad. These links are provided for convenience. I do not control those services and am not responsible for their content, availability, or practices. Your use of them is governed by their own terms and policies.

## Third-party services

- **Hosting:** the website is hosted on GitHub Pages, a service provided by GitHub, Inc.
- **Blog:** blog posts are written in GitHub Issues, stored in the website's repository on GitHub, and published by GitHub Actions.
- **Email:** messages you send to the addresses on this website are handled by the email providers that host those addresses (Microsoft Outlook and Google Gmail).
{% if form_key != "" %}- **Contact form:** messages sent with the contact form are delivered by {{ contact_form.service }} and handled as described in the [Privacy Policy]({{ '/privacy/' | relative_url }}).
{% endif %}- **Support and purchases:** any support given through Buy Me a Coffee, and any purchase made through Gumroad, takes place on those platforms and is governed by their terms, including their payment, refund, and privacy terms.

## Availability

I aim to keep the website available and accurate, but I do not guarantee that it will always be available, uninterrupted, or free of errors. I may change, suspend, or remove any part of the website at any time without notice.

## Disclaimer

The website and its content are provided "as is" and "as available", for general information only. To the extent permitted by law, I make no warranties of any kind, express or implied, about the website, including its accuracy, completeness, or fitness for a particular purpose. Technical information on the website may become out of date and is not professional advice for your specific situation.

## Limitation of liability

To the fullest extent permitted by applicable law, I am not liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, or goodwill, arising from your use of — or inability to use — the website or any website or service linked from it. Nothing in these Terms excludes or limits any liability that cannot be excluded or limited under applicable law.

## Changes to these Terms

I may update these Terms from time to time. The "Last updated" date at the top of this page shows when they last changed. If you continue to use the website after an update, you accept the revised Terms.

## Contact

Questions about these Terms? Email {% include email-link.html key="business_primary" %}.

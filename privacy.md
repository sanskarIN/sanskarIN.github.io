---
layout: legal
title: Privacy Policy
eyebrow: Legal
lead: What information this website handles — and what it does not.
description: "Privacy policy for sanskarIN.github.io: no analytics, no tracking, and no cookies set by the site, plus what happens when you send an email."
permalink: /privacy/
policy: privacy
---
{%- comment -%}
  When you change this page, update `privacy` in _data/legal.yml.
  If you ever add analytics, embeds, a form service, or anything else that
  processes visitor data, describe it here and in cookies.md first.
  The contact-form passages below appear automatically once the form is on.
{%- endcomment %}
{%- assign form_key = site.data.contact.form.access_key | strip -%}
{%- assign contact_form = site.data.contact.form %}

<div class="summary" markdown="1">
{% if form_key != "" %}**In short:** this website has no analytics, advertising, tracking, or user accounts, and it sets no cookies. It is hosted on GitHub Pages, which logs visitors' IP addresses for security purposes. If you email me or use the contact form, I receive what you send and use it only to reply. If you write a blog post, it is published on GitHub and on this website under your GitHub username.{% else %}**In short:** this website has no analytics, advertising, tracking, user accounts, or contact forms, and it sets no cookies. It is hosted on GitHub Pages, which logs visitors' IP addresses for security purposes. If you email me, I receive what you send and use it only to reply. If you write a blog post, it is published on GitHub and on this website under your GitHub username.{% endif %}
</div>

## Who is responsible

This Privacy Policy explains how information is handled when you visit {{ site.display_url }} (the "website"), the personal website of Sanskar ("I", "me", "my"). For privacy questions, email {% include email-link.html key="business_primary" %}.

## Information I collect

{% if form_key != "" %}The website itself does not collect or store personal information, apart from the blog posts people choose to publish. It has no user accounts of its own, comment sections, newsletter sign-ups, analytics, or advertising, and it does not run any server-side code of its own. Its optional contact form sends your message to me through a form-delivery service, and blog posts are written and stored on GitHub, as described below.{% else %}The website itself does not collect personal information, apart from the blog posts people choose to publish. It has no user accounts of its own, contact forms, comment sections, newsletter sign-ups, analytics, or advertising, and it does not run any server-side code of its own. Blog posts are written and stored on GitHub, as described below.{% endif %}

## Information you provide

If you email one of the addresses listed on the website, I receive your email address, your name if you include it, the content of your message, and any attachments. I use this information only to read and reply to your message and to handle your request, such as a business inquiry or a support question. I do not sell it or use it for marketing.
{% if form_key != "" %}
If you use the contact form, it sends your name, email address, chosen topic, and message to {% include link.html url=contact_form.service_url label=contact_form.service %}, a form-delivery service, which forwards them to my email inbox. {{ contact_form.service }} states that it does not store form submissions and only passes them on. I handle messages sent through the form the same way as emails.
{% endif %}
## Blog posts

The [blog]({{ '/blog/' | relative_url }}) accepts posts written with a form on GitHub. When you submit a post:

- it becomes a public issue in this website's GitHub repository, posted from your GitHub account, and anyone can see it together with your username and profile;
- if it is published, the website shows your post, its images, and your GitHub username as the author, with a link to your GitHub profile, and the post's text and images are stored in the website's public repository on GitHub;
- its images are copied to the website and saved without their metadata, such as location and camera details, and very large images are scaled down; and
- anything you include in the post, including any personal information, becomes public, so please include only what you are happy to share.

To have a post removed, comment on its issue or email {% include email-link.html key="business_primary" %}. I will remove it from the website and can delete its issue too. Earlier versions of a published post remain in the repository's public history on GitHub. Your GitHub account itself is handled by GitHub under its own privacy statement.

## Automatically collected information

The website is hosted on GitHub Pages. When you visit, your browser connects to GitHub's servers, which receive the technical information needed to deliver the pages, such as your IP address and browser details. According to GitHub's documentation, when a GitHub Pages site is visited, the visitor's IP address is logged and stored for security purposes. I do not have access to these logs, and the website adds no logging or analytics of its own.

## Cookies

The website does not set cookies. If you use the theme switch, your choice of light or dark theme is saved in your browser's local storage so the site remembers it on your next visit. That preference stays on your device and is never sent to me. The [Cookie Policy]({{ '/cookies/' | relative_url }}) explains this in detail.

## Analytics

The website does not use analytics, tracking pixels, or similar measurement tools. If that ever changes, this policy and the Cookie Policy will be updated to describe the tools used.

## Third-party services

The website relies on, or links to, the following services. Each has its own privacy policy:

- **GitHub** (hosting with GitHub Pages, and blog posts with GitHub Issues and GitHub Actions): see the {% include link.html url="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" label="GitHub General Privacy Statement" %} and GitHub's {% include link.html url="https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection" label="note on GitHub Pages data collection" %}.
- **Email providers:** the published addresses are hosted by Microsoft (Outlook) and Google (Gmail), which process the emails you send under their own privacy policies.
{% if form_key != "" %}- **{{ contact_form.service }}** (contact form delivery): see the {{ contact_form.service }} {% include link.html url=contact_form.service_privacy_url label="privacy and data-handling information" %}.
{% endif %}- **Linked platforms:** GitHub, LinkedIn, Dev.to, Discord, X, Instagram, Threads, Pinterest, Bluesky, Buy Me a Coffee, and Gumroad.

The website does not embed content, scripts, fonts, or images from any of these services. They receive information about you only if you follow a link to them{% if form_key != "" %}, send an email, submit the contact form, or write a blog post{% else %}, send an email, or write a blog post{% endif %}.

## External links

Links to other websites are provided for convenience. Once you leave this website, the other website's privacy policy applies, and I am not responsible for its practices.

## Data retention

I keep emails for as long as they are needed to reply and to handle any ongoing conversation, collaboration, or support request, and for reasonable record-keeping afterwards. {% if form_key != "" %}Messages sent with the contact form arrive as emails and are kept the same way. {% endif %}You can ask me to delete your correspondence at any time. Published blog posts stay on the website until they are removed; their issues, and the repository's history, stay on GitHub unless they are deleted. Information logged by GitHub is kept according to GitHub's own policies.

## Data security

The website is served over HTTPS. Because it is a static website with no databases, accounts, or server-side code of its own, it stores no personal information other than the blog posts people choose to publish. Emails are protected by the security measures of the email providers.{% if form_key != "" %} Contact form messages are sent to {{ contact_form.service }} over an encrypted (HTTPS) connection.{% endif %} No method of transmission or storage is completely secure, so please do not send sensitive information such as passwords by email{% if form_key != "" %} or through the contact form{% endif %}.

## Children's privacy

The website is intended for a general audience and is not directed at children. It does not knowingly collect personal information from children. If you believe a child has sent me personal information or published it in a blog post, please contact me and I will delete it.

## International users

The website can be visited from anywhere. GitHub{% if form_key != "" %}, the email providers, and {{ contact_form.service }}{% else %} and the email providers{% endif %} mentioned above may process information in countries other than your own, including the United States.

## Your rights

Depending on where you live, you may have rights over your personal information, such as the right to access, correct, or delete it, or to object to how it is used. Because the only personal information I hold is what you send me and any blog posts you publish, you can exercise these rights by emailing {% include email-link.html key="business_primary" %}; for a blog post, you can also comment on its GitHub issue. For information processed by GitHub or another service, please contact that service directly.

## Changes to this policy

I may update this Privacy Policy from time to time. The "Last updated" date at the top of this page shows when it last changed.

## Contact

Questions about privacy? Email {% include email-link.html key="business_primary" %}.

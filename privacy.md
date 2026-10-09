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
  The contact-form and account passages below appear automatically once the
  form or accounts are turned on (_data/contact.yml, _data/accounts.yml).
{%- endcomment %}
{%- include accounts-config.html -%}
{%- assign form_key = site.data.contact.form.access_key | strip -%}
{%- assign contact_form = site.data.contact.form -%}
{%- assign email_service = site.data.accounts.email_service | default: "" | strip -%}
{%- assign email_service_privacy_url = site.data.accounts.email_service_privacy_url | default: "" | strip %}

<div class="summary" markdown="1">
{% if accounts_on %}**In short:** this website has no analytics, advertising, or tracking, and it sets no cookies. It is hosted on GitHub Pages, which logs visitors' IP addresses for security purposes. If you email me{% if form_key != "" %} or use the contact form{% endif %}, I receive what you send and use it only to reply. If you write a blog post, it is published on GitHub and on this website under your GitHub username or, if you write it with an account on this website, your display name. Accounts need only an email address, which is used to sign you in and is never shown.{% elsif form_key != "" %}**In short:** this website has no analytics, advertising, tracking, or user accounts, and it sets no cookies. It is hosted on GitHub Pages, which logs visitors' IP addresses for security purposes. If you email me or use the contact form, I receive what you send and use it only to reply. If you write a blog post, it is published on GitHub and on this website under your GitHub username.{% else %}**In short:** this website has no analytics, advertising, tracking, user accounts, or contact forms, and it sets no cookies. It is hosted on GitHub Pages, which logs visitors' IP addresses for security purposes. If you email me, I receive what you send and use it only to reply. If you write a blog post, it is published on GitHub and on this website under your GitHub username.{% endif %}
</div>

## Who is responsible

This Privacy Policy explains how information is handled when you visit {{ site.display_url }} (the "website"), the personal website of Sanskar ("I", "me", "my"). For privacy questions, email {% include email-link.html key="business_primary" %}.

## Information I collect

{% if accounts_on %}The website collects personal information only when you choose to give it: when you create an account to write for the blog, and when you publish a blog post. It has no comment sections, newsletter sign-ups, analytics, or advertising. Accounts are stored by Supabase{% if form_key != "" %}, the optional contact form sends your message to me through a form-delivery service,{% endif %} and blog posts are stored on GitHub, as described below.{% elsif form_key != "" %}The website itself does not collect or store personal information, apart from the blog posts people choose to publish. It has no user accounts of its own, comment sections, newsletter sign-ups, analytics, or advertising, and it does not run any server-side code of its own. Its optional contact form sends your message to me through a form-delivery service, and blog posts are written and stored on GitHub, as described below.{% else %}The website itself does not collect personal information, apart from the blog posts people choose to publish. It has no user accounts of its own, contact forms, comment sections, newsletter sign-ups, analytics, or advertising, and it does not run any server-side code of its own. Blog posts are written and stored on GitHub, as described below.{% endif %}

## Information you provide

If you email one of the addresses listed on the website, I receive your email address, your name if you include it, the content of your message, and any attachments. I use this information only to read and reply to your message and to handle your request, such as a business inquiry or a support question. I do not sell it or use it for marketing.
{% if form_key != "" %}
If you use the contact form, it sends your name, email address, chosen topic, and message to {% include link.html url=contact_form.service_url label=contact_form.service %}, a form-delivery service, which forwards them to my email inbox. {{ contact_form.service }} states that it does not store form submissions and only passes them on. I handle messages sent through the form the same way as emails.
{% endif %}
{%- if accounts_on %}
## Accounts

You can create an account to write for the [blog]({{ '/blog/' | relative_url }}). Accounts are provided by {% include link.html url="https://supabase.com/" label="Supabase" %}, which stores them for me.

- **Signing in:** you enter your email address, and a 6-digit code is sent to it{% if email_service != "" %} by {% if email_service_privacy_url != "" %}{% include link.html url=email_service_privacy_url label=email_service %}{% else %}{{ email_service }}{% endif %}{% endif %}. Entering the code signs you in, and creates your account the first time. There is no password.
- **What is stored:** your email address; when your account was created and last used; your author profile (username, display name, and, if you add them, a short bio and a website); the posts you send, with where they are in the review; and the images you upload. To keep accounts secure, Supabase also records technical details of each sign-in, such as its time and the IP address used.
- **Your email address** is used only to sign you in, and to contact you about your account or your posts if needed. It is never shown on the website or on GitHub, and it is not used for newsletters or marketing.
- **What is public:** your username, display name, bio, and website appear on your author page and with your posts. The images you upload can be seen by anyone with their link, and they appear in your post's public issue on GitHub. Location and camera details are removed from them in your browser before they are uploaded.
- **Staying signed in:** your browser keeps your session in its local storage, and the post you are writing is kept there too until you send it. The [Cookie Policy]({{ '/cookies/' | relative_url }}) lists both.
- **Deleting your account:** you can delete your account on [your account page]({{ '/account/' | relative_url }}). This deletes your account, profile, and uploaded images from Supabase, and withdraws your posts that are still waiting for review. Your published posts stay on the blog under your display name, unless you choose to remove them as well. The GitHub issues for your posts are closed but stay public, as do earlier versions in the repository's history; email {% include email-link.html key="business_primary" %} if you would like the issues deleted.
{% endif %}
## Blog posts
{% if accounts_on %}
The [blog]({{ '/blog/' | relative_url }}) accepts posts written with an account on this website or with a form on GitHub. When you send a post:

- it becomes a public issue in this website's GitHub repository: posted from your GitHub account if you use the form on GitHub, or by my GitHub account for you if you use an account on this website, together with your username and display name and a number that links it to your account;
- if it is published, the website shows your post, its images, and your name as the author — your GitHub username, linked to your GitHub profile, or your display name, linked to your author page — and the post's text and images are stored in the website's public repository on GitHub;
- its images are copied to the website and saved without their metadata, such as location and camera details, and very large images are scaled down; and
- anything you include in the post, including any personal information, becomes public, so please include only what you are happy to share.

To remove a post you wrote with an account, use your account page. To have any other post removed, comment on its issue or email {% include email-link.html key="business_primary" %}.{% else %}
The [blog]({{ '/blog/' | relative_url }}) accepts posts written with a form on GitHub. When you submit a post:

- it becomes a public issue in this website's GitHub repository, posted from your GitHub account, and anyone can see it together with your username and profile;
- if it is published, the website shows your post, its images, and your GitHub username as the author, with a link to your GitHub profile, and the post's text and images are stored in the website's public repository on GitHub;
- its images are copied to the website and saved without their metadata, such as location and camera details, and very large images are scaled down; and
- anything you include in the post, including any personal information, becomes public, so please include only what you are happy to share.

To have a post removed, comment on its issue or email {% include email-link.html key="business_primary" %}.{% endif %} I will remove it from the website and can delete its issue too. Earlier versions of a published post remain in the repository's public history on GitHub. Your GitHub account itself is handled by GitHub under its own privacy statement.

## Automatically collected information

The website is hosted on GitHub Pages. When you visit, your browser connects to GitHub's servers, which receive the technical information needed to deliver the pages, such as your IP address and browser details. According to GitHub's documentation, when a GitHub Pages site is visited, the visitor's IP address is logged and stored for security purposes. I do not have access to these logs, and the website adds no logging or analytics of its own.{% if accounts_on %} The account pages and author pages also connect to Supabase, which receives the same kind of technical information when they do.{% endif %}

## Cookies

The website does not set cookies. If you use the theme switch, your choice of light or dark theme is saved in your browser's local storage so the site remembers it on your next visit. That preference stays on your device and is never sent to me.{% if accounts_on %} If you sign in, your session and any unsent post are kept in local storage too.{% endif %} The [Cookie Policy]({{ '/cookies/' | relative_url }}) explains this in detail.

## Analytics

The website does not use analytics, tracking pixels, or similar measurement tools. If that ever changes, this policy and the Cookie Policy will be updated to describe the tools used.

## Search

Searching the website happens entirely in your browser. When you open the search, your browser downloads a list of the website's pages, blog posts, and projects from the website itself and looks for matches in it. What you type is never sent anywhere, and it is not saved. The terminal on the Home page works the same way: its commands are handled in your browser, and nothing you type in it is sent or saved. The filters on the Projects page also work in your browser; they are added to the page's address so that you can bookmark or share the filtered list.

## Third-party services

The website relies on, or links to, the following services. Each has its own privacy policy:

- **GitHub** (hosting with GitHub Pages, blog posts with GitHub Issues and GitHub Actions, and the details of my public repositories on the Projects page): see the {% include link.html url="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" label="GitHub General Privacy Statement" %} and GitHub's {% include link.html url="https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection" label="note on GitHub Pages data collection" %}.
- **Email providers:** the published addresses are hosted by Microsoft (Outlook) and Google (Gmail), which process the emails you send under their own privacy policies.
{% if form_key != "" %}- **{{ contact_form.service }}** (contact form delivery): see the {{ contact_form.service }} {% include link.html url=contact_form.service_privacy_url label="privacy and data-handling information" %}.
{% endif %}{% if accounts_on %}- **Supabase** (accounts, author profiles, and image uploads): see the {% include link.html url="https://supabase.com/privacy" label="Supabase Privacy Policy" %}.
{% if email_service != "" %}- **{{ email_service }}** (sending sign-in codes){% if email_service_privacy_url != "" %}: see its {% include link.html url=email_service_privacy_url label="privacy policy" %}{% endif %}.
{% endif %}{% endif %}- **Linked platforms:** GitHub, LinkedIn, Dev.to, Discord, X, Instagram, Threads, Bluesky, Buy Me a Coffee, and Gumroad.

The website does not embed content, scripts, fonts, or images from any of these services{% if accounts_on %}; only its account and author pages connect to Supabase{% endif %}. They receive information about you only if you follow a link to them, send an email{% if form_key != "" %}, submit the contact form{% endif %}{% if accounts_on %}, use an account or author page{% endif %}, or write a blog post.

The [Projects page]({{ '/projects/' | relative_url }}) shows public information about my GitHub repositories, such as their descriptions, languages, and stars, and the contribution activity shown on my GitHub profile. A scheduled GitHub Actions workflow copies this information from GitHub's API and saves it with the website, so your browser does not contact GitHub to show it.

## External links

Links to other websites are provided for convenience. Once you leave this website, the other website's privacy policy applies, and I am not responsible for its practices.

## Data retention

I keep emails for as long as they are needed to reply and to handle any ongoing conversation, collaboration, or support request, and for reasonable record-keeping afterwards. {% if form_key != "" %}Messages sent with the contact form arrive as emails and are kept the same way. {% endif %}You can ask me to delete your correspondence at any time.{% if accounts_on %} Accounts are kept until you delete them, or until I delete them, for example because they break the [Terms]({{ '/terms/' | relative_url }}).{% endif %} Published blog posts stay on the website until they are removed; their issues, and the repository's history, stay on GitHub unless they are deleted. Information logged by GitHub is kept according to GitHub's own policies.

## Data security

The website is served over HTTPS. {% if accounts_on %}Accounts are stored by Supabase, whose database rules let each person read and change only their own account details. Sign-in codes work once and expire after a short time, and there are no passwords to steal. Apart from accounts, the website stores no personal information other than the blog posts people choose to publish.{% else %}Because it is a static website with no databases, accounts, or server-side code of its own, it stores no personal information other than the blog posts people choose to publish.{% endif %} Emails are protected by the security measures of the email providers.{% if form_key != "" %} Contact form messages are sent to {{ contact_form.service }} over an encrypted (HTTPS) connection.{% endif %} No method of transmission or storage is completely secure, so please do not send sensitive information such as passwords by email{% if form_key != "" %} or through the contact form{% endif %}.

## Children's privacy

The website is intended for a general audience and is not directed at children. It does not knowingly collect personal information from children. If you believe a child has sent me personal information or published it in a blog post, please contact me and I will delete it.

## International users

The website can be visited from anywhere. GitHub, the email providers{% if form_key != "" %}, {{ contact_form.service }}{% endif %}{% if accounts_on %}, Supabase{% endif %}, and the other services mentioned above may process information in countries other than your own, including the United States.

## Your rights

Depending on where you live, you may have rights over your personal information, such as the right to access, correct, or delete it, or to object to how it is used. Because the only personal information I hold is what you send me{% if accounts_on %}, your account,{% endif %} and any blog posts you publish, you can exercise these rights by emailing {% include email-link.html key="business_primary" %}; for a blog post, you can also comment on its GitHub issue.{% if accounts_on %} If you have an account, you can see and change your profile, and delete your account, on [your account page]({{ '/account/' | relative_url }}).{% endif %} For information processed by GitHub or another service, please contact that service directly.

## Changes to this policy

I may update this Privacy Policy from time to time. The "Last updated" date at the top of this page shows when it last changed.

## Contact

Questions about privacy? Email {% include email-link.html key="business_primary" %}.

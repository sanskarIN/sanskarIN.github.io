---
layout: legal
title: Cookie Policy
eyebrow: Legal
lead: This website does not set cookies. Here is what it can store in your browser instead, and why.
description: "Cookie policy for sanskarIN.github.io: the site sets no cookies, and stores in your browser only what the features you use need, such as your theme."
permalink: /cookies/
policy: cookies
---
{%- comment -%}
  When you change this page, update `cookies` in _data/legal.yml.
  The storage details below must match assets/js/main.js (the "theme" storage
  key) and assets/js/account.js (the "blog-session" and "blog-draft" keys,
  used only while accounts are turned on in _data/accounts.yml).
{%- endcomment %}
{%- include accounts-config.html -%}
{%- assign form_key = site.data.contact.form.access_key | strip -%}
{%- assign contact_form = site.data.contact.form %}

<div class="summary" markdown="1">
{% if accounts_on %}**In short:** no cookies of any kind — essential, analytics, advertising, or third-party. The website stores only what the features you use need, in your browser's local storage: your light or dark theme choice if you use the theme switch, and your sign-in session and unsent post if you write for the blog with an account.{% else %}**In short:** no cookies of any kind — essential, analytics, advertising, or third-party. The only thing the website stores is your light or dark theme choice, in your browser's local storage, and only if you use the theme switch.{% endif %}
</div>

## What cookies are

Cookies are small text files that a website asks your browser to store, so the site can recognize your browser later. Similar technologies, such as your browser's local storage, can also keep information on your device. This policy covers both.

## Essential cookies

The website does not use any cookies, including essential ones. Every page works without them.

## Local storage: theme preference

The website has a theme switch for choosing between light and dark colors. If you use it, your choice is saved in your browser's local storage so the website remembers it on your next visit:

Name
: `theme`

Stored value
: `light` or `dark`

Purpose
: Remembers your chosen color theme

How long it is kept
: Until you clear this website's data in your browser

This entry is created only when you use the switch. It stays on your device, is never sent to me or anyone else, and contains no personal information. If you never use the switch, nothing is stored and the website follows your device's light or dark setting.
{% if accounts_on %}
## Local storage: accounts

If you sign in to write for the [blog]({{ '/blog/' | relative_url }}), two more entries are kept in your browser's local storage. Signing in and writing need them, so they are created only when you use those features.

### Sign-in session

Name
: `blog-session`

Stored value
: A sign-in token, a token to renew it, when it expires, your account number, and your email address

Purpose
: Keeps you signed in on this device

How long it is kept
: Until you sign out, delete your account, or clear this website's data in your browser

### Unsent post

Name
: `blog-draft`

Stored value
: The post you are writing: its title, summary, tags, cover image link and description, and text

Purpose
: Saves your post as you write, so it isn't lost if you leave the page

How long it is kept
: Until you send the post, or clear this website's data in your browser

The session is sent only to Supabase, which provides the accounts, to show that requests come from you. The unsent post stays on your device until you send it. If your browser blocks local storage, you can still sign in and write, but only until you leave the page.
{% endif %}
## Analytics cookies

None. The website does not use analytics or measurement tools of any kind.

## Third-party cookies

None are set through this website. It does not embed content, scripts, fonts, or advertising from other services, and at the time of writing its host, GitHub Pages, does not set cookies either.{% if accounts_on %} The account and author pages connect to Supabase without cookies: your browser doesn't send cookies to Supabase or accept any from it through these pages.{% endif %} If you follow a link to another website, such as GitHub, LinkedIn, or Discord, that website may set its own cookies under its own policy.{% if form_key != "" %} If you send the contact form with JavaScript turned off, your browser briefly visits {{ contact_form.service }} before returning to this website, and that service may set its own cookies under its own policy.{% endif %}

## Managing cookies

Your browser lets you view, delete, and block cookies and other site data. To remove the saved theme preference, clear this website's data in your browser's settings (usually under Privacy or Site settings).{% if accounts_on %} This also signs you out and deletes any unsent post.{% endif %} The website works normally either way.

## Future services

If services that use cookies or similar technologies — such as analytics or embedded content — are ever added, this policy will be updated to list them, and your consent will be requested where the law requires it.

## Updates to this policy

I may update this Cookie Policy from time to time. The "Last updated" date at the top of this page shows when it last changed.

## Contact

Questions about this policy? Email {% include email-link.html key="business_primary" %}.

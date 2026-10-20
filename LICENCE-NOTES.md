# Licence notes — World Monitor fork

Reviewed 20 October 2026 against `34c4ce981a8f67b70bd5d261adcacb0f262b74b3` on `main`. The portfolio rates this edition **High**; this note grants no deployment approval.

The root [LICENSE](LICENSE) is AGPL-3.0. Retain its full text, copyright, modification and third-party notices. A paid product is not automatically prohibited, but distribution and modified network-service use must follow the applicable AGPL requirements. Ahmed's policy also requires the full matching source for a hosted or distributed AGPL build. Document the exact version, Corresponding Source, build/install instructions and user-facing source-access route before release. Proprietary use requires sufficient separate rights or an independent replacement. News, market and other data-provider terms need a separate assessment; a software licence does not grant rights to those feeds.

The latest inspected push CI is green, while scheduled Security Audit run `39401376378` reports expired-grace `shell-quote` and `sharp` advisories. Public fixed versions reported by that inspection are 1.11.0 and 0.35.5 respectively; dependency compatibility and fresh security checks still need verification. Do not weaken the audit or call that failure resolved by a documentation-only PR.

**Ahmed's decision:** approve a compliant source/release arrangement and authorise a separately reviewed dependency/security repair. No product dependency, workflow, copyright notice, repository visibility or deployment was changed here. Product changes and High-rated deployment remain on hold.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial public release scaffolding: portfolio CRUD, RDAP-based WHOIS, expiry alerts, scoring engine, DNS lookups, watchlist, dashboard, CSV/JSON import/export.
- GitHub workflows: CI (typecheck + build on Node 20/22), Docker image to GHCR, npm release on tag with provenance.
- Issue / PR templates, Dependabot, contributing & security policies.

## [0.1.0] - 2026-05-14

First tagged release.

- 📋 Portfolio CRUD with tags, notes, categories, BIN / buy / floor prices
- 🔍 RDAP-based WHOIS with port-43 fallback for TLDs without RDAP
- ⏰ Configurable expiry reminders + hourly cron worker
- 🎯 Availability checks and multi-TLD keyword scan
- 🏆 Deterministic brandability / length / vowel-ratio / keyword scoring
- 🔄 Typo / plural / singular / hyphen variant generators
- 🌐 DNS lookups (A / AAAA / MX / TXT / CNAME / SOA / SPF / DMARC)
- 🅿️ Parking provider detection via NS fingerprints
- 👀 Watchlist with NS / status / expiry / availability triggers
- 📊 Dashboard, stats, health checks
- 💾 Import / export CSV, JSON, NDJSON, TXT via document upload
- 🐳 Docker + docker-compose for one-line deploy

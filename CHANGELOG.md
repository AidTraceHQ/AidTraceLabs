# Changelog

All notable changes to AidTrace are documented here. This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses semantic versioning for releases.

## [0.1.0] - Unreleased

### Added

- Self-hosted Express API backed by PostgreSQL, with schema migrations and an admin seed command.
- Stellar wallet challenge authentication, role-aware record management, and transaction verification through Horizon.
- Public transparency and beneficiary record views with consent-aware data projection.
- Automated API, verification, utility, and frontend tests.
- Repository contribution, security, and community guidance.

### Known limitations

- No Soroban contract is part of this release.
- Browser-level Freighter journeys and production deployment have not been independently verified.
- A verified payment does not establish beneficiary identity, consent, or intended use of funds.

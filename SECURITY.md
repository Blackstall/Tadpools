# Security Policy

## Supported versions

Only the latest version on the `main` branch is supported with security updates.

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, report them privately via one of:

- GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository
- Email: farrisnasarudin02@gmail.com

Please include a description of the issue, steps to reproduce, and the potential impact. You can expect an initial response within a few days.

## Scope notes

Tadpools is designed to run locally with all services (PostgreSQL, MinIO, Ollama) on the operator's own machine. The default credentials in `docker-compose.yml` and `.env.example` are for local development only — **never expose these services to the public internet with default credentials.**

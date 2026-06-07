# Security Policy

## Reporting a Vulnerability

We take the security of our project seriously. If you discover a security
vulnerability, please **do not** open a public issue. Instead, report it
privately to the maintainers.

### How to Report

- **Email:** [INSERT SECURITY EMAIL]
- **Discord:** Join our [Discord server](https://discord.gg/example) and
  DM a maintainer.

Please include the following details in your report:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (if known)

### What to Expect

- **Acknowledgement:** You will receive a response within 48 hours.
- **Updates:** We will keep you informed of the progress toward a fix.
- **Disclosure:** Once a fix is released, we will publicly acknowledge the
  report (with your permission) and publish a security advisory.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Best Practices

- Never commit `.env` files or any secrets to version control.
- Rotate GitHub App private keys regularly.
- Use a dedicated GitHub App installation with minimal permissions.
- Review the audit log for unexpected webhook deliveries.

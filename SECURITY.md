# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report them privately through [GitHub's private vulnerability reporting](https://github.com/jurecki007/nyxiontech-tools/security/advisories/new), or contact Nyxiontech using the details on [nyxiontech.com](https://nyxiontech.com).

Please include the affected version (shown at the bottom of the sidebar), the steps to reproduce and the impact. We aim to acknowledge reports within a few working days.

## Supported versions

Only the latest release receives security fixes.

## Scope

The app processes documents only in the browser. Issues of particular interest:

- anything that sends document content or metadata off the device;
- redaction that leaves the hidden text recoverable;
- script execution through crafted PDF, DOCX, SVG or image files;
- weaknesses in the Content-Security-Policy or nginx configuration shipped in this repository.

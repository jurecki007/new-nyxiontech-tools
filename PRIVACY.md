# Privacy policy

Nyxiontech PDF Tools works on your device. Your documents, images and settings are never uploaded:
there is no account, no tracking, no analytics and no advertising.

## Web app

- Files are processed in your browser. Documents, snippets and settings are stored in the browser (IndexedDB and localStorage) and stay there until you delete them.
- The app only talks to the server it was loaded from: it loads its own files (fonts, OCR language data, the background-removal model) and checks `/version.json` for a newer version.
  Nothing else is requested, and the page's Content-Security-Policy blocks requests to any other site.
- Whoever runs the server can see the usual web server logs (for example your IP address and the files requested), but never your documents.

## Windows desktop app

- Files are processed on your computer. Documents and settings are stored per Windows user in `%LOCALAPPDATA%\com.nyxiontech.pdf-tools`.
- **Update check.** The app asks GitHub Releases (github.com) for the latest version number: when it starts, every 30 minutes and when the window is shown again.
  The request contains no information about you or your documents; like any web request, it shows GitHub your IP address. GitHub's privacy statement applies: <https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement>.
- **Turning it off.** Open **About** in the sidebar and untick **Check for updates automatically**. The app then never contacts GitHub on its own, only when you click **Check now**.
- **Installing an update** downloads the new installer from GitHub Releases, after you click **Install and restart**.
- **Links** to websites, such as nyxiontech.com, GitHub or Ko-fi, open in your default browser, and only when you click them.

## Third-party components

- The desktop app's window is Microsoft Edge WebView2, which is part of Windows. If it is missing, the installer downloads it from Microsoft.
  WebView2 is covered by Microsoft's privacy statement: <https://privacy.microsoft.com/privacystatement>.
- Every other library, font, OCR language file and AI model is bundled with the app and runs on your device. They are listed in THIRD-PARTY-NOTICES.txt.

## Uninstalling

Windows Settings > Apps > Installed apps > Nyxiontech PDF Tools > Uninstall. To remove your documents and settings too, delete `%LOCALAPPDATA%\com.nyxiontech.pdf-tools`.
In the web app, use "Clear all documents" on the dashboard, or clear the site's data in your browser.

## Contact

Questions about privacy: see the contact details on <https://nyxiontech.com>, or open an issue at <https://github.com/jurecki007/nyxiontech-tools/issues>.

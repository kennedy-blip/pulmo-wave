# PULMO-WAVE Release Artifact
The GitHub Actions workflow (`.github/workflows/build-and-bundle-apk.yml`)
compiles the Rust WASM kernel, Vue bundle, and Android APK (Gradle) and
bundles the result here as `pulmowave-release.apk` for Vercel deployment.
The in-app "Download .APK" button links to `/releases/pulmowave-release.apk`.

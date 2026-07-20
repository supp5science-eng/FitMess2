import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
// In this remote env, Chromium doesn't trust the outbound-proxy CA, so
// Google Fonts fetches fail their TLS check. Accept the proxy cert (render
// only — this binary never touches the public internet directly).
Config.setChromiumIgnoreCertificateErrors(true);

import { Config } from "@remotion/cli/config";

// Rendering defaults. Override any of these on the CLI, e.g.
//   npx remotion render FitMessLaunch out/video.mp4 --codec=h264 --crf=16
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setOverwriteOutput(true);
Config.setConcurrency(null); // auto — use all available cores

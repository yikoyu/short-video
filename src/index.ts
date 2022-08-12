import path from "node:path";
import minimist from "minimist";
import fse from "fs-extra";
import YAML from "js-yaml";

import { map, includes, find, isEqual, filter, sortBy } from "lodash-es";
import { getVideoKeyFrames, mapVideoResolution, getVideoName } from "./video";
import * as prompt from "./prompt";

interface ConfigOption {
  videoPath: string;
  outputDir: string;
  keyframes: { id: number; keyframe: number; checked: boolean }[];
  customFrames: number[];
  videos: { id: number; start: number; end: number; checked: boolean }[];
}

const args = minimist(process.argv.slice(2));

async function loadConfig(configPath: string): Promise<ConfigOption> {
  const access = await fse.pathExists(configPath);
  if (!access) {
    console.error(new Error("当前文件和路径不存在"));
    process.exit(0);
  }

  const config = YAML.load(fse.readFileSync(configPath, "utf8")) as ConfigOption;
  return config;
}

(async () => {
  const { config: configPath, skip = false } = args;

  const config: ConfigOption | null = configPath ? await loadConfig(configPath) : null;

  if (skip && config) {
    const outputDirName = path.resolve(config.outputDir, getVideoName(config.videoPath));
    const videos: [number, number][] = map(filter(config.videos, { checked: true }), (k) => [k.start, k.end]);

    mapVideoResolution(config.videoPath, outputDirName, videos);
    return;
  }

  const videoPath = await prompt.text.videoPath(config?.videoPath);

  // 获取视频关键帧
  const _keyframes = config?.keyframes ? map(config.keyframes, "keyframe") : await getVideoKeyFrames(videoPath);

  const keyframesDefaultValue = map(filter(config?.keyframes, { checked: true }), "keyframe");
  const keyframes = await prompt.multiselect.keyFrames(_keyframes, keyframesDefaultValue);

  // 输入自定义帧
  const customFrames = await prompt.list.customFrames(config?.customFrames);
  const allFrames = sortBy([...customFrames, ...keyframes]);

  // 生成视频片段帧
  const _videos: [number, number][] = [];
  for (let i = 0, len = allFrames.length; i < len; i++) {
    const oldkeyframe = allFrames[i - 1];
    const keyframe = allFrames[i];

    if (!isFinite(oldkeyframe) || !isFinite(keyframe)) continue;

    _videos.push([oldkeyframe, keyframe]);
  }

  // 选择视频片段
  const videosDefaultValue: [number, number][] = map(filter(config?.videos, { checked: true }), (k) => [k.start, k.end]);
  const videos = await prompt.multiselect.videos(_videos, videosDefaultValue);

  // 选择输出目录
  const outputDir = await prompt.text.output(config?.outputDir);
  const outputDirName = path.resolve(outputDir, getVideoName(videoPath));

  const options: ConfigOption = {
    videoPath,
    outputDir,
    keyframes: map(_keyframes, (k, i) => ({ id: i + 1, keyframe: k, checked: includes(keyframes, k) })),
    customFrames,
    videos: map(_videos, (k, i) => {
      const findVideo = find(videos, (i) => isEqual(i, k));

      return {
        id: i + 1,
        start: k[0],
        end: k[1],
        checked: findVideo ? true : false,
      };
    }),
  };
  const yamlStr = YAML.dump(options);

  await fse.ensureFile(`${outputDirName}/config.yaml`);
  await fse.writeFile(`${outputDirName}/config.yaml`, yamlStr, "utf8");

  mapVideoResolution(videoPath, outputDirName, videos);
})();


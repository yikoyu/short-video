import fse from "fs-extra";
import prompts from "prompts";
import { includes, map, padStart, trim, isEqual, find, isFinite, split, filter, join } from "lodash-es";

import { isVideo } from "./video";

const options = {
  onCancel: () => process.exit(0),
};

export const text = {
  async videoPath(defaultValue?: string): Promise<string> {
    const { videoPath } = await prompts(
      {
        type: "text",
        name: "videoPath",
        message: "请输入视频路径",
        hint: "SHIFT + 右键可快速复制文件路径",
        initial: defaultValue,
        format: (value) => trim(value),
        validate: async (value) => {
          const trimValue = trim(value);

          if (!trimValue) return "视频路径不能为空";

          const access = await fse.pathExists(trimValue);
          if (!access) return "当前文件和路径不存在";

          const stats = await fse.stat(trimValue);
          if (stats.isDirectory()) return "路径不能为目录";
          if (!isVideo(trimValue)) return "当前文件不为视频";
          return true;
        },
      },
      options
    );

    return videoPath;
  },

  async output(defaultValue?: string): Promise<string> {
    const { outputDir } = await prompts(
      {
        type: "text",
        name: "outputDir",
        message: "输入视频输出目录",
        initial: defaultValue,
        format: (value) => trim(value),
        validate: async (value) => {
          const trimValue = trim(value);

          if (!trimValue) return "输出路径不能为空";

          const access = await fse.pathExists(trimValue);
          if (!access) return "输出路径不存在";

          const stats = await fse.stat(trimValue);
          if (stats.isFile()) return "输出路径不能为文件";
          return true;
        },
      },
      options
    );

    return outputDir;
  },
};

export const list = {
  async customFrames(defaultValue?: number[]): Promise<number[]> {
    const { customFrames: value } = await prompts(
      {
        type: "list",
        name: "customFrames",
        message: "输入自定义帧 (秒)，英文逗号 (,) 分割",
        initial: defaultValue ? join(defaultValue, ",") : undefined,
        format: (value) =>
          map(
            filter(value, (k) => k !== ""),
            Number
          ),
        validate: (value) => {
          const finites = map(split(value, ","), (k) => isFinite(Number(k)));
          if (includes(finites, false)) return "输入的必须为数字";
          return true;
        },
      },
      options
    );

    return value;
  },
};

export const multiselect = {
  async keyFrames(keyframes: number[], defaultValue: number[] = []): Promise<number[]> {
    const choices = map(keyframes, (k, i) => {
      const SerialNums = padStart(String(i + 1), 3, "0");
      const Seconds = padStart(k.toFixed(2), 6, "0");

      return {
        title: `${SerialNums}: ${Seconds}秒`,
        selected: defaultValue.length > 0 ? includes(defaultValue, k) : true,
        value: k,
      };
    });

    const { checkedKeyFrames } = await prompts(
      {
        type: "multiselect",
        name: "checkedKeyFrames",
        message: "选择关键帧",
        choices,
      },
      options
    );

    return checkedKeyFrames;
  },

  async videos(videos: [number, number][], defaultValue: [number, number][] = []): Promise<[number, number][]> {
    const choices = map(videos, ([start, end], i) => {
      const SerialNums = padStart(String(i + 1), 3, "0");
      const startSeconds = padStart(start.toFixed(2), 6, "0");
      const endSeconds = padStart(end.toFixed(2), 6, "0");
      const videoSeconds = padStart((end - start).toFixed(2), 6, "0");

      const isChecked = find(defaultValue, (k) => isEqual(k, [start, end])) ? true : false;

      return {
        title: `${SerialNums}: ${startSeconds}秒 - ${endSeconds}秒，时长 ${videoSeconds}秒`,
        selected: defaultValue.length > 0 ? isChecked : true,
        value: [start, end],
      };
    });

    const { checkedVideos } = await prompts(
      {
        type: "multiselect",
        name: "checkedVideos",
        message: "选择视频片段",
        choices,
      },
      options
    );

    return checkedVideos;
  },
};


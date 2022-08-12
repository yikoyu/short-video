import path from "node:path";
import { execaCommand } from "execa";
import { Listr, ListrTask } from "listr2";
import ora from "ora";

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";

import os from "node:os";
import { filter, map, padStart } from "lodash-es";
import { getVideoDurationInSeconds } from "get-video-duration";

interface VideoResolutionOptions {
  output: string;
  start: number;
  duration: number;
}

/**
 * 获取视频关键帧
 * @param {string} video
 * @return {*}  {Promise<number[]>}
 */
export async function getVideoKeyFrames(video: string): Promise<number[]> {
  const cmd = `${ffprobePath.path} -i ${video} -select_streams v -show_entries frame=key_frame,pkt_pts_time -of json`;
  let videoDuration: number | null;

  return new Promise<number[]>((resolve, reject) => {
    const spinner = ora("正在识别视频关键帧...").start();

    getVideoDurationInSeconds(video)
      .then((duration) => {
        videoDuration = duration;

        return execaCommand(cmd);
      })
      .then((command) => {
        try {
          const keyFrameJson = JSON.parse(command.stdout);
          const keyFrames = map(filter(keyFrameJson?.frames, { key_frame: 1 }), (k) => Number(k.pkt_pts_time));
          resolve(videoDuration ? [...keyFrames, videoDuration] : keyFrames);
          spinner.stop();
        } catch (error) {
          reject(error);
          spinner.stop();
        }
      })
      .catch((error) => {
        reject(error);
        spinner.stop();
      });
  });
}

/**
 * 视频按照时间截取
 * @param {string} video
 * @param {VideoResolutionOptions} { output, start, duration }
 * @return {*}  {Promise<void>}
 */
export function videoResolution(video: string, { output, start, duration }: VideoResolutionOptions): Promise<void> {
  // const cmd = [ffmpegPath.path, `-ss ${start}`, `-i ${video}`, '-y', '-filter_complex hflip', '-acodec aac', '-b:a 64k', '-vcodec libx264', `-t ${duration}`, path.resolve(process.cwd(), output)]
  return new Promise<void>((resolve, reject) => {
    ffmpeg(path.resolve(process.cwd(), video))
      .setFfmpegPath(ffmpegPath.path)
      .setStartTime(start)
      .setDuration(duration)
      .filterGraph("hflip")
      .videoCodec("libx264")
      .audioCodec("aac")
      .audioBitrate("64k")
      .output(path.resolve(process.cwd(), output))
      // .noAudio()
      // .on("progress", progress => {
      //   console.log('progress :>> ', progress)
      //   // console.log("Processing: " + progress.percent + "% done");
      // })
      // .on("start", function (commandLine) {
      //   console.log("Spawned Ffmpeg with command: " + commandLine);
      // })
      .on("end", () => {
        // console.log("video one end");
        resolve();
      })
      .on("error", (error) => {
        console.log("an error happend: create one video" + error);
        reject(error);
      })
      .run();
  });
}

/**
 * 视频批量时间截取
 * @param {string} video
 * @param {[number, number][]} arr
 */
export async function mapVideoResolution(video: string, outputDir: string, arr: [number, number][]) {
  const concurrent = os.cpus().length;

  const taskList: ListrTask[] = map(arr, ([start, end], i) => {
    const output = `${outputDir}/${i + 1}.mp4`;

    const SerialNums = padStart(String(i + 1), 2, "0");
    const startSeconds = padStart(start.toFixed(2), 6, "0");
    const endSeconds = padStart(end.toFixed(2), 6, "0");
    const videoSeconds = padStart((end - start).toFixed(2), 6, "0");

    const title = `${SerialNums}/${arr.length} ${startSeconds}秒 - ${endSeconds}秒，时长 ${videoSeconds}秒`;

    const taskItem: ListrTask = {
      title,
      task: () => videoResolution(video, { output, start, duration: end - start }),
    };

    return taskItem;
  });

  const tasks = new Listr(taskList, { concurrent });

  console.time('任务执行时间')
  await tasks.run();
  console.timeEnd('任务执行时间')
}

/**
 * 判断路径是否为视频
 * @export
 * @param {string} _path
 * @return {*}  {boolean}
 */
export function isVideo(_path: string): boolean {
  const videoExt: string[] = [
    "3g2",
    "3gp",
    "aaf",
    "asf",
    "avchd",
    "avi",
    "drc",
    "flv",
    "m2v",
    "m3u8",
    "m4p",
    "m4v",
    "mkv",
    "mng",
    "mov",
    "mp2",
    "mp4",
    "mpe",
    "mpeg",
    "mpg",
    "mpv",
    "mxf",
    "nsv",
    "ogg",
    "ogv",
    "qt",
    "rm",
    "rmvb",
    "roq",
    "svi",
    "vob",
    "webm",
    "wmv",
    "yuv",
  ];

  const ext = path.extname(_path).slice(1).toLowerCase();

  return videoExt.includes(ext);
}

/**
 * 获取不带后缀文件名
 * @export
 * @param {string} videoPath
 * @return {*}  {string}
 */
export function getVideoName(videoPath: string): string {
  const ext = path.extname(videoPath);

  return path.basename(videoPath, ext);
}


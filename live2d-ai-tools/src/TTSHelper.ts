import {WSData, WSDataType} from './types/WSData';

declare class webkitAudioContext extends AudioContext {
}

/**
 * 语音合成助手
 */
export class TTSHelper {
  private static ins: TTSHelper

  /**
   * 是否正在播放
   */
  public isPlaying: boolean;

  /**
   * 音频播放结束的回调函数
   * currentTaskListLength: 当前音频播放的任务队列长度
   */
  public onEnded: (currentTaskListLength: number) => {};

  /**
   * ttsWorker.js 的资源路径
   * @private
   */
  private readonly workerUrl: string;

  /**
   * 和服务器通信的 ws 链接地址
   * @private
   */
  private readonly wsUrl: string;

  /**
   * 和服务器通信的 WebSocket
   * @private
   */
  private ws: WebSocket;

  /**
   * 语音合成的 worker 线程
   * @private
   */
  private worker: Worker;

  /**
   * 播放任务队列
   * 数组成员为要播放的文本
   */
  private taskList: string[];

  private audioData: any[];
  private audioContext: AudioContext;
  private audioDataOffset: number;
  private timerId: number;
  private bufferSource: AudioBufferSourceNode;
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private text: string;

  private constructor(workerUrl, wsUrl) {
    this.workerUrl = workerUrl;
    this.wsUrl = wsUrl;
    this.audioData = [];
    this.taskList = [];
    this.isPlaying = false;
    this.initWorker();
    this.startTaskCheck();
    TTSHelper.ins = this
  }

  public static getInstance(workerUrl?: string, wsUrl?: string) {
    return TTSHelper.ins || new TTSHelper(workerUrl, wsUrl)
  }

  /**
   * 初始化 worker
   * @private
   */
  private initWorker() {
    this.worker = new Worker(this.workerUrl);
    this.worker.onmessage = (e) => {
      this.audioData.push(...e.data.data);
      console.log('on worker message', this.audioData.length);
    };
  }

  /**
   * 开始监视任务队列
   * @private
   */
  private startTaskCheck() {
    setInterval(async () => {
      if (this.taskList.length > 0 && !this.isPlaying) {
        const text = this.taskList.shift();
        await this.exec(text);
      }
    }, 40);
  }

  /**
   * 初始化音频播放对象
   * @private
   */
  private async initAudio() {
    const AudioContext = window.AudioContext || webkitAudioContext;
    if (AudioContext) {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      this.audioDataOffset = 0;
    }
  }

  /**
   * 添加播放队列
   * @param text 语音播报的文本
   */
  public async play(text) {
    this.taskList.push(text);
  }

  /**
   * 停止播放
   */
  public async stop() {
    this.taskList.splice(0, this.taskList.length);
    this.audioStop();
  }

  /**
   * 执行语音合成 不进入队列
   * @param text 语音播报的文本
   */
  public async exec(text) {
    if (this.isPlaying) return;
    this.isPlaying = true;
    console.log('ttshelper play');
    this.text = text;
    await this.initAudio();
    await this.connectWs();
    this.timerId = setTimeout(() => {
      this.audioPlay();
    }, 1000);
  }

  // 科大讯飞返回的状态值 status:
  // 1: 合成中
  // 2: 合成结束
  private connectWs() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener('message', e => {
        const data: WSData = JSON.parse(e.data);
        console.log(data);
        // 服务器成功连接 xfyun
        switch (data.type) {
          case WSDataType.Ready:
            this.ws.send(JSON.stringify(WSData.build(WSDataType.TTS, this.text, 'tts')))
            break;
          case WSDataType.SpeechReply:
            this.worker.postMessage(data.data.audio);
            if (data.data.status === 2) {
              this.ws.close();
            }
            break;
        }
        resolve(undefined);
      });
      this.ws.addEventListener('close', e => {
        console.log('ws close');
      });
    });
  }

  /**
   * 获取口型音强
   */
  public getRms(): number {
    if (this.analyser && this.dataArray && this.dataArray.length > 0) {
      this.analyser.getByteFrequencyData(this.dataArray);
      // let max = this.dataArray.reduce((p, n) => Math.max(p, n))
      // return max / 255
      const volume = this.dataArray.reduce((p, n) => p + n, 0) / this.dataArray.length
      let normalizedVolume = volume / 255; // 将音量值从 0~255 转换为 0~1
      // 音量放大
      normalizedVolume *= 2.5
      // 将音量值限制在 0~1 之间
      return Math.max(0, Math.min(1, normalizedVolume))
    } else return 0
  }

  /**
   * 音频播放
   * @private
   */
  private audioPlay() {
    console.log('audioPlay', this.audioData.length);
    let audioData = this.audioData.slice(this.audioDataOffset);
    this.audioDataOffset += audioData.length;
    console.log('audioDataOffset', this.audioDataOffset);
    let audioBuffer = this.audioContext.createBuffer(1, audioData.length, 22050);
    let nowBuffering = audioBuffer.getChannelData(0);
    if (audioBuffer.copyToChannel) {
      audioBuffer.copyToChannel(new Float32Array(audioData), 0, 0);
    } else {
      for (let i = 0; i < audioData.length; i++) {
        nowBuffering[i] = audioData[i];
      }
    }
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.connect(this.audioContext.destination);
    let bufferSource = this.bufferSource = this.audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(this.audioContext.destination);
    bufferSource.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    bufferSource.start();
    bufferSource.onended = event => {
      console.log('play end');
      console.log(this.audioDataOffset);
      console.log(this.audioData.length);
      console.log(this.audioDataOffset < this.audioData.length);
      if (this.audioDataOffset < this.audioData.length) {
        this.audioPlay();
      } else {
        this.audioStop();
        typeof this.onEnded === 'function' && this.onEnded(this.taskList.length);
      }
    };
  }

  /**
   * 音频播放结束
   * @private
   */
  private audioStop() {
    this.audioDataOffset = 0;
    this.audioData.splice(0, this.audioData.length);
    clearTimeout(this.timerId);
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
      } catch (e) {
        console.log(e);
      }
    }
    this.isPlaying = false;
  }
}
import {WSData, WSDataType} from "./types/WSData";
import {WSIatData, WSIatType} from "./types/WSIatData";

/**
 * 语音听写助手
 */
export class IATHelper {
  private static ins: IATHelper

  /**
   * 正在录音
   */
  public recording: boolean = false;
  /**
   * 一个用来接收听写结果的函数
   */
  private receiveWordsCallback: (text: string) => void
  /**
   * xfyun断开连接回调
   * @private
   */
  private iatCloseCallback: () => void

  private readonly workerUrl: string;
  private readonly wsUrl: string;
  private ws: WebSocket;
  private worker: Worker;
  private audioData: any[];
  private audioContext: AudioContext;
  private stream: any;
  private scriptProcessor: ScriptProcessorNode;
  private mediaSource: MediaStreamAudioSourceNode;
  private timerId: number;
  private intervalId: number;
  private resultText: string;
  private resultTextTemp: string;
  private textTemp: string;
  /**
   * 自动连续录音的超时时间
   * @private
   */
  private timeout: number;
  private waitForStop: boolean;

  private constructor(workerUrl, wsUrl) {
    this.workerUrl = workerUrl
    this.wsUrl = wsUrl
    this.audioData = [];
    this.resultText = '';
    this.resultTextTemp = '';
    this.timeout = 10000;
    this.waitForStop = false;
    this.initMicrophone().then()
    this.initWorker();
    IATHelper.ins = this
  }

  public static getInstance(workerUrl?: string, wsUrl?: string): IATHelper {
    return IATHelper.ins || new IATHelper(workerUrl, wsUrl)
  }

  private initWorker() {
    this.worker = new Worker(this.workerUrl);
    this.worker.onmessage = (e) => {
      // 正在录音且 没有等待iat听写结束
      if (this.recording && !this.waitForStop) {
        this.audioData.push(...e.data);
      }
    };
  }


  private initMicrophone(): Promise<any> {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      navigator.getUserMedia =
        // @ts-ignore
        navigator.getUserMedia ||
        // @ts-ignore
        navigator.webkitGetUserMedia ||
        // @ts-ignore
        navigator.mozGetUserMedia ||
        // @ts-ignore
        navigator.msGetUserMedia;

      // 创建音频环境
      try {
        // @ts-ignore
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioContext.resume().then();
        if (!this.audioContext) {
          alert('浏览器不支持webAudioApi相关接口');
          reject(new Error('浏览器不支持webAudioApi相关接口'))
          return;
        }
      } catch (e) {
        if (!this.audioContext) {
          alert('浏览器不支持webAudioApi相关接口');
          reject(new Error('浏览器不支持webAudioApi相关接口'))
          return;
        }
      }

      // 获取浏览器录音权限
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({
            audio: true,
            video: false,
          })
          .then(stream => {
            this.stream = stream
            resolve(this.stream)
          }).catch(reject)
        // @ts-ignore
      } else if (navigator.getUserMedia) {
        // @ts-ignore
        navigator.getUserMedia(
          {
            audio: true,
            video: false,
          },
          stream => {
            this.stream = stream
            resolve(this.stream)
          },
          reject
        );
      } else {
        if (navigator.userAgent.toLowerCase().match(/chrome/) && location.origin.indexOf('https://') < 0) {
          alert('chrome下获取浏览器录音功能，因为安全性问题，需要在localhost或127.0.0.1或https下才能获取权限');
        } else {
          alert('无法获取浏览器录音功能，请升级浏览器或使用chrome');
        }
        this.audioContext && this.audioContext.close();
        reject(new Error('浏览器不支持'))
      }
    })
  }

  private processStream(): void {
    // // 创建一个用于通过JavaScript直接处理音频
    this.scriptProcessor = this.audioContext.createScriptProcessor(0, 1, 1);
    this.scriptProcessor.onaudioprocess = e => {
      if (this.recording)
        this.worker.postMessage(e.inputBuffer.getChannelData(0));
    };
    // 创建一个新的MediaStreamAudioSourceNode 对象，使来自MediaStream的音频可以被播放和操作
    this.mediaSource = this.audioContext.createMediaStreamSource(this.stream);
    // 连接
    this.mediaSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  private connectWs(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener('open', e => {
        resolve()
      })
      this.ws.addEventListener('message', async (e) => {
        const wsData: WSData = JSON.parse(e.data)
        switch (wsData.type) {
          case WSDataType.Ready:
            this.sendAudio();
            break;
          case WSDataType.IATReply:
            const json = JSON.parse(wsData.data);
            if (json.code !== 0) {
              console.error('远程api调用异常');
              console.log(json)
              await this.stopRecordImmediately()
              return;
            }
            this.setWords(json.data);
            if (json.data.status === 2) {
              console.log('转写结束')
              console.log(json)
              // 远程api转写结束
              await this.stopRecordImmediately();
            }
            break;
        }
      })

      this.ws.addEventListener('close', e => {
        console.log('iat close')
        typeof this.iatCloseCallback === 'function' && this.iatCloseCallback()
      })
    });
  }

  /**
   * 开始录音
   * @param receiveWordsCallback 接收到听写结果回调
   * @param iatCloseCallback xfyun断开连接回调
   */
  public async startRecord(receiveWordsCallback?: (text: string) => void, iatCloseCallback?: () => void) {
    if (this.recording) return
    this.recording = true;
    if (typeof receiveWordsCallback === 'function')
      this.receiveWordsCallback = receiveWordsCallback
    if (typeof iatCloseCallback === 'function')
      this.iatCloseCallback = iatCloseCallback
    // 重置结果
    this.resultText = '';
    this.resultTextTemp = '';
    this.textTemp = '';
    this.initMicrophone().then(() => {
      this.processStream();
    })
    await this.connectWs();
  }

  // 立即停止
  public async stopRecordImmediately(): Promise<void> {
    if (!this.recording) return
    this.recording = false;
    this.waitForStop = false;
    clearTimeout(this.timerId);
    clearInterval(this.intervalId);
    this.audioData = [];
    this.receiveWordsCallback = null
    try {
      this.ws.close();
    } catch (e) {
    }
  }

  // 停止录音，但要等到所有音频转换成文本后再关闭
  public async stopRecord(): Promise<void> {
    if (!this.recording || this.waitForStop) return
    this.waitForStop = true
  }

  public async waitForRecordingStop(): Promise<void> {
    await new Promise(r => {
      const timer = setInterval(() => {
        if (!this.recording) {
          clearInterval(timer)
          r(undefined)
        }
      }, 40)
    })
  }

  private sendAudio() {
    this.timerId = setTimeout(() => {
      // 发送第一帧
      let audioData = this.audioData.splice(0, 1280);
      console.log('发送第一帧后的长度', this.audioData.length);
      this.ws.send(JSON.stringify(WSData.build(WSDataType.IAT, WSIatData.build(WSIatType.First, this.toBase64(audioData)))))

      // 中间帧处理
      this.intervalId = setInterval(async () => {
        if (!this.recording) {
          await this.stopRecordImmediately();
          return;
        }
        if (this.audioData.length === 0) {
          console.log('触发最后一帧');
          // 音频数据被发送完后的处理
          this.ws.send(JSON.stringify(WSData.build(WSDataType.IAT, WSIatData.build(WSIatType.End))))
          this.audioData = [];
          clearInterval(this.intervalId);
          return;
        }
        audioData = this.audioData.splice(0, 1280);
        // console.log('发送中间帧后的长度', this.audioData.length);
        // 中间帧
        this.ws.send(JSON.stringify(WSData.build(WSDataType.IAT, WSIatData.build(WSIatType.Other, this.toBase64(audioData)))))
      }, 40);
    }, 1000);
  }

  // 对处理后的音频数据进行base64编码，
  private toBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private setWords({result, status}) {
    const words = result.ws.map(item => item.cw.map(item => item.w).join()).join('');
    if (result.pgs === 'apd') {
      this.resultTextTemp += words;
      this.textTemp = '';
    } else if (result.pgs === 'rpl') {
      // this.resultTextTemp.splice(result.rg[0] - 1, result.rg[1], ...result.ws);
      this.resultTextTemp = words;
    }
    if (status === 2) {
      // this.resultText.push(...this.resultTextTemp);
      // this.resultTextTemp = [];
      this.resultText += this.resultTextTemp + this.textTemp;
      this.resultTextTemp = '';
      this.textTemp = '';
    }
    // const words = this.resultText.map(item => item.cw.map(item => item.w).join()).join('');
    // const tempWords = this.resultTextTemp.map(item => item.cw.map(item => item.w).join()).join('');
    // textarea.value = this.resultText + this.resultTextTemp + this.textTemp;
    typeof this.receiveWordsCallback === 'function' && this.receiveWordsCallback(this.resultText + this.resultTextTemp + this.textTemp)
  }

}
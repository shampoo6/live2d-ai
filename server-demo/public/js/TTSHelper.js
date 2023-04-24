class TTSHelper {
    ws;
    audioData;
    worker;
    audioContext;
    audioDataOffset;
    timerId;
    bufferSource;
    analyser;
    dataArray;
    text;
    onEnded;

    constructor() {
        this.audioData = [];
        this.initWorker();
    }

    initWorker() {
        this.worker = new Worker('./js/ttsWorker.js');
        this.worker.onmessage = (e) => {
            this.audioData.push(...e.data.data);
            console.log('on worker message', this.audioData.length);
        };
    }

    initAudio() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            this.audioContext = new AudioContext();
            this.audioContext.resume().then();
            this.audioDataOffset = 0;
        }
    }

    play(text) {
        return new Promise(resolve => {
            this.onEnded = resolve;
            console.log('ttshelper play');
            this.initAudio();
            this.connectWs().then(() => {
                this.text = text;
                // this.ws.send(text);
                this.timerId = setTimeout(() => {
                    this.audioPlay();
                }, 1000);
            });
        });
    }

    // status:
    // 2: 合成结束
    // 3: 异常
    // ready:
    // 准备好了，可以进行通信
    connectWs() {
        return new Promise((resolve, reject) => {
            this.ws = new WS('ws://127.0.0.1/tts');
            this.ws.on('open', e => {
                resolve();
            });
            this.ws.on('ready', json => {
                this.ws.send(WSRequest.build('tts', this.text));
            });
            this.ws.on('message', json => {
                console.log(json);
                this.worker.postMessage(json.audio);
                if (json.status === 2) {
                    this.ws.close();
                }
            });
            this.ws.on('close', e => {
                console.log(e);
            });
        });
    }

    // 音频播放
    audioPlay() {
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
                typeof this.onEnded === 'function' && this.onEnded();
            }
        };
    }

    // 音频播放结束
    audioStop() {
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
    }
}
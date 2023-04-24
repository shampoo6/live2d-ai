window.TTSHelper = (() => {
    return class {
        workerUrl;
        wsUrl;
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
        // 播放任务队列
        // 数组成员为要播放的文本
        taskList;
        // 是否正在播放
        isPlaying;

        constructor(workerUrl, wsUrl) {
            this.workerUrl = workerUrl;
            this.wsUrl = wsUrl;
            this.audioData = [];
            this.taskList = [];
            this.isPlaying = false;
            this.initWorker();
            this.startTaskCheck();
        }

        initWorker() {
            this.worker = new Worker(this.workerUrl);
            this.worker.onmessage = (e) => {
                this.audioData.push(...e.data.data);
                console.log('on worker message', this.audioData.length);
            };
        }

        startTaskCheck() {
            setInterval(() => {
                if (this.taskList.length > 0 && !this.isPlaying) {
                    const text = this.taskList.shift();
                    this.exec(text);
                }
            }, 40);
        }

        async initAudio() {
            // @ts-ignore
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioContext = new AudioContext();
                await this.audioContext.resume();
                this.audioDataOffset = 0;
            }
        }

        // 添加播放队列
        async play(text) {
            this.taskList.push(text);
        }

        // 停止播放
        async stop() {
            this.taskList.splice(0, this.taskList.length);
            this.audioStop();
        }

        // 执行语音合成
        async exec(text) {
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

        // status:
        // 1: 合成中
        // 2: 合成结束
        connectWs() {
            return new Promise((resolve, reject) => {
                this.ws = new WebSocket(this.wsUrl);
                this.ws.addEventListener('message', e => {
                    const data = JSON.parse(e.data);
                    console.log(data);
                    // 服务器成功连接 xfyun
                    switch (data.type) {
                        case 1:
                            this.ws.send(JSON.stringify({
                                type: 4,
                                data: this.text,
                                message: 'tts',
                            }));
                            resolve();
                            break;
                        case 3:
                            this.worker.postMessage(data.data.audio);
                            if (data.status === 2) {
                                this.ws.close();
                            }
                            break;
                    }
                });
                this.ws.addEventListener('close', e => {
                    console.log('ws close');
                });
            });
        }

        /**
         * 获取口型音强
         */
        getRms() {
            if (this.analyser && this.dataArray && this.dataArray.length > 0) {
                this.analyser.getByteFrequencyData(this.dataArray);
                let max = this.dataArray.reduce((p, n) => Math.max(p, n))
                return max / 255
            } else return 0
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
                    typeof this.onEnded === 'function' && this.onEnded(this.taskList.length);
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
            this.isPlaying = false;
        }
    };
})();
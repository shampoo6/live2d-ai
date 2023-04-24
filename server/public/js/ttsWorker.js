// 语音合成worker
(function () {
    var minSampleRate = 22050;
    self.onmessage = function (e) {
        transcode.transToAudioData(e.data);
    };
    var transcode = {
        transToAudioData: function (audioDataStr, fromRate, toRate) {
            if (fromRate === void 0) { fromRate = 16000; }
            if (toRate === void 0) { toRate = 22505; }
            var outputS16 = transcode.base64ToS16(audioDataStr);
            var output = transcode.transS16ToF32(outputS16);
            output = transcode.transSamplingRate(output, fromRate, toRate);
            output = Array.from(output);
            self.postMessage({
                data: output,
                rawAudioData: Array.from(outputS16)
            });
        },
        transSamplingRate: function (data, fromRate, toRate) {
            if (fromRate === void 0) { fromRate = 44100; }
            if (toRate === void 0) { toRate = 16000; }
            var fitCount = Math.round(data.length * (toRate / fromRate));
            var newData = new Float32Array(fitCount);
            var springFactor = (data.length - 1) / (fitCount - 1);
            newData[0] = data[0];
            for (var i = 1; i < fitCount - 1; i++) {
                var tmp = i * springFactor;
                var before = Math.floor(tmp).toFixed();
                var after = Math.ceil(tmp).toFixed();
                var atPoint = tmp - Number(before);
                newData[i] = data[before] + (data[after] - data[before]) * atPoint;
            }
            newData[fitCount - 1] = data[data.length - 1];
            return newData;
        },
        transS16ToF32: function (input) {
            var tmpData = [];
            for (var i = 0; i < input.length; i++) {
                var d = input[i] < 0 ? input[i] / 0x8000 : input[i] / 0x7fff;
                tmpData.push(d);
            }
            return new Float32Array(tmpData);
        },
        base64ToS16: function (base64AudioData) {
            base64AudioData = atob(base64AudioData);
            var outputArray = new Uint8Array(base64AudioData.length);
            for (var i = 0; i < base64AudioData.length; ++i) {
                outputArray[i] = base64AudioData.charCodeAt(i);
            }
            return new Int16Array(new DataView(outputArray.buffer).buffer);
        },
    };
})();
//# sourceMappingURL=ttsWorker.js.map
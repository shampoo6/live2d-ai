(() => {
    window.WordsSpliter = class {
        replaceRegex = /\s/g;
        breakWordsRegex = /[?!。？！]/;
        // 已经发送过的文本
        postedText = '';
        sendTextHandler;

        constructor(sendTextHandler) {
            this.sendTextHandler = sendTextHandler;
        }

        processWords(text) {
            if (text.length <= this.postedText) return;
            // 获取增量
            let str = text.substring(this.postedText.length);
            // 判断增量中是否有断句符号
            const r = str.match(this.breakWordsRegex);
            if (r) {
                str = str.substring(0, str.lastIndexOf(r[0]) + 1);
                this.postedText += str;
                // 去空白符
                str = str.replace(this.replaceRegex, '');
                if (str.length > 0) {
                    // send
                    console.log('done: ', str);
                    typeof this.sendTextHandler === 'function' && this.sendTextHandler(str);
                }
            }
        }


        // text: 结束句子拆分完成后，最后的完整文本
        over(text) {
            if (text.length <= this.postedText) {
                this.reset();
                return;
            }
            // 获取增量
            let str = text.substring(this.postedText.length);
            str = str.replace(this.replaceRegex, '');
            if (str.length > 0) {
                // send
                console.log('over: ', str);
                typeof this.sendTextHandler === 'function' && this.sendTextHandler(str);
            }
            this.reset();
        }

        reset() {
            this.postedText = '';
        }
    };
})();
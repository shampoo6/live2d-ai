(() => {
    window.WS = class {
        ws;
        // 事件包括:
        // open
        // message
        // close
        // ready: 准备完成事件，表示可以开始通信了
        events;

        constructor(url) {
            this.events = {};
            this.ws = new WebSocket(url);
            this.ws.addEventListener('open', e => {
                const handler = this.events['open'];
                typeof handler === 'function' && handler(e);
            });
            this.ws.addEventListener('message', e => {
                let handler;
                const json = JSON.parse(e.data);
                // 有异常就自动关闭
                if (!json.success) {
                    console.error(json.message);
                    this.ws.close();
                } else if (json.data === 'ready') {
                    handler = this.events['ready'];
                } else if (json.data.type === 'report') {
                    console.log(json.data.data);
                } else {
                    handler = this.events['message'];
                }
                if (typeof handler !== 'function') return;
                handler(json.data);
            });
            this.ws.addEventListener('close', e => {
                const handler = this.events['close'];
                if (typeof handler !== 'function') return;
                handler(e);
            });
        }

        on(eventName, handler) {
            if (!['open', 'message', 'close', 'ready'].includes(eventName)) {
                console.error('错误的事件名', eventName);
                return;
            }
            this.events[eventName] = handler;
        }

        send(params) {
            if (typeof params === 'object') params = JSON.stringify(params);
            this.ws.send(params);
        }

        close() {
            this.ws.close();
        }
    };
})();
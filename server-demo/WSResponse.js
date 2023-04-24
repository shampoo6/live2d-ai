module.exports = class WSResponse {
    // 是否请求成功
    success;
    // 消息数据
    message;
    // 数据体
    // 规定: data 为 ready 说明客户端可以使用 send 发送数据了
    data;

    constructor(success = true, message = 'ok', data = null) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    static success(data = null, message = 'ok') {
        return JSON.stringify(new WSResponse(true, message, data));
    }

    static fail(message = 'fail', data = null) {
        return JSON.stringify(new WSResponse(false, message, data));
    }

    static ready() {
        return JSON.stringify(new WSResponse(true, 'ok', 'ready'));
    }
};
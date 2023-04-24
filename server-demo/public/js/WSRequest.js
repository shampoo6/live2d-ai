(() => {
    window.WSRequest = class {
        // 业务类型
        // 用于描述这次要做什么
        type;
        // 数据体
        data;

        constructor(type, data) {
            this.type = type;
            this.data = data;
        }

        static build(type, data) {
            return JSON.stringify(new WSRequest(type, data));
        }
    };
})();
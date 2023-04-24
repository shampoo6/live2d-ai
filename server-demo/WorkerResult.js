module.exports = class WorkerResult {
    type;
    data;

    constructor(type, data) {
        this.type = type;
        this.data = data;
    }

    static ready() {
        return new WorkerResult('ready');
    }

    static build(type, data) {
        return new WorkerResult(type, data);
    }
};
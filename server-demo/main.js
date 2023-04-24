const express = require('express');
const WebSocket = require('ws');
const CryptoJS = require('crypto-js');
const path = require('path');
const fs = require('fs');
const app = express();
require('express-ws')(app);
const {xfyun: config} = require('./config');
const WSResponse = require('./WSResponse');
const WorkerResult = require('./WorkerResult');
const {Worker} = require('node:worker_threads');
const moment = require('moment');
const pino = require('pino');
const pretty = require('pino-pretty');
const logPath = path.resolve(__dirname, 'logs', `${moment().format('YYYY-MM-DD_HH_mm_ss')}.log`);
fs.writeFileSync(logPath, '');
const streams = [
    {stream: fs.createWriteStream(logPath)},
    {stream: pretty()}
];
const logger = pino({level: 'info'}, pino.multistream(streams));

// 存放所有worker的map
// const workerMap = new Map();
let worker;
initAIWorker().then(_worker => {
    worker = _worker;
});

app.use('/', express.static(path.resolve(__dirname, 'public')));

// 逐字发送
app.ws('/sendWords', (ws, req) => {
    logger.info(ws);
    ws.on('message', e => {
        logger.info('message', e);
        bz(e, ws);
    });
    ws.on('close', function () {
        logger.info('The connection was closed!');
    });
    // ws.close();
});

// 语音合成
app.ws('/tts', (ws, req) => {
    const date = (new Date().toUTCString());
    const wssUrl = config.tts + '?authorization=' + getAuthStr(date) + '&date=' + date + '&host=' + config.host;
    const _ws = new WebSocket(wssUrl);

    _ws.on('open', () => {
        logger.info('open');
        ws.send(WSResponse.ready());
    });
    _ws.on('message', (data, err) => {
        logger.info('message');

        if (err) {
            ws.send(WSResponse.fail(err.message));
            console.error(err);
            _ws.close();
            return;
        }

        let res = JSON.parse(data);
        logger.info(res);

        if (res.code !== 0) {
            ws.send(WSResponse.success({status: 3, data: `${res.code}: ${res.message}`}));
            _ws.close();
            return;
        }

        let audio = res.data.audio;
        let params = {audio, status: 1};
        if (res.code === 0 && res.data.status === 2) {
            params.status = 2;
            _ws.close();
        }
        ws.send(WSResponse.success(params));
    });
    _ws.on('close', e => {
        logger.info('close');
        logger.info(e);
    });

    ws.on('message', e => {
        logger.info(e);
        const json = JSON.parse(e);
        let frame = {
            // 填充common
            'common': {
                'app_id': config.appid
            },
            // 填充business
            'business': {
                'aue': 'raw',
                'auf': 'audio/L16;rate=16000',
                'vcn': 'xiaoyan',
                'tte': 'UTF8'
            },
            // 填充data
            'data': {
                'text': Buffer.from(json.data).toString('base64'),
                'status': 2
            }
        };
        _ws.send(JSON.stringify(frame));
    });
});

// 语音听写
app.ws('/iat', (ws, req) => {
    const wssUrl = getWebSocketUrl();
    const _ws = new WebSocket(wssUrl);

    _ws.on('open', () => {
        logger.info('open');
        ws.send(WSResponse.ready());
    });
    _ws.on('message', (data, err) => {
        logger.info('api message');
        if (err) {
            ws.send(WSResponse.fail(err.message));
            console.error(err);
            return;
        }
        logger.info(data.toString());
        ws.send(WSResponse.success(data.toString()));
    });
    _ws.on('close', e => {
        logger.info('close');
        logger.info(e);
    });

    ws.on('message', e => {
        logger.info('server message');
        const json = JSON.parse(e);
        let params;
        if (json.type === 'first') {
            params = {
                common: {
                    app_id: config.appid,
                },
                business: {
                    language: 'zh_cn', //小语种可在控制台--语音听写（流式）--方言/语种处添加试用
                    domain: 'iat',
                    accent: 'mandarin', //中文方言可在控制台--语音听写（流式）--方言/语种处添加试用
                    vad_eos: 2000,
                    dwa: 'wpgs', //为使该功能生效，需到控制台开通动态修正功能（该功能免费）
                },
                data: {
                    status: 0,
                    format: 'audio/L16;rate=16000',
                    encoding: 'raw',
                    audio: json.data,
                },
            };
        } else if (json.type === 'other') {
            params = {
                data: {
                    status: 1,
                    format: 'audio/L16;rate=16000',
                    encoding: 'raw',
                    audio: json.data,
                },
            };
        } else if (json.type === 'end') {
            params = {
                data: {
                    status: 2,
                    format: 'audio/L16;rate=16000',
                    encoding: 'raw',
                    audio: '',
                },
            };
        } else {
            const message = '未知业务: ' + json.type;
            ws.send(WSResponse.fail(message));
            console.error(message);
        }
        _ws.send(JSON.stringify(params));
    });
});

// ChatGPT 聊天
app.ws('/chat', (ws, req) => {
    const messageHandler = (e) => {
        logger.info('worker message: ', e);
        switch (e.type) {
            case 'reply':
                ws.send(WSResponse.success({type: 'reply', data: e.data}));
                break;
            case 'replyOver':
                ws.send(WSResponse.success({type: 'replyOver'}));
                break;
        }
    };

    worker.on('message', messageHandler);

    ws.on('message', e => {
        const json = JSON.parse(e);
        // if (json.type === 'init')
        //     initAIWorker(ws, req).then(worker => {
        //         workerMap.set(ws, worker);
        //     });
        // else if (json.type === 'chat') {
        //
        // } else {
        //     console.error('未知类型');
        //     ws.send(WSResponse.fail('未知类型: ' + json.type));
        // }

        if (json.type === 'chat') {
            console.log(json);
            worker.postMessage(WorkerResult.build('chat', json.data));
        } else {
            console.error('未知类型');
            ws.send(WSResponse.fail('未知类型: ' + json.type));
        }
    });

    // ws.on('close', e => {
    //     if (workerMap.has(ws)) {
    //         const worker = workerMap.get(ws);
    //         worker.postMessage('terminate');
    //         workerMap.delete(ws);
    //     }
    // });

    ws.on('close', e => {
        worker.off('message', messageHandler);
    });
});

app.get('/reWorker', async (req, res) => {
    worker.postMessage(WorkerResult.build('terminate'));
    worker = await initAIWorker();
    res.json({msg: 'ok'});
});

function bz(str, ws) {
    sendOne();

    function sendOne() {
        if (str.length === 0) {
            ws.send(JSON.stringify({status: 2}));
            return;
        }
        const word = str[0];
        str = str.substring(1);
        setTimeout(() => {
            ws.send(JSON.stringify({word, status: 1}));
            sendOne();
        }, 500 + Math.floor(Math.random() * 500));
    }
}

// 鉴权签名
function getAuthStr(date) {
    let signatureOrigin = `host: ${config.host}\ndate: ${date}\nGET ${config.uri} HTTP/1.1`;
    let signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret);
    let signature = CryptoJS.enc.Base64.stringify(signatureSha);
    let authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    let authStr = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(authorizationOrigin));
    return authStr;
}

function getWebSocketUrl() {
    const url = 'wss://iat-api.xfyun.cn/v2/iat';
    const host = config.host;
    const apiKey = config.apiKey;
    const apiSecret = config.apiSecret;
    const date = (new Date().toUTCString());
    const algorithm = 'hmac-sha256';
    const headers = 'host date request-line';
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
    const signature = CryptoJS.enc.Base64.stringify(signatureSha);
    const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    const authorization = btoa(authorizationOrigin);
    return `${url}?authorization=${authorization}&date=${date}&host=${host}`;
}

async function initAIWorker() {
    const worker = new Worker(path.resolve(__dirname, 'ChatGPTWorker.js'));
    // worker.on('message', e => {
    //     switch (e.type) {
    //         case 'ready':
    //             ws.send(WSResponse.ready());
    //             break;
    //         case 'report':
    //             logger.info(e.data);
    //             ws.send(WSResponse.success(e));
    //             break;
    //     }
    // });
    worker.on('error', e => {
        console.error('worker error:', e);
    });
    worker.on('exit', (code) => {
        const msg = `Worker stopped with exit code ${code}`;
        if (code !== 0) {
            console.error(msg);
        } else {
            logger.info(msg);
        }
    });
    return worker;
}

app.listen(80, () => {
    console.info(`server start on: http://127.0.0.1`);
});

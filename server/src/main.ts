import express from 'express'
import expressWs from 'express-ws'
import cors from 'cors'
import {
  AIChatMessage,
  AIChatStatus,
  EventHandler,
  EventName,
  WorkerMessage,
  WorkerMessageType,
  WorkerProxy
} from 'chatgpt-worker'
import path from 'path'
import {WSData, WSDataType} from "./types/WSData";
import config from './config/xfyun.config'
import CryptoJS from 'crypto-js'
import WebSocket from 'ws'
import {WSIatData, WSIatType} from "./types/WSIatData";

let wp = new WorkerProxy()

const app = express();

app.use('/', express.static(path.resolve(process.cwd(), 'public')))
app.use('/', express.static(path.resolve(process.cwd(), 'dist')))

app.use(cors())

expressWs(app)
app.use(express.json())

app.post('/chat', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const {message} = req.body

  let eventHandler: EventHandler
  // 绑定线程事件
  wp.on(EventName.Message, eventHandler = (e: WorkerMessage) => {
    if (e.type === WorkerMessageType.Reply) {
      const data: AIChatMessage = e.data
      if (data.status === AIChatStatus.End) {
        res.end(JSON.stringify(data))
      } else {
        res.write(JSON.stringify(data))
      }
    }
  })

  // 前端请求中断
  res.on('close', async () => {
    wp.off(EventName.Message, eventHandler)
    // await wp.refresh()
  })

  await wp.waitForWorkerReady()
  await wp.chat(message)
})

// @ts-ignore
app.ws('/chat', (ws, req) => {
  console.log('receive ws')

  let eventHandler: EventHandler

  ws.on('message', async (e: string) => {
    const data: WSData = JSON.parse(e)
    console.log('ws receive')
    console.log(data)
    switch (data.type) {
      case WSDataType.Chat:
        await wp.waitForWorkerReady()
        await wp.chat(data.data)
        break;
      default:
        break;
    }
  })

  ws.on('close', async () => {
    console.log('ws close')
    wp.off(EventName.Message, eventHandler)
    await wp.refresh()
  })

  // 绑定线程事件
  wp.on(EventName.Message, eventHandler = (e: WorkerMessage) => {
    if (e.type === WorkerMessageType.Reply) {
      const data: AIChatMessage = e.data
      ws.send(JSON.stringify(data))
    }
  })
})

// 语音合成
// @ts-ignore
app.ws('/tts', (ws, req) => {
  const date = (new Date().toUTCString());
  const wssUrl = config.tts + '?authorization=' + getAuthStr(date) + '&date=' + date + '&host=' + config.host;
  const _ws = new WebSocket(wssUrl);

  _ws.on('open', () => {
    console.log('xfyun open')
    ws.send(JSON.stringify(WSData.build(WSDataType.Ready)));
  });
  _ws.on('message', (data, err) => {
    console.log('xfyun message');

    if (err) {
      ws.send(JSON.stringify(WSData.build(WSDataType.Error, err, 'server ws error')))
      console.error(err);
      _ws.close();
      return;
    }

    let res = JSON.parse((data as any));
    // console.log(res);

    if (res.code !== 0) {
      ws.send(JSON.stringify(WSData.build(WSDataType.Error, `${res.code}: ${res.message}`, 'xfyun error')))
      _ws.close();
      return;
    }

    let audio = res.data.audio;
    let params = {audio, status: 1};
    if (res.code === 0 && res.data.status === 2) {
      params.status = 2;
      _ws.close();
    }
    ws.send(JSON.stringify(WSData.build(WSDataType.SpeechReply, params, params.status === 1 ? 'running' : 'end')))
  });
  _ws.on('close', e => {
    console.log('xfyun close');
    console.log(e);
  });

  ws.on('message', (e: string) => {
    console.log(e);
    const data: WSData = JSON.parse(e);
    if (data.type === WSDataType.TTS) {
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
          'text': Buffer.from(data.data).toString('base64'),
          'status': 2
        }
      };
      _ws.send(JSON.stringify(frame));
    }
  });
})

// 语音听写
// @ts-ignore
app.ws('/iat', (ws, req) => {
  const wssUrl = getIatUrl()
  const _ws = new WebSocket(wssUrl);

  _ws.on('open', () => {
    ws.send(JSON.stringify(WSData.build(WSDataType.Ready)));
  });
  _ws.on('message', (data, err) => {
    if (err) {
      console.error('xfyun error: ', err)
      ws.send(JSON.stringify(WSData.build(WSDataType.Error, null, 'xfyun iat error')));
      return;
    }
    ws.send(JSON.stringify(WSData.build(WSDataType.IATReply, data.toString())));
  });
  _ws.on('close', e => {
    console.log('iat xfyun close')
  });

  ws.on('message', (e: string) => {
    console.log('iat message')
    const json: WSData = JSON.parse(e);
    console.log(json)
    const wsid: WSIatData = json.data
    let params;
    if (wsid.type === WSIatType.First) {
      console.log('first')
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
          audio: json.data.data,
        },
      };
    } else if (wsid.type === WSIatType.Other) {
      console.log('other')
      params = {
        data: {
          status: 1,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: json.data.data,
        },
      };
    } else if (wsid.type === WSIatType.End) {
      console.log('end')
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
      ws.send(JSON.stringify(WSData.build(WSDataType.Error, null, message)))
      console.error(message);
      return
    }
    _ws.send(JSON.stringify(params));
  });
});

// 鉴权签名
function getAuthStr(date: string) {
  let signatureOrigin = `host: ${config.host}\ndate: ${date}\nGET ${config.uri} HTTP/1.1`;
  let signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret);
  let signature = CryptoJS.enc.Base64.stringify(signatureSha);
  let authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(authorizationOrigin));
}

// 获取语音听写ws地址
function getIatUrl() {
  const url = config.iat
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

app.listen(80, () => {
  console.log(`server start on: http://127.0.0.1`)
})
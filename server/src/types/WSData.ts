// ws 消息类型
export enum WSDataType {
  // 聊天
  Chat,
  // 准备就绪
  Ready,
  // 异常
  Error,
  // 收到语音合成回复消息
  SpeechReply,
  // 请求语音合成
  TTS,
  // 请求语音听写
  IAT,
  // 收到语音听写的回复
  IATReply
}

// ws 数据传输对象
export class WSData {
  type: WSDataType
  message: string
  data: any

  constructor(type: WSDataType, data: any, message: string) {
    this.type = type
    this.data = data
    this.message = message
  }

  public static build(type: WSDataType): WSData;
  public static build(type: WSDataType, data: any): WSData;
  public static build(type: WSDataType, data: any, message: string): WSData;
  public static build(type: WSDataType, data?: any, message?: string): WSData {
    if (message) {
      return new WSData(type, data, message)
    } else if (data) {
      return new WSData(type, data, 'none')
    } else {
      return new WSData(type, null, 'none')
    }
  }
}
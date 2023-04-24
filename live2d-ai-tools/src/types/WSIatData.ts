export enum WSIatType {
  // 请求发送第一段音频
  First,
  // 请求发送其他段音频
  Other,
  // 音频发送结束
  End
}

export class WSIatData {
  type: WSIatType
  data: any

  constructor(type: WSIatType, data?: any) {
    this.type = type
    this.data = data
  }

  public static build(type: WSIatType): WSIatData;
  public static build(type: WSIatType, data?: any): WSIatData;
  public static build(type: WSIatType, data?: any): WSIatData {
    return new WSIatData(type, data)
  }
}
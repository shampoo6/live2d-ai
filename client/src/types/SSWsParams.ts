// https://www.xfyun.cn/doc/tts/online_tts/API.html#%E6%8E%A5%E5%8F%A3%E8%B0%83%E7%94%A8%E6%B5%81%E7%A8%8B
export type SSWsParams = {
  // 公共参数
  common: {
    app_id: string
  },
  // 业务参数
  business: {
    aue: string,
    vcn: VoiceName
  },
  // 业务数据流参数
  data: {
    text: string,
    status: 2
  }
}

export type VoiceName = 'xiaoyan' | 'aisjiuxu' | 'aisxping' | 'aisjinger' | 'aisjinger'
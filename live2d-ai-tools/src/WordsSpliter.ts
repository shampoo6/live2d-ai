// todo ai返回这句话时，会念两次语音: 你好！有什么我可以帮助你的吗？
// todo 怀疑是断句触发了两次回调

/**
 * AI文本断句器
 */
export class WordsSpliter {
  private static ins: WordsSpliter;

  private replaceRegex = /\s/g;
  private breakWordsRegex = /[?!。？！]/;
  // 已经发送过的文本
  private postedText = '';

  private constructor() {
    WordsSpliter.ins = this
  }

  public static getInstance() {
    return WordsSpliter.ins || new WordsSpliter()
  }

  /**
   * 处理全量文本
   * @param text AI返回的全量文本
   * @param callback 处理完后的回调函数
   */
  public processWords(text: string, callback: (text: string) => void) {
    if (text.length <= this.postedText.length) return;
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
        typeof callback === 'function' && callback(str);
      }
    }
  }

  /**
   * 结束句子拆分
   * @param text 结束句子拆分后的全量文本
   * @param callback 处理完后的回调函数
   */
  public over(text: string, callback: (text: string) => void) {
    if (text.length <= this.postedText.length) {
      this.reset();
      return;
    }
    // 获取增量
    let str = text.substring(this.postedText.length);
    str = str.replace(this.replaceRegex, '');
    if (str.length > 0) {
      // send
      console.log('over: ', str);
      typeof callback === 'function' && callback(str);
    }
    this.reset();
  }

  private reset() {
    this.postedText = '';
  }
}
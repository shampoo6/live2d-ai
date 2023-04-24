<script setup>
import {onBeforeUnmount, reactive, ref} from 'vue';
import {useDisplay} from 'vuetify';
import {v4 as uuid} from 'uuid';
import serverConfig from '@/config/server.config';
import {TTSHelper, IATHelper, WordsSpliter} from '../../live2d-ai-tools';
import {LAppLive2DManager} from '@/lapplive2dmanager';
import {
  MotionGroupIdle,
  MotionGroupTapBody,
  PriorityForce
} from '@/lappdefine';

const html = document.querySelector('html');
const app = document.querySelector('#app');
const display = useDisplay();
// AI调用相关
const ws = new WebSocket(`ws://${serverConfig.domain}/chat`);
const ttsHelper = TTSHelper.getInstance('js/ttsWorker.js', `ws://${serverConfig.domain}/tts`);
ttsHelper.onEnded = taskListLength => {
  if (loading.value && taskListLength === 0) {
    stopAudioResetState();
  }
};
const iatHelper = IATHelper.getInstance('js/iatWorker.js', `ws://${serverConfig.domain}/iat`);
iatHelper.afterAutoStopRecord = onAfterAutoStopRecord;
const wordsSpliter = WordsSpliter.getInstance();
// 模型
const model = LAppLive2DManager.getInstance().getModel(0);

ws.addEventListener('open', e => {
  console.log('ws open');
});
ws.addEventListener('message', e => {
  const data = JSON.parse(e.data);
  // 创建AI会话
  if (currentAiId !== lastAiId) {
    conversations.unshift({
      id: currentAiId,
      name: 'ai',
      content: '▌'
    });
    lastAiId = currentAiId;
    currentAi = conversations.find(item => item.id === currentAiId);
  }

  switch (data.status) {
    case 1:
      // 回复中
      currentAi.content = data.content;
      wordsSpliter.processWords(data.content, AIReplyWordsProcessor);
      break;
    case 2:
      // 回复完毕
      currentAi.content = data.html;
      // 开启停止语音播放按钮
      stopDisabled.value = false;
      wordsSpliter.processWords(data.content, AIReplyWordsProcessor);
      wordsSpliter.over(data.content, AIReplyWordsProcessor);
      break;
    default:
      break;
  }
});


// 传送门的根节点
const root = ref(null);
// 输入框
const input = ref(null);
// 输入框的验证规则
const rules = [v => v.length <= 200 || '聊天内容不能超过200字'];

// 会话
const conversations = reactive([]);
// 当前AI回复的 conversation id
let currentAiId;
let lastAiId;
let currentAi;

// 聊天内容
const chat = ref('');
// 是否禁用元素
const disabled = ref(false);
// 是否显示加载中
const loading = ref(false);
// 停止语音播放是否禁用
const stopDisabled = ref(true);
// 是否开始录音
const isRecording = ref(false);
// 提示
const snackbar = ref(false);
// 提示文本
const snackbarText = ref('');

const isMobile = mobileCheck();
const microPhoneStartEvent = isMobile ? 'touchstart' : 'mousedown';
const microPhoneEndEvent = isMobile ? 'touchend' : 'mouseup';

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
});

window.addEventListener('resize', resize);

function mobileCheck() {
  let check = false;
  (function (a) {
    if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|domain(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|domain)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true;
  })(navigator.userAgent || navigator.vendor || window.opera);
  return check;
}

function resize() {
  // 标准屏幕宽 980 标准字体大小 32
  const newFontSize = 32 / (980 / display.width.value);
  html.style.fontSize = newFontSize + 'px';
}

function onKeyDownEnter(e) {
  if (!e.shiftKey) {
    e.preventDefault();
    send();
  }
}

function send() {
  if (chat.value.trim() === '') return;

  conversations.unshift({
    id: uuid(),
    name: 'me',
    content: chat.value.replace(/\n/g, '<br/>')
  });
  // 给AI分配id
  currentAiId = uuid();
  disabled.value = true;
  loading.value = true;

  // 发送问题给服务器
  ws.send(JSON.stringify({
    type: 0,
    message: 'none',
    data: chat.value
  }));

  chat.value = '';
}

async function stopAudio() {
  await ttsHelper.stop();
  stopAudioResetState();
  stopDisabled.value = true;
}

function startRecord() {
  console.log('start record');
  if (isRecording.value) return;
  isRecording.value = true;
  iatHelper.startRecord(text => {
    console.log('iat转写回调', text);
    chat.value = text;
  }, () => {
    isRecording.value = false;
    disabled.value = false;
    loading.value = false;
    iatHelper.stopRecordImmediately();
  });
}

async function stopRecord() {
  console.log('stop record');
  if (!isRecording.value) return;
  isRecording.value = false;
  disabled.value = true;
  loading.value = true;
  await iatHelper.stopRecord();
  await iatHelper.waitForRecordingStop();
  send();
}

// 停止语音播放并重置元素状态
function stopAudioResetState() {
  disabled.value = false;
  loading.value = false;
  stopDisabled.value = true;
  input.value.focus();
}

// AI回复文本处理器
function AIReplyWordsProcessor(text) {
  console.log('收到断句结果: ', text);
  // 开始播放一句话时 切换姿势
  model.startRandomMotion(Math.random() < 0.5 ? MotionGroupIdle : MotionGroupTapBody, PriorityForce, () => {
    console.log('动作播放完成');
  });
  ttsHelper.play(text);
}

function onAfterAutoStopRecord() {
  isRecording.value = false;
  snackbarText.value = '录音超时，已自动停止。';
  snackbar.value = true;
}

resize();
</script>

<template>
  <div class="mb-16">
    <v-container>
      <v-row>
        <v-container class="conversations overflow-auto d-flex flex-column-reverse" style="height: 50vh;">
          <template v-for="item in conversations" :key="item.id">
            <!-- 我 -->
            <v-slide-x-transition appear v-if="item.name === 'me'">
              <v-row>
                <v-col>
                  <v-avatar color="primary" style="width: 3rem; height: 3rem;">
                    我
                  </v-avatar>
                </v-col>
                <v-col cols="8">
                  <v-card class="pa-8 rounded-lg" elevation="24">
                    <div v-html="item.content"></div>
                  </v-card>
                </v-col>
                <v-col></v-col>
              </v-row>
            </v-slide-x-transition>

            <!-- AI -->
            <v-slide-x-reverse-transition appear v-else>
              <v-row>
                <v-col></v-col>
                <v-col cols="8">
                  <v-card :loading="item.id === currentAiId && loading" class="pa-8 rounded-lg" elevation="24">
                    <div v-html="item.content"></div>
                  </v-card>
                </v-col>
                <v-col>
                  <v-avatar color="red" style="width: 3rem; height: 3rem;">
                    AI
                  </v-avatar>
                </v-col>
              </v-row>
            </v-slide-x-reverse-transition>
          </template>
        </v-container>
      </v-row>
      <v-row>
        <v-col align-self="end" class="d-flex justify-center">
          <v-btn @click="stopAudio" :disabled="stopDisabled" icon="mdi-stop" size="large"></v-btn>
        </v-col>
        <v-col cols="6">
          <v-textarea
              ref="input"
              :disabled="disabled"
              :loading="loading"
              class="bg-grey-lighten-2"
              placeholder="shift + enter: 换行"
              auto-grow
              rows="1"
              clearable
              variant="solo"
              counter
              :rules="rules"
              @keydown.capture.enter="onKeyDownEnter"
              v-model="chat"
          ></v-textarea>
        </v-col>
        <v-col align-self="end" class="d-flex justify-center">
          <v-btn :disabled="disabled" icon="mdi-send" size="large" color="primary" @click="send"></v-btn>
        </v-col>
        <v-col align-self="end" class="d-flex justify-center">
          <v-btn :disabled="disabled" :icon="isRecording? 'mdi-microphone': 'mdi-microphone-outline'" size="large"
                 :color="isRecording? 'primary': 'light'"
                 @[microPhoneStartEvent]="startRecord"
                 @[microPhoneEndEvent]="stopRecord"
          ></v-btn>
        </v-col>
      </v-row>
    </v-container>
    <v-snackbar
        v-model="snackbar"
        multi-line
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn
            color="red"
            variant="text"
            @click="snackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<style>
:root {
  overflow: hidden;
}

#app {
  width: 100vw;
  position: absolute;
  bottom: 0;
  left: 0;
}

.v-textarea textarea {
  font-size: 1rem;
}

.v-btn--size-large {
  --v-btn-height: 90px !important;
}

.v-counter {
  color: #fff !important;
}

.conversations {

}

.conversations > .v-row {
  flex-grow: 0;
}

.conversations > .v-row:first-child {
  margin-top: 12px;
}
</style>
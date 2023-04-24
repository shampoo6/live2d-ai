/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import {LAppDelegate} from './lappdelegate';
import * as LAppDefine from './lappdefine';
import {createApp} from "vue";
import App from "@/App.vue";

// Vuetify
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import {createVuetify} from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import {aliases, mdi} from 'vuetify/iconsets/mdi'

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi', // This is already the default value - only for display purposes
    sets: {
      mdi,
    }
  },
})


/**
 * ブラウザロード後の処理
 */
window.onload = (): void => {
  // create the application instance
  if (LAppDelegate.getInstance().initialize() == false) {
    return;
  }

  LAppDelegate.getInstance().run();

  // 创建 vue 应用
  initVue()
};

/**
 * 終了時の処理
 */
// window.onbeforeunload = (): void => LAppDelegate.releaseInstance();

/**
 * Process when changing screen size.
 */
window.onresize = () => {
  if (LAppDefine.CanvasSize === 'auto') {
    LAppDelegate.getInstance().onResize();
  }
};

function initVue() {
  // 创建根节点
  const root = document.createElement('div')
  root.id = 'app'
  document.body.appendChild(root)
  createApp(App)
    .use(vuetify)
    .mount('#app')
}

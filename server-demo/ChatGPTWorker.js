const {parentPort} = require('node:worker_threads');
const WorkerResult = require('./WorkerResult');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const {ai: config} = require('./config');
const moment = require('moment');
const path = require('path');
const pino = require('pino');
const pretty = require('pino-pretty');
const fs = require('fs');
const fsp = require('fs/promises');
const logPath = path.resolve(__dirname, 'logs', `worker_${process.pid}_${moment().format('YYYY-MM-DD_HH_mm_ss')}.log`);
fs.writeFileSync(logPath, '');
const streams = [
    {stream: fs.createWriteStream(logPath)},
    {stream: pretty()}
];
const logger = pino({level: 'info'}, pino.multistream(streams));

let browser, page;

async function main() {
    await init();
    // await signIn();
    // await ready();
}

function wait(time) {
    return new Promise(r => {
        setTimeout(r, time);
    });
}

// 向前端汇报情况
async function report(msg) {
    // console.log(msg);
    logger.info(msg);
    msg = `[${moment().format('YYYY-MM-DD HH:mm:ss')}](${process.pid}): ${msg}`;
    parentPort.postMessage(WorkerResult.build('report', msg));
}

async function init() {
    puppeteer.use(StealthPlugin());
    browser = await puppeteer.launch({
        executablePath: config.chromePath,
        headless: false
    });
    const pages = await browser.pages();
    page = pages[0];
    page.setDefaultNavigationTimeout(0);
    page.setDefaultTimeout(0);
    await report('init: 初始化完成，准备跳转登录页');
    // https://chat.openai.com/chat
    // await page.goto('https://chat.openai.com');
    await page.goto('https://chat.openai.com/chat');
    const cookies = JSON.parse((await fsp.readFile(path.resolve(__dirname, 'cookies'))).toString());
    await page.setCookie(...cookies);
    await report('init: 已跳转至登录页');
}

async function signIn() {
    const signInBtnSelector = '.btn.relative.btn-primary';
    const accountInpSelector = '#username';
    const continueBtnSelector = 'button[type="submit"]';
    const pwdInpSelector = '#password';
    await page.waitForSelector(signInBtnSelector);
    await wait(3000);
    await report('signIn: 点击登录按钮');
    await Promise.all([
        page.waitForNavigation(),
        page.click(signInBtnSelector)
    ]);
    await wait(2000);
    await report('signIn: 准备输入账号');
    await page.waitForSelector(accountInpSelector);
    await page.type(accountInpSelector, config.email);
    await report('signIn: 账号输入完成，点击继续');
    await Promise.all([
        page.waitForNavigation(),
        page.click(continueBtnSelector)
    ]);
    await wait(2000);
    await report('signIn: 准备输入密码');
    await page.waitForSelector(pwdInpSelector);
    await page.type(pwdInpSelector, config.password);
    await report('signIn: 密码输入完成，点击继续');
    await Promise.all([
        page.waitForNavigation(),
        page.click(continueBtnSelector)
    ]);
    await report('signIn: 登录完成');
}

// 进入聊天页 准备就绪
async function ready() {
    const coverSelector = '#headlessui-portal-root';
    await page.waitForSelector(coverSelector);
    await page.$eval(coverSelector, el => {
        el.remove();
    });
    await report('ready: 删除提示信息');
    // await listen();
    await report('ready: 准备完成');
    parentPort.postMessage(WorkerResult.ready());
    // console.log(await page.cookies());
    await fsp.writeFile(path.resolve(__dirname, 'cookies'), JSON.stringify(await page.cookies()));
}

// 监听主线程
async function listen() {
    const textareaSelector = 'textarea.w-full';
    const sendBtnSelector = 'button.absolute.p-1.rounded-md.text-gray-500.right-1';
    const replyContainerSelector = '.flex.flex-col.items-center.text-sm';
    // const replySelector = '.w-full.border-b';
    // const replySelector = '.flex.flex-col.items-center.text-sm>.w-full.border-b:last-child'
    const replySelector = '.markdown';
    // 发送图标(纸飞机)
    const sendIconSelector = '.absolute.p-1.rounded-md.text-gray-500>svg';

    parentPort.on('message', async e => {
        console.log('receive message: ', e);
        switch (e.type) {
            case 'terminate':
                await browser.close();
                process.exit();
                break;
            case 'chat':
                await page.waitForSelector(textareaSelector);
                await page.type(textareaSelector, e.data);
                await page.waitForSelector(sendBtnSelector);
                await page.click(sendBtnSelector);
                await wait(1000);
                // return await this.page.$eval(this.conversationContainerSelector, (el: HTMLElement, selector: string) => {
                //     const alls = el.querySelectorAll(selector);
                //     return alls[alls.length - 1].textContent;
                // }, this.conversationSelector);
                let timer = setInterval(() => {
                    page.$eval(replyContainerSelector, (el, selector) => {
                        const alls = el.querySelectorAll(selector);
                        return alls[alls.length - 1].textContent;
                    }, replySelector).then(text => {
                        console.log(text);
                        parentPort.postMessage(WorkerResult.build('reply', text));
                    });
                }, 50);
                await page.waitForSelector(sendIconSelector);
                await wait(1000);
                clearInterval(timer);
                parentPort.postMessage(WorkerResult.build('replyOver'));
                break;
        }
    });
}

listen().then();
main().then();
const fs = require('fs');
const util = require('../utils');
const log = require('../utils/logger');
const inquirer = require('inquirer');
const rimraf = require('rimraf');
const ora = require('ora');
const decompress = require('decompress');
const tmp = require('tmp');
const request = require('request');

function add(op) {
    let path = process.cwd();
    path += '/plugins/android/' + op.name;
    if (checkModuleExist(op)) {
        inquirer.prompt([{
            type: 'confirm',
            message: `android端已存在名为${op.name}的插件，是否覆盖安装？`,
            name: 'ok'
        }]).then(answers => {
            if (answers.ok) {
                rimraf(path, () => {
                    log.info('开始添加android端插件');
                    op.isCover = true;
                    download(op)
                })
            } else {
                log.fatal(`android端放弃安装${op.name}！`);
                if (op.callback) {
                    op.callback(op)
                }
            }
        }).catch(console.error);
    } else {
        log.info('开始添加android端插件');
        download(op)
    }
}

function remove(op) {
    changeSetting(op, false);
    changeGradle(op, false);
    removePorject(op);
}

function removePorject(op) {
    let path = process.cwd();
    path += '/plugins/android/' + op.name;
    rimraf(path, () => {
        log.info('插件' + op.name + ' android端清理完成!');
        log.weiuis('android端插件移除完毕！');
        invokeScript(op, true);
        if (typeof op.myCallback === 'function') {
            op.myCallback();
        }
    });
}

function download(op) {
    let outputPath = process.cwd();
    outputPath += '/plugins/android/' + op.name;
    //
    let downPath = tmp.tmpNameSync({dir: require('os').tmpdir()}) + ".zip";
    let file = fs.createWriteStream(downPath);
    file.on("close", () => {
        decompress(downPath, outputPath).then(() => {
            fs.unlinkSync(downPath);
            addSetting(op);
            addGradle(op);
            invokeScript(op, false)
        })
    }).on("error", (err) => {
        log.fatal(`插件${op.name} android端下载失败: ${err}！`);
    });
    //
    let spinFetch = ora('插件' + op.name + ' android端正在下载...');
    spinFetch.start();
    request.get(op.android_url).on("error", function (err) {
        log.fatal(`插件${op.name} android端下载失败: ${err}！`);
    }).on("response", function (res) {
        if (res.statusCode !== 200) {
            log.fatal(`插件${op.name} android端下载失败: Get zipUrl return a non-200 response！`);
        }
    }).on("end", function () {
        spinFetch.stop();
        log.info('插件' + op.name + ' android端下载完毕，开始安装！');
    }).pipe(file);
}

function checkModuleExist(op) {
    let path = process.cwd();
    path += '/plugins/android/' + op.name;
    return fs.existsSync(path)
}

function addGradle(op) {
    changeGradle(op, true)
}

function addSetting(op) {
    changeSetting(op, true)
}

function changeSetting(op, add) {
    let path = process.cwd();
    path += '/platforms/android/WeexWeiui/settings.gradle';
    let result = fs.readFileSync(path, 'utf8');
    let temp = result.split('\n');
    if (temp[0].indexOf("weiui_" + op.name) !== -1) {
        log.fatal('项目下存在同名module，请先删除!');
        return
    }
    let out = [];
    for (let t in temp) {
        if (temp.hasOwnProperty(t)) {
            if (temp[t].indexOf("weiui_" + op.name) === -1) {
                out.push(temp[t])
            }
        }
    }
    if (add) {
        if (op.isCover !== true) {
            out.push('');
        }
        out.push('include ":weiui_' + op.name + '"');
        out.push('project (":weiui_' + op.name + '").projectDir = new File("../../../plugins/android/' + op.name + '")');
    }
    let s = '';
    out.forEach((item) => {
        s += item + '\n'
    });
    fs.writeFileSync(path, s.replace(/^\n+|\n+$/g, ""), {encode: 'utf-8'})
}

function changeGradle(op, add) {
    let path = process.cwd();
    path += '/platforms/android/WeexWeiui/app/build.gradle';
    let result = fs.readFileSync(path, 'utf8');
    let res = '' + result.substr(result.indexOf('dependencies'), result.length);
    let temp = res.split('\n');
    let out = [];
    temp.forEach((item) => {
        if (item.indexOf(':weiui_' + op.name) === -1) {
            out.push(item)
        }
    });
    out = out.splice(0, out.length - 2);
    if (add) {
        out.push('    implementation project(":weiui_' + op.name + '")')
    }
    out.push('}');
    let px = '';
    out.forEach((item) => {
        px += item + '\n'
    });
    result = result.replace(res, px);
    fs.writeFileSync(path, result, {encode: 'utf-8'})
}

function invokeScript(op, isRemove) {
    let path = process.cwd();
    path += '/plugins/android/' + op.name;
    let jsPath = path + '/.weiuiScript/install.js';
    if (isRemove) {
        jsPath = path + '/.weiuiScript/uninstall.js'
    }
    if (!fs.existsSync(jsPath)) {
        if (!isRemove) {
            log.weiuis('插件' + op.name + ' android端添加完成!');
            if (op.callback) {
                op.callback();
            }
        }
    }else{
        util.exec('node ' + jsPath).then(() => {
            if (!isRemove) {
                log.weiuis('插件' + op.name + ' android端添加完成!');
                if (op.callback) {
                    op.callback()
                }
            }
        });
    }
}

module.exports = {add, checkModuleExist, addSetting, addGradle, changeSetting, changeGradle, download, remove};





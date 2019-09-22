const axios = require('axios');
const ora = require('ora');
const Inquirer = require('inquirer');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
let downloadGitRepo = require('download-git-repo');
const Metalsmith = require('metalsmith'); // 遍历文件夹 找需不需要渲染
// consolidate  统一了所有的模版引擎
const { render } = require('consolidate').ejs;

// 可以把异步的API转换成promise
downloadGitRepo = promisify(downloadGitRepo);
let ncp = require('ncp');

ncp = promisify(ncp);
const { downloadDirectory } = require('./constants');

// create 的所有的逻辑

// create功能是创建项目
// 拉取自己项目离诶包出来 让用户选择安装哪个项目 projectName
// 选完 后显示所有的版本号 1.0

// https://api.github.com/orgs/zhu-cli/repos 获取组织下的仓库

// 1) 获取项目列表
const fetchRepoList = async () => {
  const { data } = await axios.get('https://api.github.com/orgs/zhu-cli/repos');
  return data;
};

const fetchTagList = async (repo) => {
  const { data } = await axios.get(
    `https://api.github.com/repos/zhu-cli/${repo}/tags`,
  );
  return data;
};

// 封装loading效果
const waitFnloading = (fn, message) => async (...args) => {
  const spinner = ora(message);
  spinner.start();
  const result = await fn(...args);
  spinner.succeed();
  return result;
};

const download = async (repo, tag) => {
  let api = `zhu-cli/${repo}`;
  if (tag) {
    api += `#${tag}`;
  }
  // /user/xxxx/.template/repo
  const dest = `${downloadDirectory}/${repo}`;
  await downloadGitRepo(api, dest);
  return dest; // 当前最终目录
};

// 可能还需要用户配置一些数据 来结合渲染我的项目
module.exports = async (projectName) => {
  // 1) 获取项目的模板 （所有的）
  let repos = await waitFnloading(fetchRepoList, 'fetching template ....')();
  repos = repos.map((item) => item.name);
  // 在获取之前 显示loading 关闭loading
  // 选择模板 inquirer
  const { repo } = await Inquirer.prompt({
    name: 'repo', // 获取选择后的结果
    type: 'list',
    message: 'pleese choise a template to create project',
    choices: repos,
  });

  // console.log(repo)

  // 通过当前选择的项目 拉取对应的版本

  // 获取对应的版本号https://api.github.com/repos/zhu-cli/vue-simple-template/tags
  let tags = await waitFnloading(fetchTagList, 'fetching tags ....')(repo);
  tags = tags.map((item) => item.name);

  const { tag } = await Inquirer.prompt({
    name: 'tag', // 获取选择后的结果
    type: 'list',
    message: 'pleese choise tags to create project',
    choices: tags,
  });
  // 3) 把模版放到一个临时目录里 存好,已备后期使用

  // console.log(repo, tag); // 下载模版
  // 把模版放到一个临时目录里 存好,以备后期使用

  // dowload-git-repo
  const result = await waitFnloading(download, 'download template')(repo, tag);
  // console.log(result); // 下载路径

  // 我拿到了下载的目录 直接高倍当亲啊执行的目录即可 ncp

  // 复杂的需要模版渲染 渲染后在拷贝
  // 把template 下的文件  拷贝到执行命令的目录下
  // 4) 拷贝操作
  // 这个目录  项目名字是否已经存在,如果存在提示当前已经存在了

  // 如果有ask.js 文件 // .temlate/xxx
  if (!fs.existsSync(path.join(result, 'ask.js'))) {
    await ncp(result, path.resolve(projectName));
  } else {
    // 复杂的模版
    // console.log('复杂的模版');
    // 把git上的项目下载下来 , 如果有ask 文件是一个负载的模版,我们需要用户选择,选择后编译模版
    // 1) 让用户填 信息
    await new Promise((resolve, reject) => {
      Metalsmith(__dirname) // 如果你传入路径 他会默认遍历当前路径下的src文件夹
        .source(result)
        .destination(path.resolve(projectName))
        .use(async (files, metal, done) => {
          const args = require(path.join(result, 'ask.js'));
          const obj = await Inquirer.prompt(args);
          const meta = metal.metadata();
          Object.assign(meta, obj);
          delete files['ask.js'];
          done();
        })
        .use((files, metal, done) => {
          const obj = metal.metadata();
          Reflect.ownKeys(files).forEach(async (file) => {
            if (file.includes('js') || file.includes('json')) {
              let content = files[file].contents.toString(); // 文件的内容
              if (content.includes('<%')) {
                content = await render(content, obj);
                files[file].contents = Buffer.from(content); // 渲染
              }
            }
          });
          // 根据用户的输入 下载模版
          done();
        })
        .build((err) => {
          if (err) {
            reject();
          } else {
            resolve();
          }
        });
    });

    // 2) 用用户填写的信息去渲染模版
    // metalsmith 只要模版编译 都需要这个模块
  }
};

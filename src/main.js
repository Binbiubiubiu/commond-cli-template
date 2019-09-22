// 找到要只想的核心文件
// 1) 找到要解析用户额的参数
const program = require('commander');
const path = require('path');
const { version } = require('./constants');
// vue create template

const mapAction = {
  create: {
    alias: 'c',
    description: 'create a project',
    examples: ['zhu-cli create <project-name>'],
  },
  config: {
    alias: 'conf',
    description: 'config project variable',
    examples: ['zhu-cli config set <k> <v>', 'zhu-cli config get <k>'],
  },
  '*': {
    alias: '',
    description: 'command not found',
    examples: [],
  },
};
// Object.keys()
Reflect.ownKeys(mapAction).forEach((action) => {
  program
    .command(action) // 配置命令的名字
    .alias(mapAction[action].alias) // 命令的别名
    .description(mapAction[action].description) // 命令对应的描述
    .action(() => {
      if (action === '*') {
        console.log(mapAction[action].description);
      } else {
        // create config ....
        // console.log(action); // create / config
        // zhu-cli create XXXX // [node,zhu-cli,zhu]
        require(path.resolve(__dirname, action))(...process.argv.slice(3));
      }
    });
});

// 监听用户的help  事件
program.on('--help', () => {
  console.log('\nExamples:');
  Reflect.ownKeys(mapAction).forEach((action) => {
    mapAction[action].examples.forEach((example) => {
      console.log(`  ${example}`);
    });
  });
});

// 解析用户传递过来的参数
program.version(version).parse(process.argv);

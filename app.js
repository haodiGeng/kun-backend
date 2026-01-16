// 1. 🌟 第一步：优先引入 dotenv，加载本地 .env 环境变量（本地开发生效，Render 无需此依赖）
require('dotenv').config();

// 2. 引入已安装的后端依赖
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

// 3. 初始化Express应用
const app = express();

// 4. 🌟 第二步：端口适配 Render 环境（不再固定 3000，优先读取 Render 环境变量 PORT）
// 本地开发兜底为 3000，Render 部署时自动使用平台分配的端口
const port = process.env.PORT || 3000;

// 5. 🌟 第三步：敏感配置从环境变量读取（不再硬编码，本地从 .env 读取，Render 从平台环境变量读取）
const SECRET_CONFIG = {
  // 从 process.env 中读取对应环境变量，键名需与 .env 和 Render 配置一致
  IMGBB_API_KEY: process.env.IMGBB_API_KEY,
  COZE_TOKEN: process.env.COZE_TOKEN,
  COZE_CHAT_API: 'https://api.coze.cn/open_api/v2/chat' // Coze官方对话接口（固定不变，无需修改）
};

// 6. 🌟 新增：校验环境变量是否配置（可选，便于排查问题）
if (!SECRET_CONFIG.IMGBB_API_KEY || !SECRET_CONFIG.COZE_TOKEN) {
  console.warn('⚠️  警告：敏感环境变量未配置，请检查 .env 文件或 Render 环境变量配置');
}

// 7. 配置中间件（确保能接收前端请求、解决跨域）
app.use(cors({
  origin: '*', // 开发环境允许所有域名访问
  methods: ['GET', 'POST'], // 允许的请求方法
  allowedHeaders: ['Content-Type'], // 允许的请求头
  credentials: true // 允许携带跨域凭证
})); // 优化跨域配置，提升兼容性
app.use(express.json({ limit: '50mb' })); // 增大JSON请求体限制，解决PayloadTooLargeError
app.use(express.urlencoded({ limit: '50mb', extended: true })); // 补充urlencoded请求体限制，提升兼容性

// 8. 🌟 接口1：图片上传中转（对应前端/api/upload-img，替代直接调用ImgBB）
// 核心业务逻辑不变，仅敏感密钥从环境变量读取，无需修改
app.post('/api/upload-img', async (req, res) => {
  try {
    // 接收前端传递的纯Base64数据
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.json({ code: 400, msg: '缺少图片Base64数据' });
    }

    // 后端调用ImgBB官方API（携带环境变量中的敏感密钥，前端无感知）
    const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: new URLSearchParams({
        image: imageBase64,
        expiration: 0,
        key: SECRET_CONFIG.IMGBB_API_KEY // 从环境变量读取，无需硬编码
      })
    });

    // 解析结果并返回给前端
    const imgbbData = await imgbbResponse.json();
    if (imgbbData.success) {
      return res.json({
        code: 200,
        msg: '图片上传成功',
        data: { imgUrl: imgbbData.data.url }
      });
    } else {
      return res.json({
        code: 500,
        msg: `ImgBB上传失败：${imgbbData.error?.message || '未知错误'}`
      });
    }
  } catch (error) {
    return res.json({
      code: 500,
      msg: `服务器内部错误：${error.message}`
    });
  }
});

// 9. 🌟 接口2：Coze对话中转（对应前端/api/coze-chat，替代直接调用Coze）
// 核心业务逻辑不变，仅敏感Token从环境变量读取，无需修改
app.post('/api/coze-chat', async (req, res) => {
  try {
    // 接收前端传递的对话参数
    const { conversation_id, bot_id, user, query, stream } = req.body;
    if (!bot_id || !user || !query) {
      return res.json({ code: 400, msg: '缺少必要参数（bot_id、user、query）' });
    }

    // 构造Coze请求参数
    const cozeRequestData = {
      conversation_id: conversation_id || '',
      bot_id,
      user,
      query,
      stream: stream || false
    };

    // 后端调用Coze官方API（携带环境变量中的敏感Token，前端无感知）
    const cozeResponse = await fetch(SECRET_CONFIG.COZE_CHAT_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_CONFIG.COZE_TOKEN}`, // 从环境变量读取，无需硬编码
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cozeRequestData)
    });

    // 解析结果并返回给前端
    const cozeData = await cozeResponse.json();
    return res.json({
      code: 200,
      msg: '对话请求成功',
      data: cozeData
    });
  } catch (error) {
    return res.json({
      code: 500,
      msg: `服务器内部错误：${error.message}`
    });
  }
});

// 10. 🌟 第四步：启动后端服务，绑定 0.0.0.0（确保 Render 能外部访问）
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ 后端服务已启动，运行地址：http://localhost:${port}`);
  console.log(`✅ 公网/局域网访问地址：http://xxx.xxx.xxx.xxx:${port}（Render 部署后替换为平台域名）`);
  console.log(`✅ 图片上传接口：http://localhost:${port}/api/upload-img`);
  console.log(`✅ Coze对话接口：http://localhost:${port}/api/coze-chat`);
});
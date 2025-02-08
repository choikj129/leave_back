const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API 문서',
      version: '1.0.0',
      description: 'API 엔드포인트 문서',
    },
    servers: [
      {
        url: 'http://localhost:8080/api',
        description: '개발 서버',
      },
      {
        url: 'https://leave.xcn.kr/api',
        description: '휴가웹 backend api',
      },
    ],
  },
  apis: ['./routes/*.js'], // routes 폴더의 모든 JS 파일을 스캔
};

const specs = swaggerJsdoc(options);

module.exports = specs; 
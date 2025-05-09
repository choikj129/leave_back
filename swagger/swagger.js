const swaggerJsdoc = require('swagger-jsdoc')

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
                url: 'https://leave.xcn.kr/api',
                description: '휴가웹 backend api',
            },
            {
                url: 'http://localhost:8080/api',
                description: '개발 서버',
            },
        ],
    },
    apis: ['./routes/*.js'], // routes 폴더의 모든 JS 파일을 스캔
}

module.exports = swaggerJsdoc(options)
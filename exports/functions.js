let crypto = require("crypto")
let salt = require("./config/crypto")
let log4j = require("./log4j")
const holidayKR = require("holiday-kr")

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
module.exports = {
    /* create crypto salt */
    createSalt : () => {        
        return crypto.randomBytes(64).toString('base64')
    },
    /* encrypt password */
    encrypt : (key) => {
        return crypto.pbkdf2Sync(key, salt, 1, 64, "SHA512").toString("base64")
    },
    sendFail : (res, msg) => {
        try {
            res.json({
                status: false,
                msg: `[${res.req._parsedOriginalUrl.path}] ${msg}`,
                data: []
            })
        } catch(e) {
            console.error(e)
        }
    },
    sendSuccess : (res, data=[], msg="") => {
        try {
            res.json({
                status: true,
                msg: `[${res.req._parsedOriginalUrl.path}] ${msg}`,
                data: data
            })
        } catch(e) {
            console.error(e)
        }
    },
    checkOnlyManagerUrl : (req, res) => {
        if (req.session.user.isManager) return true
        
        try {
            res.json({
                status: false,
                msg: "관리자만 사용할 수 있는 API 입니다.",
                data: []
            })
        } catch(e) {
            console.error(e)
        }

        return false
    },
    replaceQuery : (query, params) => {
        /* 쿼리에 :key를 치환 */
        Object.entries(params).forEach((param) => {
            const key = param[0]
            let value = param[1]
            if (typeof value == "string") {
                value = `'${value}'`
            }
            query = query.replaceAll(`:${key}`, value)
        })
        return query
    },
    queryParamsFilter : (query, params) => {
        let match = query.match(/:[\w$ㄱ-ㅎㅏ-ㅣ가-힣]+/g)
        let returnParams = []
        params.forEach(param => {
            if (!param) return
            let paramMap = {}
            match.forEach(matchValue => {
                matchValue = matchValue.substring(1)
                paramMap[matchValue] = param[matchValue]
            })
            returnParams.push(paramMap)
        })

        return returnParams
    },
    /* 직원 생일 3년치 (작년, 올해, 내년) 생성. 음력은 양력으로 변환 */
    makeBirthdays : async (rows) => {
        const year = new Date().getFullYear()

        let birthdays = []
        for (let i=0; i<rows.length; i++) {
            let birthday = rows[i]
            if (!birthday.생일) continue
            if (birthday.음력여부 == 'N') {
                let month = birthday.생일.substring(0, 2)
                let day = birthday.생일.substring(2, 4)
                for (let n=-1; n<2; n++) {
                    birthdays.push({
                        내용 : `${birthday.이름} ${month}월 ${day}일 생일🎉`,
                        생일 : `${(year + n)}-${month}-${day}`,
                        음력여부 : false
                    })
                }
            } else {
                let month = birthday.생일.substring(0, 2)
                let day = birthday.생일.substring(2, 4)
                for (let n=-1; n<2; n++) {
                    let solar
                    try {
                        solar = await holidayKR.getSolar(year + n, month, day, false)
                    } catch {
                        try {
                            solar = await holidayKR.getSolar(year + n, month, day, true)
                        } catch {}
                    } finally {
                        if (solar) {
                            let solarMonth = solar.month < 10 ? "0" + solar.month : solar.month.toString()
                            let solarDay = solar.day < 10 ? "0" + solar.day : solar.day.toString()
                            birthdays.push({
                                내용 : `${birthday.이름} 음력 ${month}월 ${day}일 생일🎉`,
                                생일 : `${solar.year}-${solarMonth}-${solarDay}`,
                                음력여부 : true,
                            })
                        }
                    }
                }
            }
        }
        return birthdays
    },
    /* 랜덤 문자열 생성 */
    randomChar : (length = 10) => {
        let result = ""        

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length)
            result += characters.charAt(randomIndex)
        }

        return result
    },
}
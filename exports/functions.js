module.exports = {
    sendFail : (res, msg) => {
        // 임시 세션처리
        res.json({
            status: false,
            msg: msg,
            data: []
        })
    },
    sendSuccess : (res, data, msg="") => {
        res.json({
            status: true,
            msg: msg,
            data: data
        })
    },
    replaceQuery : (query, params) => {
        Object.entries(params).forEach((param) => {
            const key = param[0]
            let value = param[1]            
            if (typeof value == "string") {
                value = `'${value}'`
            }
            query = query.replaceAll(`@${key}`, value)
        })
        return query
    }
}
module.exports = {
    sendFail : (res, msg) => {        
        res.json({
            status: false,
            msg: `[${res.req._parsedOriginalUrl.path}] ${msg}`,
            data: []
        })
    },
    sendSuccess : (res, data=[], msg="") => {
        res.json({
            status: true,
            msg: `[${res.req._parsedOriginalUrl.path}] ${msg}`,
            data: data
        })
    },
    replaceQuery : (query, params) => {
        /* 쿼리에 @key를 치환 */
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
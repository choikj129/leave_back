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
    }
}
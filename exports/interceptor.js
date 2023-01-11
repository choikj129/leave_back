module.exports = {
    session : (req) => {
        // 임시 세션처리
        req.session.user = {
            id: 'gj.choi',
            name: '최경주',
            isManager: 'N',
            isLogin : true,
        }
        if (req.session.user == undefined) {
            return false
        }
        
        return true
    },
}
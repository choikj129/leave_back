module.exports = {
    session : (req) => {
        // 임시 세션처리
        /*
            req.session.user = {
                id: 'gj.choi',
                name: '최경주',
                position : null,
                isManager: false,
                isLogin : true,
            }
        */
        if (!req.session.user) {
            global.userSession = null;
            return false
        }
        global.userSession = req.session.user
        return true
    },
}
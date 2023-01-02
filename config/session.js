module.exports = {
    interceptor : (req, res, next) => {
        if (req.session.user == undefined) {
            req.session.user = {
                id: 'gj.choi',
                name: '최경주',
                manager: 'N'
            }
        }
        next()
    }
}
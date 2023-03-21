let axios = require("axios")
let apiKey = require("./config/apiKey").kakaowork
let conversationId = require("./config/conversation_id")

axios.default.post["Content-Type"] = "application/json"
axios.defaults.baseURL = "https://api.kakaowork.com/v1"
axios.defaults.headers.common["Authorization"] = apiKey

module.exports = {
    getUserId : (contents, callback) => {
        axios.get(`/users.find_by_email?email=${email}`)
            .then((res) => {
                if (!res.data.success) {
                    callback(false, null)
                }            
                callback(true, res.data.user.id)
            })
    },
    conversationOpen : (id, callback) => {
        axios.post("/conversations.open", {
            "user_id" : id
        }).then((res) => {     
            if (!res.data.success) {
                callback(false, null)
            }
            callback(true, res.data.conversation.id)
        })
    },
    sendMessage : (contents, callback) => {
        axios.post("/messages.send", {
            "conversation_id" : conversationId,
            "text" : contents
        }).then((res) => {
            if (!res.data.success) {
                callback(false)
            }
            callback(true)
        })
    },
}
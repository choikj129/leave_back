let axios = require("axios")
let apiKey = require("./config/apiKey")
let conversationId = require("./config/conversation_id")

axios.default.post["Content-Type"] = "application/json"
axios.defaults.baseURL = "https://api.kakaowork.com/v1"
axios.defaults.headers.common["Authorization"] = apiKey

module.exports = {
    getUserId : async (email) => {
        return await axios.get(`/users.find_by_email?email=${email}`)
            .then((res) => {
                if (!res.data.success) {
                    return false
                }
                return res.data.user.id
            })
    },
    conversationOpen : async (id) => {
        return await axios.post("/conversations.open", {
            "user_id" : id
        }).then((res) => {
            if (!res.data.success) {
                return false
            }
            return res.data.user.id
        })
    },
    sendMessage : async (contents) => {
        return await axios.post("/messages.send", {
            "conversation_id" : conversationId,
            "text" : contents
        }).then((res) => {
            if (!res.data.success) {
                return false
            }
            return true
        })
    },
}